// @BLOCK:START(imports)
const vscode = require('vscode');
const path = require('path');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {import('./messageBus')} */
let messageBus = null;
/** @type {import('./configManager').get} */
let config = null;
/** @type {vscode.Disposable[]} */
const subscriptions = [];
// @BLOCK:END(module-scope)

// @BLOCK:START(initialize)
/**
 * Initializes listeners for native VS Code events and connects them to the message bus.
 * This module acts as the bridge between the VS Code environment and the Bridge event system.
 * @param {import('./messageBus')} bus The central message bus.
 * @param {import('./configManager').get} appConfig The loaded application configuration.
 */
function initialize(bus, appConfig) {
    // @BLOCK:START(initialize:setup)
    messageBus = bus;
    config = appConfig;
    // @BLOCK:END(initialize:setup)

    // @BLOCK:START(initialize:onSaveListener)
    // --- onDidSaveTextDocument Listener ---
    const onSaveSubscription = vscode.workspace.onDidSaveTextDocument(document => {
        // @BLOCK:START(initialize:onSaveListener:handler)
        // We must ignore saves that happen inside our own message directory
        // to prevent infinite feedback loops.
        if (document.uri.fsPath.startsWith(config.message.path)) {
            return;
        }

        messageBus.postMessage('vscode:onSave', {
            fileName: path.basename(document.fileName),
            fullPath: document.fileName,
            languageId: document.languageId,
        });
        // @BLOCK:END(initialize:onSaveListener:handler)
    });
    subscriptions.push(onSaveSubscription);
    // @BLOCK:END(initialize:onSaveListener)

    // @BLOCK:START(initialize:onRenameListener)
    // --- onDidRenameFiles Listener ---
    const onRenameSubscription = vscode.workspace.onDidRenameFiles(event => {
        // @BLOCK:START(initialize:onRenameListener:handler)
        const renamedFiles = event.files.map(file => ({
            oldPath: file.oldUri.fsPath,
            newPath: file.newUri.fsPath,
        }));

        if (renamedFiles.length > 0) {
            messageBus.postMessage('vscode:onRename', {
                files: renamedFiles,
            });
        }
        // @BLOCK:END(initialize:onRenameListener:handler)
    });
    subscriptions.push(onRenameSubscription);
    // @BLOCK:END(initialize:onRenameListener)
}
// @BLOCK:END(initialize)

// @BLOCK:START(deactivate)
/**
 * Disposes of all active event listeners.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    for (const subscription of subscriptions) {
        subscription.dispose();
    }
    subscriptions.length = 0;
    messageBus = null;
    config = null;
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    deactivate,
};
// @BLOCK:END(exports)