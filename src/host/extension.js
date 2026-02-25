// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const configManager = require('./configManager');
const messageBus = require('./messageBus');
const processManager = require('./processManager');
const uiManager =require('./uiManager');
const vscodeListeners = require('./vscodeListeners');
const services = require('./services');
const events = require('./eventContracts');
// @BLOCK:END(Full Artifact)

// @BLOCK:START(module-scope)
let outputChannel;
// @BLOCK:END(module-scope)

// @BLOCK:START(activate)
/* *
 * Main activation function for the Bridge extension.
 * @param {vscode.ExtensionContext} context The extension context provided by VS Code.
 */
async function activate(context) {
    // @BLOCK:START(activate:initialization-sequence)
    // 1. Load configuration to determine the extension's state.
    const config = await configManager.load();
    const isInitialized = !!config;

    // 2. Set context for UI visibility (views, keybindings). This is still valuable.
    vscode.commands.executeCommand('setContext', 'bridge.workspaceInitialized', isInitialized);

    // 3. Register all commands, but with internal guards based on the 'isInitialized' state.
    context.subscriptions.push(
        vscode.commands.registerCommand('bridge.initializeWorkspace', () => {
            if (isInitialized) {
                vscode.window.showInformationMessage('Bridge workspace already exists.');
            } else {
                initializeWorkspace(context);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('bridge.runApp', async () => {
            if (!isInitialized) {
                promptToInitialize();
                return;
            }
            const appName = await vscode.window.showQuickPick(processManager.getAvailableApps(), {
                placeHolder: 'Select an App to run',
            });
            if (appName) {
                processManager.startAppByName(appName);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('bridge.focusSidebar', () => {
            if (!isInitialized) {
                promptToInitialize();
                return;
            }
            uiManager.focus('sidebar');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('bridge.focusBottombar', () => {
            if (!isInitialized) {
                promptToInitialize();
                return;
            }
            uiManager.focus('bottombar');
        })
    );

    // 4. If not initialized, stop activation here.
    if (!isInitialized) {
        return;
    }

    // --- Full Runtime Activation ---
    outputChannel = vscode.window.createOutputChannel("Bridge");
    outputChannel.appendLine("[Bridge Host] Activating...");

    try {
        // Initialize all core modules for the full runtime.
        messageBus.initialize(config, outputChannel);
        processManager.initialize(config, outputChannel);
        uiManager.initialize(context, config, outputChannel);
        services.initialize(messageBus, context, outputChannel);
        vscodeListeners.initialize(messageBus, config);

        // Wire the message bus to the core modules.
        messageBus.onMessage((event, payload) => {
            processManager.broadcast(event, payload);
            uiManager.broadcast(event, payload);
            processManager.handleMessage(event, payload);
            uiManager.handleMessage(event, payload);
            services.handleMessage(event, payload);
        });

        // Execute the onStart App.
        if (config.app.onStart) {
            outputChannel.appendLine(`[Bridge Host] Running onStart App: ${config.app.onStart}`);
            processManager.startAppByPath(config.app.onStart);
        }

        outputChannel.appendLine("[Bridge Host] Activated successfully.");

    } catch (error) {
        outputChannel.appendLine(`[Bridge Host] Critical activation error: ${error.message}`);
        vscode.window.showErrorMessage(`Bridge failed to activate: ${error.message}`);
    }
    // @BLOCK:END(activate:initialization-sequence)
}
// @BLOCK:END(activate)

// @BLOCK:START(promptToInitialize)
/**
 * Shows an information message to the user prompting them to initialize the workspace.
 */
async function promptToInitialize() {
    // @BLOCK:START(promptToInitialize:execution)
    const selection = await vscode.window.showInformationMessage(
        'This command requires an initialized Bridge workspace.',
        'Initialize Workspace'
    );
    if (selection === 'Initialize Workspace') {
        vscode.commands.executeCommand('bridge.initializeWorkspace');
    }
    // @BLOCK:END(promptToInitialize:execution)
}
// @BLOCK:END(promptToInitialize)

// @BLOCK:START(initializeWorkspace)
/**
 * Command logic for scaffolding a new Bridge workspace.
 * @param {vscode.ExtensionContext} context 
 */
async function initializeWorkspace(context) {
    // @BLOCK:START(initializeWorkspace:execution)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Bridge: Please open a folder or workspace before initializing.');
        return;
    }

    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("Bridge");
    }
    outputChannel.show();

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const bridgeRoot = path.join(workspaceRoot, '.bridge');

    try {
        outputChannel.appendLine(`[Bridge Host] Initializing new workspace at: ${bridgeRoot}`);
        fs.mkdirSync(bridgeRoot, { recursive: true });

        const templates = ['config.json', 'jsconfig.json', 'bridge.d.ts'];
        for (const templateName of templates) {
            const sourcePath = path.join(context.extensionPath, 'src', 'assets', 'templates', templateName);
            const destPath = path.join(bridgeRoot, templateName);
            fs.copyFileSync(sourcePath, destPath);
        }

        const selection = await vscode.window.showInformationMessage(
            'Bridge workspace initialized successfully! Please reload the window to activate the runtime.',
            'Reload Window'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

    } catch (error) {
        outputChannel.appendLine(`[Bridge Host] Failed to initialize workspace: ${error.message}`);
        vscode.window.showErrorMessage(`Bridge workspace initialization failed: ${error.message}`);
    }
    // @BLOCK:END(initializeWorkspace:execution)
}
// @BLOCK:END(initializeWorkspace)

// @BLOCK:START(deactivate)
/* *
 * Deactivation function. Cleans up all resources.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    if (processManager) processManager.deactivate();
    if (uiManager) uiManager.deactivate();
    if (vscodeListeners) vscodeListeners.deactivate();
    if (services) services.deactivate();
    if (messageBus) messageBus.deactivate();
    if (outputChannel) {
        outputChannel.dispose();
    }
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    activate,
    deactivate,
};
// @BLOCK:END(exports)