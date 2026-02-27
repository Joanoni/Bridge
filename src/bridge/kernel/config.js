// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// @BLOCK:START(getWorkspaceRoot)
/**
 * Gets the root path of the current VS Code workspace.
 * This is now the single source of truth for the workspace path.
 * @returns {string|null}
 */
function getWorkspaceRoot() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}
// @BLOCK:END(getWorkspaceRoot)

// @BLOCK:START(getBridgeRoot)
/**
 * Finds the root .bridge directory in the current workspace.
 * @param {boolean} [checkConfig=false] - If true, only returns the path if config.json exists.
 * @returns {string|null} The absolute path to the .bridge directory or null if not found.
 */
function getBridgeRoot(checkConfig = false) {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return null;

    const bridgeRoot = path.join(workspaceRoot, '.bridge');

    if (checkConfig) {
        const configPath = path.join(bridgeRoot, 'config.json');
        return fs.existsSync(configPath) ? bridgeRoot : null;
    }

    return bridgeRoot;
}
// @BLOCK:END(getBridgeRoot)

// @BLOCK:START(readConfig)
/**
 * Reads and parses the .bridge/config.json file.
 * @returns {object|null} The parsed config object or null if not found/invalid.
 */
function readConfig() {
    // We need to check for config.json's existence to read it.
    const bridgeRoot = getBridgeRoot(true);
    if (!bridgeRoot) return null;

    const configPath = path.join(bridgeRoot, 'config.json');
    try {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(rawConfig);
    } catch (error) {
        return null;
    }
}
// @BLOCK:END(readConfig)

// @BLOCK:START(writeConfig)
/**
 * Writes an object to the .bridge/config.json file.
 * @param {object} configData The config object to write.
 * @returns {boolean} True on success, false on failure.
 */
function writeConfig(configData) {
    // We don't need config.json to exist to write to it.
    const bridgeRoot = getBridgeRoot();
    if (!bridgeRoot) return false;

    const configPath = path.join(bridgeRoot, 'config.json');
    try {
        const configString = JSON.stringify(configData, null, 4);
        fs.writeFileSync(configPath, configString, 'utf8');
        return true;
    } catch (error) {
        return false;
    }
}
// @BLOCK:END(writeConfig)

// @BLOCK:START(checkPermission)
/**
 * Checks if a module is approved in config.json. If not, prompts the user.
 * @param {string} moduleName The name of the module to check.
 * @param {'core' | 'service'} moduleType The type of the module.
 * @param {import('vscode').OutputChannel} outputChannel The output channel for logging.
 * @returns {Promise<boolean>} True if the module is allowed to run, false otherwise.
 */
async function checkPermission(moduleName, moduleType, outputChannel) {
    const config = readConfig() || {};
    const sectionKey = `${moduleType}s`; // 'cores' or 'services'
    config[sectionKey] = config[sectionKey] || {};
    config[sectionKey].approved = config[sectionKey].approved || [];

    if (config[sectionKey].approved.includes(moduleName)) {
        return true;
    }

    // If not approved, prompt the user.
    const selection = await vscode.window.showWarningMessage(
        `The ${moduleType} '${moduleName}' is not approved to run in this workspace. Running untrusted code can be dangerous.`, {
            modal: true,
            detail: `Do you want to allow this ${moduleType} to run?`
        },
        'Always Allow', 'Run Once'
    );

    if (selection === 'Always Allow') {
        outputChannel.appendLine(`[Config] User permanently approved ${moduleType} '${moduleName}'.`);
        config[sectionKey].approved.push(moduleName);
        writeConfig(config);
        return true;
    }

    if (selection === 'Run Once') {
        outputChannel.appendLine(`[Config] User approved ${moduleType} '${moduleName}' for this session.`);
        return true;
    }

    // This case is reached if the user clicks "Cancel" or closes the dialog.
    outputChannel.appendLine(`[Config] User denied permission for ${moduleType} '${moduleName}'.`);
    return false;
}
// @BLOCK:END(checkPermission)

// @BLOCK:START(exports)
module.exports = {
    getWorkspaceRoot,
    getBridgeRoot,
    checkPermission,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)