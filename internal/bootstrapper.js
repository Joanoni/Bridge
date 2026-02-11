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
        
        // --- CORREÇÃO TÉCNICA ---
        // Envolvemos o código do usuário em uma IIFE Async.
        // Isso transforma o 'return' do usuário no retorno desta função.
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