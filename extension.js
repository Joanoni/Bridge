const vscode = require('vscode');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Provedor da Visão Lateral (Anchored View)
 * Gerencia o ciclo de vida da Webview na barra lateral e a ponte com o Pipeline.
 */
class BridgeViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = undefined;
        this._activeProcess = undefined;
    }

    /**
     * Chamado pelo VS Code quando a visão lateral é renderizada pela primeira vez.
     */
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, '.bridge', 'ui'),
                vscode.workspace.workspaceFolders?.[0].uri
            ]
        };

        // Escutar mensagens vindas da Webview -> Enviar para o Pipeline
        webviewView.webview.onDidReceiveMessage(data => {
            if (this._activeProcess) {
                this._activeProcess.send({ type: 'UI_EVENT', data });
            }
        });

        // Limpar processo se a view for destruída
        webviewView.onDidDispose(() => {
            this.killActiveProcess();
        });
    }

    /**
     * Renderiza um componente HTML na visão lateral.
     */
    render(componentName, payload, workspaceRoot) {
        if (!this._view) {
            // Se a view não estiver visível, tentamos focar nela primeiro
            vscode.commands.executeCommand('bridgeView.focus');
        }

        // Aguardamos um breve momento para garantir que a view foi resolvida
        setTimeout(() => {
            if (!this._view) return;

            const uiPath = path.join(workspaceRoot, '.bridge', 'ui');
            const htmlPath = path.join(uiPath, `${componentName}.html`);

            if (fs.existsSync(htmlPath)) {
                let html = fs.readFileSync(htmlPath, 'utf8');
                
                // Converter caminhos locais para URIs compatíveis com Webview
                const baseUri = this._view.webview.asWebviewUri(vscode.Uri.file(uiPath));
                html = html.replace(/src="\.\//g, `src="${baseUri}/`);
                html = html.replace(/href="\.\//g, `href="${baseUri}/`);

                this._view.webview.html = html;

                // Hidratação inicial
                setTimeout(() => {
                    this._view.webview.postMessage({ type: 'HYDRATE', payload });
                }, 150);
            } else {
                this._view.webview.html = `<h1>Erro: Componente ${componentName}.html não encontrado.</h1>`;
            }
        }, 100);
    }

    postMessage(data) {
        if (this._view) {
            this._view.webview.postMessage(data);
        }
    }

    setActiveProcess(process) {
        this.killActiveProcess();
        this._activeProcess = process;
    }

    killActiveProcess() {
        if (this._activeProcess) {
            this._activeProcess.kill();
            this._activeProcess = undefined;
        }
    }
}

/**
 * Função utilitária para executar um pipeline.
 */
function runPipelineFile(pipelinePath, workspaceRoot, context, provider, eventData = null) {
    const bootstrapperPath = path.join(context.extensionPath, 'internal', 'bootstrapper.js');

    const nodedProcess = fork(bootstrapperPath, [pipelinePath], {
        execPath: process.execPath,
        env: { 
            WORKSPACE_ROOT: workspaceRoot,
            BRIDGE_EVENT_PAYLOAD: JSON.stringify(eventData) // Passa os dados do evento via ENV
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    provider.setActiveProcess(nodedProcess);

    nodedProcess.on('message', (message) => {
        switch (message.type) {
            case 'UI_RENDER':
                provider.render(message.component, message.payload, workspaceRoot);
                break;
            case 'UI_POST_MESSAGE':
                provider.postMessage(message.data);
                break;
            case 'LOG':
                console.log(`[Bridge]: ${message.data}`);
                break;
        }
    });
}

function activate(context) {
    console.log('Bridge Anchored Host Ativo!');

    const provider = new BridgeViewProvider(context.extensionUri);

    // Registrar o Provider na visão lateral
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('bridgeView', provider)
    );

    // Comando para abrir/focar na visão do Bridge
    let openViewCommand = vscode.commands.registerCommand('bridge.openView', () => {
        vscode.commands.executeCommand('bridgeView.focus');
    });

    // Comando para rodar o Pipeline com listagem automática
    let runCommand = vscode.commands.registerCommand('bridge.runPipeline', async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const pipelinesDir = path.join(workspaceRoot, '.bridge', 'pipelines');

        if (!fs.existsSync(pipelinesDir)) {
            vscode.window.showErrorMessage('Pasta .bridge/pipelines/ não encontrada.');
            return;
        }

        const files = fs.readdirSync(pipelinesDir).filter(f => f.endsWith('.js'));

        if (files.length === 0) {
            vscode.window.showWarningMessage('Nenhum pipeline encontrado em .bridge/pipelines/');
            return;
        }

        const selectedPipeline = await vscode.window.showQuickPick(files, {
            placeHolder: 'Selecione o pipeline que deseja executar',
            title: 'Bridge: Executar Pipeline'
        });

        if (!selectedPipeline) return;

        runPipelineFile(path.join(pipelinesDir, selectedPipeline), workspaceRoot, context, provider);
    });

    // IMPLEMENTAÇÃO DE TRIGGER: onDidSaveTextDocument
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const pipelinesDir = path.join(workspaceRoot, '.bridge', 'pipelines');
        if (!fs.existsSync(pipelinesDir)) return;

        const files = fs.readdirSync(pipelinesDir).filter(f => f.endsWith('.js'));
        
        // Regex simples para identificar se o pipeline possui o trigger 'onSave'
        const triggerRegex = /trigger:\s*['"]onSave['"]/;

        for (const file of files) {
            const filePath = path.join(pipelinesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            if (triggerRegex.test(content)) {
                runPipelineFile(filePath, workspaceRoot, context, provider, {
                    fileName: path.basename(document.fileName),
                    time: new Date().toLocaleTimeString()
                });
            }
        }
    });

    context.subscriptions.push(openViewCommand, runCommand, onSaveListener);
}

function deactivate() {}

module.exports = { activate, deactivate };