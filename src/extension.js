// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const bootstrapper = require('./bridge/bootstrapper');

let outputChannel;

/* *
 * Main activation function for the Bridge extension.
 * This function now acts as a minimal bootloader, delegating all logic
 * to the component platform bootstrapper.
 * @param {vscode.ExtensionContext} context The extension context provided by VS Code.
 */
async function activate(context) {
    outputChannel = vscode.window.createOutputChannel("Bridge");
    outputChannel.appendLine("[Bridge] Activating extension...");

    try {
        await bootstrapper.initialize(context, outputChannel);
        outputChannel.appendLine("[Bridge] Platform initialized successfully.");
    } catch (error) {
        const errorMessage = `Critical activation error: ${error.message}`;
        outputChannel.appendLine(`[Bridge] ${errorMessage}\n${error.stack}`);
        vscode.window.showErrorMessage(`Bridge failed to activate: ${error.message}`);
    }
}

/* *
 * Deactivation function. Delegates cleanup to the bootstrapper.
 */
function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine("[Bridge] Deactivating extension...");
    }
    bootstrapper.deactivate();
    if (outputChannel) {
        outputChannel.dispose();
    }
}

module.exports = {
    activate,
    deactivate,
};
// @BLOCK:END(Full Artifact)