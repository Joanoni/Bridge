// @BLOCK:START(imports)
const vscode = require('vscode');
const configManager = require('./configManager');
const messageBus = require('./messageBus');
const processManager = require('./processManager');
const uiManager = require('./uiManager');
const vscodeListeners = require('./vscodeListeners');
const services = require('./services'); // Import the new services module
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
let outputChannel;
// @BLOCK:END(module-scope)

// @BLOCK:START(activate)
/* *
 * Main activation function for the Bridge extension.
 * This function acts as an orchestrator, initializing and wiring together all the core modules.
 * @param {vscode.ExtensionContext} context The extension context provided by VS Code.
 */
async function activate(context) {
    // @BLOCK:START(activate:initial-setup)
    outputChannel = vscode.window.createOutputChannel("Bridge");
    outputChannel.appendLine("[Bridge Host] Activating...");
    // @BLOCK:END(activate:initial-setup)

    try {
        // @BLOCK:START(activate:initialization-sequence)
        // 1. Load configuration first, as it's required by all other modules.
        const config = await configManager.load();
        if (!config) {
            vscode.window.showErrorMessage('Bridge configuration (.bridge/config.json) not found or is invalid. Extension will not activate.');
            return;
        }

        // 2. Initialize the core Message Bus.
        messageBus.initialize(config, outputChannel);

        // 3. Initialize managers that depend on the config and bus.
        processManager.initialize(config, outputChannel);
        uiManager.initialize(context, config, outputChannel);
        services.initialize(messageBus, context, outputChannel); // Initialize services

        // 4. Wire the managers to the message bus for broadcasting and handling.
        messageBus.onMessage((event, payload) => {
            // @BLOCK:START(activate:initialization-sequence:on-message-handler)
            // Broadcast outgoing messages TO Apps and UIs
            processManager.broadcast(event, payload);
            uiManager.broadcast(event, payload);

            // Handle incoming messages FROM the bus that require Host action
            processManager.handleMessage(event, payload);
            uiManager.handleMessage(event, payload);
            services.handleMessage(event, payload); // Wire in the service handler
            // @BLOCK:END(activate:initialization-sequence:on-message-handler)
        });

        // 5. Connect VS Code native events to the message bus.
        vscodeListeners.initialize(messageBus, config);

        // 6. Register commands that interact with the managers.
        // @BLOCK:START(activate:initialization-sequence:register-commands)
        context.subscriptions.push(
            vscode.commands.registerCommand('bridge.runApp', async () => {
                // @BLOCK:START(activate:initialization-sequence:register-commands:run-app-logic)
                const appName = await vscode.window.showQuickPick(processManager.getAvailableApps(), {
                    placeHolder: 'Select an App to run',
                });
                if (appName) {
                    processManager.startAppByName(appName);
                }
                // @BLOCK:END(activate:initialization-sequence:register-commands:run-app-logic)
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand('bridge.focusSidebar', () => uiManager.focus('sidebar')));
        context.subscriptions.push(vscode.commands.registerCommand('bridge.focusBottombar', () => uiManager.focus('bottombar')));
        // @BLOCK:END(activate:initialization-sequence:register-commands)

        // 7. Execute the onStart App defined in the configuration.
        if (config.app.onStart) {
            outputChannel.appendLine(`[Bridge Host] Running onStart App: ${config.app.onStart}`);
            processManager.startAppByPath(config.app.onStart);
        }

        outputChannel.appendLine("[Bridge Host] Activated successfully.");
        // @BLOCK:END(activate:initialization-sequence)

    } catch (error) {
        // @BLOCK:START(activate:error-handling)
        outputChannel.appendLine(`[Bridge Host] Critical activation error: ${error.message}`);
        vscode.window.showErrorMessage(`Bridge failed to activate: ${error.message}`);
        // @BLOCK:END(activate:error-handling)
    }
}
// @BLOCK:END(activate)

// @BLOCK:START(deactivate)
/* *
 * Deactivation function. Cleans up all resources.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    processManager.deactivate();
    uiManager.deactivate();
    vscodeListeners.deactivate();
    services.deactivate(); // Also deactivate services
    messageBus.deactivate();
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