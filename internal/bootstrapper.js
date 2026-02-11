/**
 * Bootstrapper: O "DNA" injetado em cada script do usuário.
 * Correção: Envolve scripts atômicos em função assíncrona para permitir 'return'.
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const userScriptPath = process.argv[2];
const workspaceRoot = process.env.WORKSPACE_ROOT;
// Captura payload de eventos se houver
const eventPayload = process.env.BRIDGE_EVENT_PAYLOAD 
    ? JSON.parse(process.env.BRIDGE_EVENT_PAYLOAD) 
    : null;

const uiListeners = new Set();

/**
 * ARCHITECTURAL DECISION [Ambient Context SDK]:
 * We inject `global.bridge` manually at the bootstrap level instead of requiring users to import a module.
 * * RATIONALE:
 * 1. **Developer Experience**: Creates a "Magic SDK" feel (similar to the browser's `window` object), lowering the barrier to entry.
 * 2. **Version Control**: Allows us to hot-swap or polyfill SDK methods without requiring users to update `package.json` dependencies.
 * 3. **Scope Control**: We can strictly control what native modules (fs, path) are exposed or wrapped within the `bridge` object.
 */
global.bridge = {
    workspace: {
        root: workspaceRoot
    },
    
    // Injeta o input inicial (útil para pipelines triggerados por evento)
    input: eventPayload,

    execute: async (scriptRelativePath, payload) => {
        const fullPath = path.join(workspaceRoot, '.bridge', 'scripts', scriptRelativePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Script não encontrado: ${scriptRelativePath}`);
        }

        const scriptCode = fs.readFileSync(fullPath, 'utf8');
        
        /**
         * ARCHITECTURAL DECISION [Async IIFE Wrapper]:
         * We wrap the raw user code in an Immediately Invoked Async Function Expression (IIFE).
         * Format: `(async () => { ${userCode} })();`
         * * RATIONALE:
         * Node.js `vm.runInContext` treats code as a generic script body, which prohibits top-level `return` statements.
         * By wrapping the code:
         * 1. **Top-Level Return**: The user's `return` becomes the function's return value, allowing scripts to pass data back to the pipeline.
         * 2. **Top-Level Await**: Enables modern async/await syntax usage at the root of the script without syntax errors.
         */
        const wrappedCode = `(async () => {
            ${scriptCode}
        })();`;

        const sandbox = {
            bridge: {
                input: payload,
                state: global.bridge.state,
                ui: global.bridge.ui,
                execute: global.bridge.execute 
            },
            console: console,
            require: require,
            __dirname: path.dirname(fullPath),
            process: process
        };

        const context = vm.createContext(sandbox);
        
        try {
            const script = new vm.Script(wrappedCode);
            // O resultado será o valor retornado pelo 'return' dentro do script do usuário
            return await script.runInContext(context);
        } catch (e) {
            console.error(`Erro na execução do script ${scriptRelativePath}:`, e);
            throw e;
        }
    },

    ui: {
        render: (component, payload) => {
            process.send({ type: 'UI_RENDER', component, payload });
        },
        
        postMessage: (data) => {
            process.send({ type: 'UI_POST_MESSAGE', data });
        },

        onMessage: (callback) => {
            uiListeners.add(callback);
            return () => uiListeners.delete(callback);
        }
    },

    state: {} 
};

process.on('message', (message) => {
    if (message.type === 'UI_EVENT') {
        uiListeners.forEach(fn => fn(message.data));
    }
});

try {
    const pipeline = require(userScriptPath);
    
    if (pipeline && typeof pipeline.run === 'function') {
        /**
         * ARCHITECTURAL DECISION [Graceful Failure Protocol]:
         * We capture exceptions at the highest level to prevent "Silent Deaths" of the child process.
         * * RATIONALE:
         * If a user script throws an unhandled exception, standard Node.js behavior is to exit with code 1.
         * We intercept this to send a structured `LOG` message back to the Extension Host via IPC,
         * ensuring the user sees the error in the Output Channel/UI instead of just having the process disappear.
         */
        pipeline.run().catch(err => {
            process.send({ type: 'LOG', data: `Erro no Pipeline: ${err.message}` });
            process.exit(1);
        });
    } else {
        process.send({ type: 'LOG', data: `O arquivo ${path.basename(userScriptPath)} não exporta uma função 'run'.` });
        process.exit(1);
    }
} catch (err) {
    process.send({ type: 'LOG', data: `Falha crítica ao carregar pipeline: ${err.message}` });
    process.exit(1);
}