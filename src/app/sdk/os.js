// @BLOCK:START(imports)
const crypto = require('crypto');
// @BLOCK:END(imports)

// @BLOCK:START(initializeOsApi)
/**
 * Initializes and returns the OS interaction API for the SDK.
 * @param {object} sdk The main SDK object, used to access postMessage and onMessage.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {object} The OS portion of the SDK.
 */
function initializeOsApi(sdk, envConfig) {
    // @BLOCK:START(initializeOsApi:api-construction)
    const osApi = {
        /**
         * Asynchronously retrieves basic OS information from the Host.
         * @returns {Promise<{hostname: string, platform: string}>} A promise that resolves with the OS info.
         */
        getInfo() {
            // @BLOCK:START(initializeOsApi:api-construction:getInfo-logic)
            return new Promise((resolve, reject) => {
                const requestId = crypto.randomUUID();
                const timeoutDuration = 5000; // 5 seconds

                const timeout = setTimeout(() => {
                    unsubscribe();
                    reject(new Error('[Bridge SDK] getInfo request timed out.'));
                }, timeoutDuration);

                const unsubscribe = sdk.onMessage('bridge:os:getInfoResponse', (payload) => {
                    // @BLOCK:START(initializeOsApi:api-construction:getInfo-logic:on-response)
                    if (payload.requestId === requestId) {
                        clearTimeout(timeout);
                        unsubscribe();
                        if (payload.error) {
                            reject(new Error(`[Bridge SDK] Host failed to get OS info: ${payload.error}`));
                        } else {
                            resolve({
                                hostname: payload.hostname,
                                platform: payload.platform,
                            });
                        }
                    }
                    // @BLOCK:END(initializeOsApi:api-construction:getInfo-logic:on-response)
                });

                sdk.postMessage('bridge:os:getInfoRequest', { requestId });
            });
            // @BLOCK:END(initializeOsApi:api-construction:getInfo-logic)
        },
    };
    // @BLOCK:END(initializeOsApi:api-construction)

    // @BLOCK:START(initializeOsApi:return)
    return {
        os: osApi,
    };
    // @BLOCK:END(initializeOsApi:return)
}
// @BLOCK:END(initializeOsApi)

// @BLOCK:START(exports)
module.exports = initializeOsApi;
// @BLOCK:END(exports)