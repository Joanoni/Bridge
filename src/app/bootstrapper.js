// @BLOCK:START(Full Artifact)
const path = require('path');
const buildAppSdk = require('./sdk');
// @BLOCK:END(Full Artifact)

// @BLOCK:START(start)
/**
 * The main application logic, executed only after receiving configuration from the Host.
 * @param {object} appConfig The configuration payload from the Host, including event contracts.
 */
function start(appConfig) {
    try {
        // @BLOCK:START(start:setup)
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
        // @BLOCK:END(start:setup)

        // @BLOCK:START(start:sdk-injection)
        // 3. Build and inject the global SDK, now including the event contracts.
        global.bridge = buildAppSdk(envConfig, appConfig);
        // @BLOCK:END(start:sdk-injection)
        
        // @BLOCK:START(start:app-load)
        // 4. Load and execute the user's App code.
        const appModule = require(appScriptPath);

        // Apps are not required to export anything, but their code will run.
        console.log(`[Bridge App] Successfully loaded ${path.basename(appScriptPath)}.`);
        // @BLOCK:END(start:app-load)

    } catch (err) {
        // @BLOCK:START(start:error-handling)
        // If anything fails during bootstrapping, log it to stderr so the Host can see it,
        // and exit with a non-zero code to signal failure.
        console.error(`[Bridge Bootstrapper] Critical error: ${err.message}\n${err.stack}`);
        process.exit(1);
        // @BLOCK:END(start:error-handling)
    }
}
// @BLOCK:END(start)

// @BLOCK:START(bootstrap)
/* *
 * ARCHITECTURAL NOTE [Process Boundary & Handshake]:
 * This script is the first piece of code to run inside the sandboxed child_process.
 * It does not execute the App immediately. Instead, it waits for an 'INIT' message
 * from the Host process. This message contains essential runtime configuration,
 * such as the event contracts, which are necessary to build the SDK.
 * This handshake ensures the App is fully configured before any user code runs.
 */
(function bootstrap() {
    const BOOTSTRAP_TIMEOUT = 5000; // 5 seconds

    const timeout = setTimeout(() => {
        console.error('[Bridge Bootstrapper] Critical error: Did not receive INIT message from Host within timeout.');
        process.exit(1);
    }, BOOTSTRAP_TIMEOUT);

    process.once('message', (message) => {
        if (message && message.type === 'INIT') {
            clearTimeout(timeout);
            // Configuration received. Now we can start the main application logic.
            start(message.payload);
        }
    });
})();
// @BLOCK:END(bootstrap)