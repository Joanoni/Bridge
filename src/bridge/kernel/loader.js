// @BLOCK:START(Full Artifact)
const fs = require('fs');
const path = require('path');

// @BLOCK:START(loadModules)
/**
 * Discovers, loads, and validates modules from a given directory.
 * @param {string} directoryPath The absolute path to the directory containing the modules.
 * @param {import('vscode').OutputChannel} outputChannel The output channel for logging.
 * @returns {{name: string, path: string, module: any}[]} An array of valid, loaded modules.
 */
function loadModules(directoryPath, outputChannel) {
    const loadedModules = [];

    if (!fs.existsSync(directoryPath)) {
        outputChannel.appendLine(`[Loader] Directory not found, skipping: ${directoryPath}`);
        return loadedModules;
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        // We are looking for files like `MyModule.core.js` or `MyModule.service.js`
        if (!file.endsWith('.js')) {
            continue;
        }

        const modulePath = path.join(directoryPath, file);
        const moduleName = path.basename(file, path.extname(file));

        try {
            // Clear the cache for the specific module to support re-activation.
            delete require.cache[require.resolve(modulePath)];
            const module = require(modulePath);

            // @BLOCK:START(loadModules:validation)
            // A module is considered valid if it exports an `initialize` function.
            if (typeof module.initialize !== 'function') {
                throw new Error('Module does not export an initialize function.');
            }
            // @BLOCK:END(loadModules:validation)

            loadedModules.push({
                name: moduleName,
                path: modulePath,
                module: module,
            });

        } catch (error) {
            outputChannel.appendLine(`[Loader] Failed to load module '${moduleName}' from ${modulePath}: ${error.message}`);
        }
    }

    return loadedModules;
}
// @BLOCK:END(loadModules)

// @BLOCK:START(exports)
module.exports = {
    loadModules,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)