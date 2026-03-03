const vscode = require('vscode');

let outputChannel;

/**
 * Initializes the Logger component.
 * @param {object} deps - Dependencies injected by the Bridge kernel.
 * @returns {Promise<object>} The public API for the Logger component.
 */
async function initialize(deps) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("Bridge Components");
    }

    const log = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[INFO - ${timestamp}] ${message}`);
    };

    const warn = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[WARN - ${timestamp}] ${message}`);
        outputChannel.show(true); // Preserve focus
    };

    const error = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[ERROR - ${timestamp}] ${message}`);
        outputChannel.show(true); // Preserve focus
    };

    log("Logger component initialized.");

    return {
        log,
        warn,
        error,
    };
}

/**
 * Deactivates the component and disposes of the output channel.
 */
function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
        outputChannel = undefined;
    }
}

module.exports = {
    initialize,
    deactivate,
};