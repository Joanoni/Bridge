// @BLOCK:START(imports)
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const vmGlobals = require('./vmGlobals'); // Import the curated globals
// @BLOCK:END(imports)

// @BLOCK:START(initializeScriptApi)
/**
 * Initializes and returns the Script execution API for the SDK.
 * @param {object} sdk The main SDK object.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {{runScript: Function}}
 */
function initializeScriptApi(sdk, envConfig) {
    // @BLOCK:START(initializeScriptApi:runScript)
    /**
     * Executes a user-defined script in a sandboxed V8 VM context.
     * @param {string} scriptName The relative path/name of the script file.
     * @param {object} [payload=null] Data to be made available to the script via bridge.payload.
     * @returns {Promise<any>} A promise that resolves with the return value of the script.
     */
    async function runScript(scriptName, payload = null) {
        // @BLOCK:START(initializeScriptApi:runScript:validation)
        const scriptPath = path.join(envConfig.scriptPath, scriptName);

        if (!fs.existsSync(scriptPath)) {
            const error = new Error(`Script not found: ${scriptName}`);
            console.error(`[Bridge SDK] ${error.message}`);
            throw error;
        }
        // @BLOCK:END(initializeScriptApi:runScript:validation)

        try {
            // @BLOCK:START(initializeScriptApi:runScript:execution)
            const scriptCode = fs.readFileSync(scriptPath, 'utf8');

            // Wrap the user's code in an async IIFE to allow top-level await and return.
            const wrappedCode = `(async () => {
                ${scriptCode}
            })();`;

            // Late require to break the circular dependency with sdk/index.js.
            const { buildScriptSdk } = require('./index');

            // Build the limited SDK for the script context.
            const scriptBridge = buildScriptSdk(payload);

            // @BLOCK:START(initializeScriptApi:runScript:execution:prepare-sandbox)
            // Create a secure sandbox for the script.
            const sandbox = {
                ...vmGlobals, // Spread the curated, safe globals into the context.
                bridge: scriptBridge,
                console: console,
                require: require,
                __dirname: path.dirname(scriptPath),
                process: {
                    env: process.env
                },
            };
            // @BLOCK:END(initializeScriptApi:runScript:execution:prepare-sandbox)

            const context = vm.createContext(sandbox);
            const script = new vm.Script(wrappedCode, { filename: scriptName });

            // The result of the IIFE (from the script's return statement) is the result of the promise.
            return await script.runInContext(context);
            // @BLOCK:END(initializeScriptApi:runScript:execution)

        } catch (error) {
            // @BLOCK:START(initializeScriptApi:runScript:error-handling)
            console.error(`[Bridge SDK] Error executing script '${scriptName}':`, error);
            // Re-throw the error to allow the calling App to handle it.
            throw error;
            // @BLOCK:END(initializeScriptApi:runScript:error-handling)
        }
    }
    // @BLOCK:END(initializeScriptApi:runScript)

    // @BLOCK:START(initializeScriptApi:return)
    return {
        runScript,
    };
    // @BLOCK:END(initializeScriptApi:return)
}
// @BLOCK:END(initializeScriptApi)

// @BLOCK:START(exports)
module.exports = initializeScriptApi;
// @BLOCK:END(exports)