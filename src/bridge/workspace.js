// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// @BLOCK:START(getWorkspaceRoot)
/**
 * Gets the root path of the current VS Code workspace.
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

// @BLOCK:START(initializeWorkspace)
/**
 * Command logic for scaffolding a new Bridge workspace.
 * Creates the .bridge/components directory and a minimal config.json.
 * @param {vscode.ExtensionContext} context
 */
async function initializeWorkspace(context) {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Bridge: Please open a folder or workspace before initializing.');
        return;
    }

    const bridgeRoot = path.join(workspaceRoot, '.bridge');
    const componentsPath = path.join(bridgeRoot, 'components');
    const configPath = path.join(bridgeRoot, 'config.json');

    if (fs.existsSync(configPath)) {
        vscode.window.showInformationMessage('Bridge workspace already exists.');
        return;
    }

    try {
        fs.mkdirSync(componentsPath, { recursive: true });

        const defaultConfig = {
            "components": {
                "paths": [
                    "./components"
                ]
            },
            "permissions": {
                "approved": []
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');

        const selection = await vscode.window.showInformationMessage(
            'Bridge workspace initialized successfully! Please reload the window to activate the platform.',
            'Reload Window'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Bridge workspace initialization failed: ${error.message}`);
    }
}
// @BLOCK:END(initializeWorkspace)

// @BLOCK:START(exports)
module.exports = {
    getWorkspaceRoot,
    initializeWorkspace,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)