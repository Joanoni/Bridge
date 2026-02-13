// @BLOCK:START(imports)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {Object|null} */
let loadedConfig = null;
/** @type {vscode.FileSystemWatcher|null} */
let configWatcher = null;
// @BLOCK:END(module-scope)

// @BLOCK:START(load)
/* *
 * Finds, parses, and resolves paths from the user's .bridge/config.json.
 * This is the foundational step for the extension's activation.
 * @returns {Promise<Object|null>}
 */
async function load() {
    // @BLOCK:START(load:execution)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const bridgeRoot = path.join(workspaceRoot, '.bridge');
    const configPath = path.join(bridgeRoot, 'config.json');

    try {
        if (!fs.existsSync(configPath)) {
            return null;
        }

        const rawConfig = fs.readFileSync(configPath, 'utf8');
        const userConfig = JSON.parse(rawConfig);

        // @BLOCK:START(load:execution:resolve-paths)
        // Resolve relative paths from the config into absolute paths for the system.
        // This is a critical step to decouple the rest of the system from the user's custom structure.
        const appPath = path.join(bridgeRoot, userConfig.app.path);
        
        const onStartPath = (userConfig.app.onStart && typeof userConfig.app.onStart === 'string')
            ? path.join(appPath, userConfig.app.onStart)
            : null;

        loadedConfig = {
            workspaceRoot,
            bridgeRoot,
            app: {
                path: appPath,
                onStart: onStartPath,
            },
            script: {
                path: path.join(bridgeRoot, userConfig.script.path),
            },
            ui: {
                path: path.join(bridgeRoot, userConfig.ui.path),
            },
            message: {
                path: path.join(bridgeRoot, userConfig.message.path),
                maxHistory: userConfig.message.maxHistory || 3,
            },
        };
        // @BLOCK:END(load:execution:resolve-paths)

        // Watch for changes in the config file. The safest way to apply changes is to reload.
        setupConfigWatcher(configPath);

        return loadedConfig;

    } catch (error) {
        console.error('Bridge: Error loading config.json', error);
        vscode.window.showErrorMessage(`Failed to load .bridge/config.json: ${error.message}`);
        return null;
    }
    // @BLOCK:END(load:execution)
}
// @BLOCK:END(load)

// @BLOCK:START(setupConfigWatcher)
/* *
 * Sets up a file watcher for the config.json file.
 * @param {string} configPath Absolute path to the config file.
 */
function setupConfigWatcher(configPath) {
    // @BLOCK:START(setupConfigWatcher:execution)
    if (configWatcher) {
        configWatcher.dispose();
    }
    configWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(configPath), path.basename(configPath)));

    configWatcher.onDidChange(() => {
        // @BLOCK:START(setupConfigWatcher:execution:on-change-handler)
        vscode.window.showInformationMessage(
            'Bridge configuration has changed. Please reload the window to apply changes.',
            'Reload Window'
        ).then(selection => {
            if (selection === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
        // @BLOCK:END(setupConfigWatcher:execution:on-change-handler)
    });
    // @BLOCK:END(setupConfigWatcher:execution)
}
// @BLOCK:END(setupConfigWatcher)

// @BLOCK:START(get)
/* *
 * Synchronously returns the currently loaded configuration.
 * @returns {Object|null}
 */
function get() {
    // @BLOCK:START(get:execution)
    return loadedConfig;
    // @BLOCK:END(get:execution)
}
// @BLOCK:END(get)

// @BLOCK:START(deactivate)
/* *
 * Cleans up resources, like the file watcher.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    if (configWatcher) {
        configWatcher.dispose();
    }
    loadedConfig = null;
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    load,
    get,
    deactivate,
};
// @BLOCK:END(exports)