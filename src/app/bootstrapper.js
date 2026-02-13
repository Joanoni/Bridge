// @BLOCK:START(imports)
const path = require('path');
const buildAppSdk = require('./sdk');
// @BLOCK:END(imports)

// @BLOCK:START(bootstrapper)
/* *
 * ARCHITECTURAL NOTE [Process Boundary]:
 * This script is the first piece of code to run inside the sandboxed child_process.
 * It is completely isolated from the VS Code Extension Host. Its only link is the
 * standard Node.js IPC channel (process.send, process.on('message')).
 * Its primary responsibility is to set up a clean, consistent execution environment
 * for the user's App code.
 */
(function main() {
    try {
        // @BLOCK:START(bootstrapper:setup)
        // 1. Retrieve the App's entry file path from the command line arguments.
        const appScriptPath = process.argv[2];
        if (!appScriptPath) {
            throw new Error('No App script path provided to the bootstrapper.');
        }

        // 2. Extract configuration passed from the Host via environment variables.
        const envConfig = {
            workspaceRoot: process.env.WORKSPACE_ROOT,
            bridgeRoot: process.env.BRIDGE_ROOT,
            appPath: process.env.APP_PATH,
            scriptPath: process.env.SCRIPT_PATH,
            uiPath: process.env.UI_PATH,
            messagePath: process.env.MESSAGE_PATH,
        };
        // @BLOCK:END(bootstrapper:setup)

        // @BLOCK:START(bootstrapper:sdk-injection)
        // 3. Build and inject the global SDK.
        // The `buildAppSdk` function assembles all the necessary modules and APIs.
        global.bridge = buildAppSdk(envConfig);
        // @BLOCK:END(bootstrapper:sdk-injection)
        
        // @BLOCK:START(bootstrapper:app-load)
        // 4. Load and execute the user's App code.
        // We `require` it, which allows the user to use standard Node.js module patterns.
        const appModule = require(appScriptPath);

        // Apps are not required to export anything, but their code will run.
        // If they export functions like `onStart` or `onMessage`, the SDK will handle them.
        console.log(`[Bridge App] Successfully loaded ${path.basename(appScriptPath)}.`);
        // @BLOCK:END(bootstrapper:app-load)

    } catch (err) {
        // @BLOCK:START(bootstrapper:error-handling)
        // If anything fails during bootstrapping, log it to stderr so the Host can see it,
        // and exit with a non-zero code to signal failure.
        console.error(`[Bridge Bootstrapper] Critical error: ${err.message}\n${err.stack}`);
        process.exit(1);
        // @BLOCK:END(bootstrapper:error-handling)
    }

})();
// @BLOCK:END(bootstrapper)