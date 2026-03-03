const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Copies files and directories recursively.
 * @param {string} src The source path.
 * @param {string} dest The destination path.
 */
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(
                path.join(src, childItemName),
                path.join(dest, childItemName)
            );
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

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
    const configPath = path.join(bridgeRoot, 'config.json');

    if (fs.existsSync(configPath)) {
        vscode.window.showInformationMessage('Bridge workspace already exists.');
        return;
    }

    try {
        // 1. Create the required directories
        const componentsDestPath = path.join(bridgeRoot, 'components');
        fs.mkdirSync(componentsDestPath, { recursive: true });

        // 2. Write the default config.json
        const defaultConfig = {
            "components": {
                "paths": [
                    "./components"
                ]
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');

        // 3. Copy starter kit components
        const starterKitSourcePath = path.join(context.extensionPath, 'starter-kit-components');
        copyRecursiveSync(starterKitSourcePath, componentsDestPath);

        // 4. Create the workspace manifest with the extension version
        const extensionPackageJson = require(path.join(context.extensionPath, 'package.json'));
        const currentVersion = extensionPackageJson.version;
        const manifestPath = path.join(bridgeRoot, 'manifest.json');
        const manifestContent = {
            "starterKitVersion": currentVersion
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 4), 'utf8');

        // 5. Notify user and prompt for reload
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

module.exports = {
    getWorkspaceRoot,
    initializeWorkspace,
};