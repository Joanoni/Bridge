/**
 * Bootstrapper: O "DNA" injetado em cada script do usuário.
 * Versão Evoluída: Suporte a Webview (comunicação bi-direcional) e VM isolada.
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const userScriptPath = process.argv[2];
const workspaceRoot = process.env.WORKSPACE_ROOT;

// Sistema simples de listeners para mensagens da UI
const uiListeners = new Set();

// 1. Definir o objeto Bridge que o usuário verá
global.bridge = {
    workspace: {
        root: workspaceRoot
    },
    
    // Implementação robusta usando o módulo VM
    execute: async (scriptRelativePath, payload) => {
        const fullPath = path.join(workspaceRoot, '.bridge', 'scripts', scriptRelativePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Script não encontrado: ${scriptRelativePath}`);
        }

        const scriptCode = fs.readFileSync(fullPath, 'utf8');
        
        // Criar o contexto isolado (Sandbox)
        const sandbox = {
            bridge: {
                input: payload,
                state: global.bridge.state,
                ui: global.bridge.ui,
                // Permite chamadas recursivas conforme combinado
                execute: global.bridge.execute 
            },
            console: console,
            require: require, // Permite usar módulos do Node
            __dirname: path.dirname(fullPath),
            process: process
        };

        const context = vm.createContext(sandbox);
        
        try {
            // Executa o código dentro da VM
            const script = new vm.Script(scriptCode);
            return await script.runInContext(context);
        } catch (e) {
            console.error(`Erro na execução do script ${scriptRelativePath}:`, e);
            throw e;
        }
    },

    ui: {
        // Envia comando de renderização para o Host (VS Code)
        render: (component, payload) => {
            process.send({ type: 'UI_RENDER', component, payload });
        },
        
        // Envia uma mensagem genérica para a Webview já aberta
        postMessage: (data) => {
            process.send({ type: 'UI_POST_MESSAGE', data });
        },

        // Registra um callback para quando a Webview enviar algo de volta
        onMessage: (callback) => {
            uiListeners.add(callback);
            return () => uiListeners.delete(callback);
        }
    },

    state: {} // Memória compartilhada persistente durante o tempo de vida do processo
};

// Ouvir mensagens vindas do processo pai (Extension Host)
process.on('message', (message) => {
    if (message.type === 'UI_EVENT') {
        // Notificar todos os listeners interessados em eventos da UI
        uiListeners.forEach(fn => fn(message.data));
    }
});

// 2. Carregar e executar o script de entrada (Pipeline)
try {
    // Usamos require para o script principal (Pipeline) pois ele pode usar exports
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