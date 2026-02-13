// @BLOCK:START(imports)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {import('./configManager').get} */
let config = null;
/** @type {vscode.OutputChannel} */
let outputChannel = null;
/**
 * A map of active processes, keyed by PID.
 * The value is an object containing the process instance and its source file path.
 * @type {Map<number, {process: import('child_process').ChildProcess, path: string}>}
 */
const activeProcesses = new Map();
// @BLOCK:END(module-scope)

// @BLOCK:START(initialize)
/**
 * Initializes the Process Manager.
 * @param {import('./configManager').get} appConfig The loaded application configuration.
 * @param {vscode.OutputChannel} channel The output channel for logging.
 */
function initialize(appConfig, channel) {
    // @BLOCK:START(initialize:execution)
    config = appConfig;
    outputChannel = channel;
    // @BLOCK:END(initialize:execution)
}
// @BLOCK:END(initialize)

// @BLOCK:START(handleMessage)
/**
 * Handles incoming messages from the central message bus that are relevant to the Process Manager.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
function handleMessage(event, payload) {
    // @BLOCK:START(handleMessage:execution)
    const messageBus = require('./messageBus'); // Late require for responses
    switch (event) {
        case 'bridge:app:start':
            // @BLOCK:START(handleMessage:execution:case-app-start)
            if (payload && payload.appName) {
                startAppByName(payload.appName);
            }
            // @BLOCK:END(handleMessage:execution:case-app-start)
            break;

        case 'bridge:app:stop':
            // @BLOCK:START(handleMessage:execution:case-app-stop)
            if (payload && payload.appName) {
                stopAppByName(payload.appName);
            }
            // @BLOCK:END(handleMessage:execution:case-app-stop)
            break;
        
        case 'vscode:onRename':
            // @BLOCK:START(handleMessage:execution:case-vscode-rename)
            handleFileRename(payload.files);
            // @BLOCK:END(handleMessage:execution:case-vscode-rename)
            break;

        case 'bridge:app:listRunningRequest':
            // @BLOCK:START(handleMessage:execution:case-list-running)
            if (payload && payload.requestId) {
                messageBus.postMessage('bridge:app:listRunningResponse', {
                    requestId: payload.requestId,
                    runningApps: getRunningApps(),
                });
            }
            // @BLOCK:END(handleMessage:execution:case-list-running)
            break;
    }
    // @BLOCK:END(handleMessage:execution)
}
// @BLOCK:END(handleMessage)

// @BLOCK:START(startAppByName)
/**
 * Starts a new App process by its relative file name.
 * @param {string} appName The file name of the app within the configured app path (e.g., 'deploy.js').
 */
function startAppByName(appName) {
    // @BLOCK:START(startAppByName:execution)
    const appPath = path.join(config.app.path, appName);
    if (fs.existsSync(appPath)) {
        startAppByPath(appPath);
    } else {
        const errorMessage = `Attempted to start non-existent App: ${appName}`;
        outputChannel.appendLine(`[Process Manager] ${errorMessage}`);
        vscode.window.showErrorMessage(errorMessage);
    }
    // @BLOCK:END(startAppByName:execution)
}
// @BLOCK:END(startAppByName)

// @BLOCK:START(stopAppByName)
/**
 * Stops a running App process by its file name.
 * @param {string} appName The file name of the app to stop.
 */
function stopAppByName(appName) {
    // @BLOCK:START(stopAppByName:execution)
    for (const [pid, appInfo] of activeProcesses.entries()) {
        if (path.basename(appInfo.path) === appName) {
            outputChannel.appendLine(`[Process Manager] Stopping App: ${appName} (PID: ${pid})`);
            appInfo.process.kill(); // This will trigger the 'exit' event handler for cleanup.
            return;
        }
    }
    outputChannel.appendLine(`[Process Manager] Attempted to stop App that is not running: ${appName}`);
    // @BLOCK:END(stopAppByName:execution)
}
// @BLOCK:END(stopAppByName)

// @BLOCK:START(startAppByPath)
/**
 * Starts a new App process from an absolute file path.
 * @param {string} appPath The absolute path to the App's entry script.
 * @returns {import('child_process').ChildProcess | null} The spawned process or null on failure.
 */
function startAppByPath(appPath) {
    // @BLOCK:START(startAppByPath:execution)
    const bootstrapperPath = path.resolve(__dirname, '../app/bootstrapper.js');

    try {
        // @BLOCK:START(startAppByPath:execution:fork-process)
        const appProcess = fork(bootstrapperPath, [appPath], {
            execPath: process.execPath, // Use VS Code's embedded Node.js
            env: { 
                WORKSPACE_ROOT: config.workspaceRoot,
                BRIDGE_ROOT: config.bridgeRoot,
                APP_PATH: config.app.path,
                SCRIPT_PATH: config.script.path,
                UI_PATH: config.ui.path,
                MESSAGE_PATH: config.message.path,
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        // @BLOCK:END(startAppByPath:execution:fork-process)

        outputChannel.appendLine(`[Process Manager] Starting App: ${path.basename(appPath)} (PID: ${appProcess.pid})`);

        activeProcesses.set(appProcess.pid, { process: appProcess, path: appPath });

        // @BLOCK:START(startAppByPath:execution:lifecycle-handlers)
        // --- Process Lifecycle Handlers ---

        appProcess.stdout.on('data', (data) => outputChannel.append(data.toString()));
        appProcess.stderr.on('data', (data) => outputChannel.append(data.toString()));

        appProcess.on('message', (message) => {
            // @BLOCK:START(startAppByPath:execution:lifecycle-handlers:on-message)
            // Forward messages from Apps to the central message bus.
            // This is the primary way Apps communicate with the Host and other Apps.
            const { event, payload } = message;
            if (event) {
                const messageBus = require('./messageBus'); // Late require to avoid circular dependency
                outputChannel.appendLine(`[Process Manager] Received message from PID ${appProcess.pid}: '${event}'`);
                messageBus.postMessage(event, payload);
            }
            // @BLOCK:END(startAppByPath:execution:lifecycle-handlers:on-message)
        });

        appProcess.on('exit', (code) => {
            // @BLOCK:START(startAppByPath:execution:lifecycle-handlers:on-exit)
            outputChannel.appendLine(`[Process Manager] App exited: ${path.basename(appPath)} (PID: ${appProcess.pid}) with code ${code}`);
            activeProcesses.delete(appProcess.pid);
            // @BLOCK:END(startAppByPath:execution:lifecycle-handlers:on-exit)
        });

        appProcess.on('error', (err) => {
            // @BLOCK:START(startAppByPath:execution:lifecycle-handlers:on-error)
            outputChannel.appendLine(`[Process Manager] App error: ${path.basename(appPath)} (PID: ${appProcess.pid}): ${err.message}`);
            activeProcesses.delete(appProcess.pid);
            // @BLOCK:END(startAppByPath:execution:lifecycle-handlers:on-error)
        });
        // @BLOCK:END(startAppByPath:execution:lifecycle-handlers)

        return appProcess;

    } catch (error) {
        outputChannel.appendLine(`[Process Manager] Failed to fork process for ${appPath}: ${error.message}`);
        return null;
    }
    // @BLOCK:END(startAppByPath:execution)
}
// @BLOCK:END(startAppByPath)

// @BLOCK:START(handleFileRename)
/**
 * Updates the tracked path of a running process if its source file was renamed.
 * @param {Array<{oldPath: string, newPath: string}>} renamedFiles
 */
function handleFileRename(renamedFiles) {
    // @BLOCK:START(handleFileRename:execution)
    for (const file of renamedFiles) {
        for (const appInfo of activeProcesses.values()) {
            if (appInfo.path === file.oldPath) {
                outputChannel.appendLine(`[Process Manager] Tracking renamed App: ${path.basename(file.oldPath)} -> ${path.basename(file.newPath)}`);
                appInfo.path = file.newPath;
                break; 
            }
        }
    }
    // @BLOCK:END(handleFileRename:execution)
}
// @BLOCK:END(handleFileRename)

// @BLOCK:START(broadcast)
/**
 * Sends a message to all active App processes.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
function broadcast(event, payload) {
    // @BLOCK:START(broadcast:execution)
    if (activeProcesses.size === 0) return;

    outputChannel.appendLine(`[Process Manager] Broadcasting message '${event}' to ${activeProcesses.size} processes.`);
    for (const { process } of activeProcesses.values()) {
        process.send({ event, payload });
    }
    // @BLOCK:END(broadcast:execution)
}
// @BLOCK:END(broadcast)

// @BLOCK:START(getRunningApps)
/**
 * Returns a list of filenames for all currently running apps.
 * @returns {string[]}
 */
function getRunningApps() {
    // @BLOCK:START(getRunningApps:execution)
    const appNames = [];
    for (const appInfo of activeProcesses.values()) {
        appNames.push(path.basename(appInfo.path));
    }
    return appNames;
    // @BLOCK:END(getRunningApps:execution)
}
// @BLOCK:END(getRunningApps)

// @BLOCK:START(getAvailableApps)
/**
 * Returns a list of available App filenames from disk.
 * @returns {string[]}
 */
function getAvailableApps() {
    // @BLOCK:START(getAvailableApps:execution)
    if (fs.existsSync(config.app.path)) {
        return fs.readdirSync(config.app.path).filter(f => f.endsWith('.js'));
    }
    return [];
    // @BLOCK:END(getAvailableApps:execution)
}
// @BLOCK:END(getAvailableApps)

// @BLOCK:START(deactivate)
/**
 * Terminates all running App processes.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    outputChannel.appendLine(`[Process Manager] Deactivating. Terminating ${activeProcesses.size} processes.`);
    for (const { process } of activeProcesses.values()) {
        process.kill();
    }
    activeProcesses.clear();
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    handleMessage,
    startAppByName,
    startAppByPath,
    stopAppByName,
    broadcast,
    getAvailableApps,
    deactivate,
};
// @BLOCK:END(exports)