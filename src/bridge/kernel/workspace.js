// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// @BLOCK:START(initializeWorkspace)
/**
 * Command logic for scaffolding a new Bridge workspace.
 * Creates the .bridge directory, subdirectories, and a minimal config.json.
 * @param {vscode.ExtensionContext} context
 */
async function initializeWorkspace(context) {
    // Use the centralized path logic from config.js
    const bridgeRoot = config.getBridgeRoot();
    if (!bridgeRoot) {
        vscode.window.showErrorMessage('Bridge: Please open a folder or workspace before initializing.');
        return;
    }

    const configPath = path.join(bridgeRoot, 'config.json');
    if (fs.existsSync(configPath)) {
        vscode.window.showInformationMessage('Bridge workspace already exists.');
        return;
    }

    try {
        const coresPath = path.join(bridgeRoot, 'cores');
        const servicesPath = path.join(bridgeRoot, 'services');

        fs.mkdirSync(coresPath, { recursive: true });
        fs.mkdirSync(servicesPath, { recursive: true });

        const defaultConfig = {
            cores: {
                path: "./cores",
                approved: []
            },
            services: {
                path: "./services",
                approved: []
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');

        const selection = await vscode.window.showInformationMessage(
            'Bridge workspace initialized successfully! Please reload the window to activate the runtime.',
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
    initializeWorkspace,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)