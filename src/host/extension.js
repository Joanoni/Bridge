// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const kernel = require('../bridge/kernel');

let outputChannel;

/* *
 * Main activation function for the Bridge extension.
 * This function now acts as a minimal bootloader, delegating all logic
 * to the new microkernel.
 * @param {vscode.ExtensionContext} context The extension context provided by VS Code.
 */
async function activate(context) {
    outputChannel = vscode.window.createOutputChannel("Bridge");
    outputChannel.appendLine("[Bridge] Activating extension...");

    try {
        await kernel.initialize(context, outputChannel);
        outputChannel.appendLine("[Bridge] Kernel initialized successfully.");
    } catch (error) {
        const errorMessage = `Critical activation error: ${error.message}`;
        outputChannel.appendLine(`[Bridge] ${errorMessage}\n${error.stack}`);
        vscode.window.showErrorMessage(`Bridge failed to activate: ${error.message}`);
    }
}

/* *
 * Deactivation function. Delegates cleanup to the kernel.
 */
function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine("[Bridge] Deactivating extension...");
    }
    kernel.deactivate();
    if (outputChannel) {
        outputChannel.dispose();
    }
}

module.exports = {
    activate,
    deactivate,
};
// @BLOCK:END(Full Artifact)