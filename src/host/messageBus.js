// @BLOCK:START(imports)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {import('./configManager').get} */
let config = null;
/** @type {vscode.OutputChannel} */
let outputChannel = null;
/** @type {Array<Function>} */
const listeners = [];
/* @type {vscode.FileSystemWatcher|null} */
let watcher = null;
// @BLOCK:END(module-scope)

// @BLOCK:START(initialize)
/* *
 * Initializes the Message Bus.
 * @param {import('./configManager').get} appConfig The loaded application configuration.
 * @param {vscode.OutputChannel} channel The output channel for logging.
 */
function initialize(appConfig, channel) {
    // @BLOCK:START(initialize:setup)
    config = appConfig;
    outputChannel = channel;

    // Ensure the root message directory exists.
    fs.mkdirSync(config.message.path, { recursive: true });
    // @BLOCK:END(initialize:setup)

    // @BLOCK:START(initialize:watcher)
    // Watch for new message signals from the filesystem.
    // This is how external events (from Apps or even manual changes) enter the Host's event loop.
    const globPattern = new vscode.RelativePattern(config.message.path, '**/*.signal');
    watcher = vscode.workspace.createFileSystemWatcher(globPattern);

    const onSignal = (uri) => {
        // @BLOCK:START(initialize:watcher:onSignalHandler)
        try {
            const event = pathToEvent(uri.fsPath);
            const dataPath = path.join(path.dirname(uri.fsPath), 'data.json');

            if (fs.existsSync(dataPath)) {
                const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                outputChannel.appendLine(`[Message Bus] Filesystem event detected: '${event}'`);
                broadcast(event, payload);
            }
        } catch (error) {
            outputChannel.appendLine(`[Message Bus] Error processing signal file ${uri.fsPath}: ${error.message}`);
        }
        // @BLOCK:END(initialize:watcher:onSignalHandler)
    };

    watcher.onDidCreate(onSignal);
    watcher.onDidChange(onSignal);
    // @BLOCK:END(initialize:watcher)
}
// @BLOCK:END(initialize)

// @BLOCK:START(postMessage)
/* *
 * Publishes a message to the bus.
 * This involves writing to the filesystem and then notifying internal listeners.
 * @param {string} event The event name (e.g., 'vscode:onSave').
 * @param {object} payload The data payload for the event.
 */
function postMessage(event, payload) {
    // @BLOCK:START(postMessage:execution)
    try {
        const eventPath = eventToPath(event);
        const dataPath = path.join(eventPath, 'data.json');
        const historyPath = path.join(eventPath, 'history');

        fs.mkdirSync(eventPath, { recursive: true });
        fs.mkdirSync(historyPath, { recursive: true });

        // @BLOCK:START(postMessage:execution:history-management)
        // 1. Manage history: move old data.json if it exists.
        if (fs.existsSync(dataPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.renameSync(dataPath, path.join(historyPath, `${timestamp}.json`));

            // 2. Clean up oldest history files if maxHistory is exceeded.
            const historyFiles = fs.readdirSync(historyPath).sort().reverse();
            while (historyFiles.length > config.message.maxHistory) {
                const fileToDelete = historyFiles.pop();
                fs.unlinkSync(path.join(historyPath, fileToDelete));
            }
        }
        // @BLOCK:END(postMessage:execution:history-management)

        // @BLOCK:START(postMessage:execution:write-payload)
        // 3. Write the new data payload.
        fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2));

        // 4. "Touch" the signal file to notify filesystem watchers.
        const signalPath = path.join(eventPath, 'msg.signal');
        const time = new Date();
        try {
            fs.utimesSync(signalPath, time, time);
        } catch (err) {
            fs.closeSync(fs.openSync(signalPath, 'w'));
        }
        // @BLOCK:END(postMessage:execution:write-payload)

    } catch (error) {
        outputChannel.appendLine(`[Message Bus] Failed to post message '${event}': ${error.message}`);
    }
    // @BLOCK:END(postMessage:execution)
}
// @BLOCK:END(postMessage)

// @BLOCK:START(onMessage)
/* *
 * Registers a callback to be invoked when any message is published.
 * This is for internal Host modules to listen to the bus.
 * @param {function(string, object): void} callback The callback function.
 */
function onMessage(callback) {
    // @BLOCK:START(onMessage:execution)
    listeners.push(callback);
    // @BLOCK:END(onMessage:execution)
}
// @BLOCK:END(onMessage)

// @BLOCK:START(broadcast)
/* *
 * Notifies all internal listeners about a new message.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
function broadcast(event, payload) {
    // @BLOCK:START(broadcast:execution)
    for (const listener of listeners) {
        try {
            listener(event, payload);
        } catch (error) {
            outputChannel.appendLine(`[Message Bus] Error in listener for event '${event}': ${error.message}`);
        }
    }
    // @BLOCK:END(broadcast:execution)
}
// @BLOCK:END(broadcast)

// @BLOCK:START(eventToPath)
/* *
 * Converts an event name string into an absolute filesystem path.
 * @param {string} event e.g., 'user:deploy:new'
 * @returns {string} e.g., '/path/to/workspace/.bridge/message/user/deploy/new'
 */
function eventToPath(event) {
    // @BLOCK:START(eventToPath:execution)
    const eventParts = event.split(':');
    return path.join(config.message.path, ...eventParts);
    // @BLOCK:END(eventToPath:execution)
}
// @BLOCK:END(eventToPath)

// @BLOCK:START(pathToEvent)
/* *
 * Converts a filesystem path to a signal file back into an event name string.
 * @param {string} fsPath e.g., '/path/to/workspace/.bridge/message/user/deploy/new/msg.signal'
 * @returns {string} e.g., 'user:deploy:new'
 */
function pathToEvent(fsPath) {
    // @BLOCK:START(pathToEvent:execution)
    const relativePath = path.relative(config.message.path, fsPath);
    const eventParts = path.dirname(relativePath).split(path.sep);
    return eventParts.join(':');
    // @BLOCK:END(pathToEvent:execution)
}
// @BLOCK:END(pathToEvent)

// @BLOCK:START(deactivate)
/* *
 * Cleans up resources on deactivation.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    if (watcher) {
        watcher.dispose();
    }
    listeners.length = 0;
    config = null;
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    postMessage,
    onMessage,
    deactivate,
};
// @BLOCK:END(exports)