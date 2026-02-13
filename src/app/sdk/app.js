// @BLOCK:START(imports)
const crypto = require('crypto');
// @BLOCK:END(imports)

// @BLOCK:START(initializeAppApi)
/**
 * Initializes and returns the App management API for the SDK.
 * This module provides functions for controlling the lifecycle of other Apps.
 * @param {object} sdk The main SDK object, used to access postMessage.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {{app: {startApp: Function, stopApp: Function, getRunningApps: Function}}}
 */
function initializeAppApi(sdk, envConfig) {
    // @BLOCK:START(initializeAppApi:api-construction)
    const appApi = {
        /**
         * Requests the Host to start a new App process.
         * @param {string} appName The file name of the app to start (e.g., 'deploy.js').
         */
        startApp(appName) {
            // @BLOCK:START(initializeAppApi:api-construction:startApp-logic)
            if (typeof appName !== 'string' || !appName) {
                console.error('[Bridge SDK] startApp requires a non-empty string for the appName.');
                return;
            }
            sdk.postMessage('bridge:app:start', { appName });
            // @BLOCK:END(initializeAppApi:api-construction:startApp-logic)
        },

        /**
         * Requests the Host to stop a running App process.
         * @param {string} appName The file name of the app to stop (e.g., 'deploy.js').
         */
        stopApp(appName) {
            // @BLOCK:START(initializeAppApi:api-construction:stopApp-logic)
            if (typeof appName !== 'string' || !appName) {
                console.error('[Bridge SDK] stopApp requires a non-empty string for the appName.');
                return;
            }
            sdk.postMessage('bridge:app:stop', { appName });
            // @BLOCK:END(initializeAppApi:api-construction:stopApp-logic)
        },

        /**
         * Asynchronously retrieves a list of all currently running App filenames from the Host.
         * @returns {Promise<string[]>} A promise that resolves with an array of app names.
         */
        getRunningApps() {
            // @BLOCK:START(initializeAppApi:api-construction:getRunningApps-logic)
            return new Promise((resolve, reject) => {
                const requestId = crypto.randomUUID();
                const timeoutDuration = 5000; // 5 seconds

                const timeout = setTimeout(() => {
                    unsubscribe();
                    reject(new Error('[Bridge SDK] getRunningApps request timed out.'));
                }, timeoutDuration);

                const unsubscribe = sdk.onMessage('bridge:app:listRunningResponse', (payload) => {
                    // @BLOCK:START(initializeAppApi:api-construction:getRunningApps-logic:on-response)
                    if (payload.requestId === requestId) {
                        clearTimeout(timeout);
                        unsubscribe();
                        if (payload.error) {
                            reject(new Error(`[Bridge SDK] Host failed to list running apps: ${payload.error}`));
                        } else {
                            resolve(payload.runningApps || []);
                        }
                    }
                    // @BLOCK:END(initializeAppApi:api-construction:getRunningApps-logic:on-response)
                });

                sdk.postMessage('bridge:app:listRunningRequest', { requestId });
            });
            // @BLOCK:END(initializeAppApi:api-construction:getRunningApps-logic)
        },
    };
    // @BLOCK:END(initializeAppApi:api-construction)

    // @BLOCK:START(initializeAppApi:return)
    return {
        app: appApi,
    };
    // @BLOCK:END(initializeAppApi:return)
}
// @BLOCK:END(initializeAppApi)

// @BLOCK:START(exports)
module.exports = initializeAppApi;
// @BLOCK:END(exports)