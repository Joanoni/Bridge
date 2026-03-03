const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

let bridgeContext;

/**
 * Gets the root path of the current VS Code workspace.
 * @returns {string|null}
 */
function getWorkspaceRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
}

/**
 * Recursively finds all files in a directory.
 * @param {string} dirPath - The directory to scan.
 * @returns {string[]} An array of full file paths.
 */
function getAllFiles(dirPath) {
    let results = [];
    const list = fs.readdirSync(dirPath);
    list.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

/**
 * The core logic for the 'reviewUpdates' command.
 */
async function reviewUpdates() {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot || !bridgeContext) {
        vscode.window.showErrorMessage('Could not determine workspace root or Bridge context.');
        return;
    }

    const sourceDir = path.join(bridgeContext.extensionPath, 'starter-kit-components');
    const destDir = path.join(workspaceRoot, '.bridge', 'components');
    
    try {
        const sourceFiles = getAllFiles(sourceDir);
        let changedFiles = [];

        for (const sourcePath of sourceFiles) {
            const relativePath = path.relative(sourceDir, sourcePath);
            const destPath = path.join(destDir, relativePath);

            if (!fs.existsSync(destPath) || fs.readFileSync(sourcePath, 'utf8') !== fs.readFileSync(destPath, 'utf8')) {
                changedFiles.push({ sourcePath, destPath, relativePath });
            }
        }

        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('Your Bridge starter components are up to date.');
            return;
        }

        let updatedCount = 0;
        for (const file of changedFiles) {
            const userChoice = await vscode.window.showInformationMessage(
                `An update is available for: ${file.relativePath}`,
                { modal: true },
                'Update', 'Skip', 'View Changes'
            );

            if (userChoice === 'View Changes') {
                await vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(file.destPath), vscode.Uri.file(file.sourcePath), `Diff: ${file.relativePath} (Your Version <-> New Version)`);
                // Re-prompt after viewing changes
                const afterDiffChoice = await vscode.window.showInformationMessage(
                    `Apply update for: ${file.relativePath}?`,
                    { modal: true },
                    'Update', 'Skip'
                );
                if (afterDiffChoice === 'Update') {
                    fs.copyFileSync(file.sourcePath, file.destPath);
                    updatedCount++;
                }
            } else if (userChoice === 'Update') {
                fs.copyFileSync(file.sourcePath, file.destPath);
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            const manifestPath = path.join(workspaceRoot, '.bridge', 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.starterKitVersion = bridgeContext.extensionVersion;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');

            vscode.window.showInformationMessage(
                `${updatedCount} component(s) updated successfully. Please reload the window for changes to take full effect.`,
                'Reload Window'
            ).then(selection => {
                if (selection === 'Reload Window') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        } else {
            vscode.window.showInformationMessage('No components were updated.');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to review updates: ${error.message}`);
    }
}

/**
 * Checks for available updates and notifies the user.
 */
async function checkForUpdates() {
    try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot || !bridgeContext) return;

        const currentExtensionVersion = bridgeContext.extensionVersion;
        const manifestPath = path.join(workspaceRoot, '.bridge', 'manifest.json');

        if (!fs.existsSync(manifestPath)) return;

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const workspaceVersion = manifest.starterKitVersion;

        if (semver.gt(currentExtensionVersion, workspaceVersion)) {
            const selection = await vscode.window.showInformationMessage(
                `A new version of the Bridge starter components is available (v${currentExtensionVersion}).`,
                'Review Updates'
            );
            if (selection === 'Review Updates') {
                vscode.commands.executeCommand('bridge.reviewUpdates');
            }
        }
    } catch (error) {
        console.error('Bridge Updater: Failed to check for updates.', error);
    }
}

/**
 * Initializes the Updater component.
 * @param {object} deps - Dependencies injected by the Bridge kernel.
 * @param {object} context - The Bridge context object provided by the kernel.
 * @returns {Promise<object>} The public API for the Updater component.
 */
async function initialize(deps, context) {
    bridgeContext = context;

    const reviewUpdatesCommand = vscode.commands.registerCommand('bridge.reviewUpdates', reviewUpdates);
    context.subscriptions.push(reviewUpdatesCommand);

    checkForUpdates();

    return {};
}

/**
 * Deactivates the component.
 */
function deactivate() {}

module.exports = {
    initialize,
    deactivate,
};