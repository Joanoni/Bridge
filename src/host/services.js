// @BLOCK:START(imports)
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {import('./messageBus')} */
let messageBus = null;
/** @type {vscode.OutputChannel} */
let outputChannel = null;
/** @type {string|null} */
let tempDir = null;
// @BLOCK:END(module-scope)

// @BLOCK:START(initialize)
/* *
 * Initializes the Host's core services module.
 * @param {import('./messageBus')} bus The central message bus.
 * @param {vscode.ExtensionContext} context The extension context for storage.
 * @param {vscode.OutputChannel} channel The output channel for logging.
 */
function initialize(bus, context, channel) {
    // @BLOCK:START(initialize:execution)
    messageBus = bus;
    outputChannel = channel;

    // Create a dedicated temporary directory for Bridge file operations.
    // Using globalStorageUri is the correct, robust way to handle extension storage.
    tempDir = path.join(context.globalStorageUri.fsPath, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    outputChannel.appendLine(`[Services] Temporary directory initialized at: ${tempDir}`);
    // @BLOCK:END(initialize:execution)
}
// @BLOCK:END(initialize)

// @BLOCK:START(handleMessage)
/* *
 * Handles incoming messages from the bus that are service requests.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
async function handleMessage(event, payload) {
    // @BLOCK:START(handleMessage:execution)
    switch (event) {
        case 'bridge:workspace:readFileRequest':
            // @BLOCK:START(handleMessage:execution:case-readFile)
            await handleReadFileRequest(payload);
            // @BLOCK:END(handleMessage:execution:case-readFile)
            break;
        case 'bridge:os:getInfoRequest':
            // @BLOCK:START(handleMessage:execution:case-getInfo)
            await handleGetInfoRequest(payload);
            // @BLOCK:END(handleMessage:execution:case-getInfo)
            break;
    }
    // @BLOCK:END(handleMessage:execution)
}
// @BLOCK:END(handleMessage)

// @BLOCK:START(handleReadFileRequest)
/* *
 * Handles a request to read a file from an App.
 * @param {object} payload The request payload.
 */
async function handleReadFileRequest(payload) {
    // @BLOCK:START(handleReadFileRequest:execution)
    const { requestId, filePath } = payload;
    if (!requestId || !filePath) return;

    try {
        outputChannel.appendLine(`[Services] Handling readFile request for: ${filePath}`);
        const uri = vscode.Uri.file(filePath);

        // Use the safe, integrated VS Code FS API to read the file content.
        const content = await vscode.workspace.fs.readFile(uri);

        // Create a unique temporary file to bridge the content to the App process.
        const tempFileName = `${requestId}-${path.basename(filePath)}.tmp`;
        const tempFilePath = path.join(tempDir, tempFileName);

        fs.writeFileSync(tempFilePath, content);

        // Respond with the path to the temporary file.
        messageBus.postMessage('bridge:workspace:readFileResponse', {
            requestId,
            tempFilePath,
        });

    } catch (error) {
        outputChannel.appendLine(`[Services] Error handling readFile request for ${filePath}: ${error.message}`);
        // Respond with an error message.
        messageBus.postMessage('bridge:workspace:readFileResponse', {
            requestId,
            error: `Failed to read file '${filePath}': ${error.message}`,
        });
    }
    // @BLOCK:END(handleReadFileRequest:execution)
}
// @BLOCK:END(handleReadFileRequest)

// @BLOCK:START(handleGetInfoRequest)
/* *
 * Handles a request for OS information from an App.
 * @param {object} payload The request payload.
 */
async function handleGetInfoRequest(payload) {
    // @BLOCK:START(handleGetInfoRequest:execution)
    const { requestId } = payload;
    if (!requestId) return;

    try {
        outputChannel.appendLine(`[Services] Handling getInfo request.`);
        const hostname = os.hostname();
        const platform = os.platform();

        messageBus.postMessage('bridge:os:getInfoResponse', {
            requestId,
            hostname,
            platform,
        });

    } catch (error) {
        outputChannel.appendLine(`[Services] Error handling getInfo request: ${error.message}`);
        messageBus.postMessage('bridge:os:getInfoResponse', {
            requestId,
            error: `Failed to get OS info: ${error.message}`,
        });
    }
    // @BLOCK:END(handleGetInfoRequest:execution)
}
// @BLOCK:END(handleGetInfoRequest)

// @BLOCK:START(deactivate)
/* *
 * Cleans up the temporary directory.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        outputChannel.appendLine(`[Services] Cleaned up temporary directory.`);
    }
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    handleMessage,
    deactivate,
};
// @BLOCK:END(exports)