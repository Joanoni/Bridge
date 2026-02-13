// @BLOCK:START(imports)
const crypto = require('crypto');
// @BLOCK:END(imports)

// @BLOCK:START(initializeUiApi)
/* *
 * Initializes and returns the UI-related API for the SDK.
 * This module provides functions for controlling VS Code's UI surfaces.
 * @param {object} sdk The main SDK object, used to access postMessage and onMessage.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {object} The UI portion of the SDK.
 */
function initializeUiApi(sdk, envConfig) {
    // @BLOCK:START(initializeUiApi:api-construction)
    const uiApi = {
        // --- Static Target IDs ---
        sidebar: 'sidebar',
        bottombar: 'bottombar',

        /**
         * Renders an HTML file into a specified UI target.
         * @param {string} targetId The ID of the UI surface (e.g., sdk.ui.sidebar, or a panelId).
         * @param {string} componentPath The relative path to the HTML file within the user's UI directory.
         */
        render(targetId, componentPath) {
            // @BLOCK:START(initializeUiApi:api-construction:render-logic)
            if (!targetId || !componentPath) {
                console.error('[Bridge SDK] ui.render requires a targetId and a componentPath.');
                return;
            }
            sdk.postMessage('bridge:ui:render', { targetId, componentPath });
            // @BLOCK:END(initializeUiApi:api-construction:render-logic)
        },

        /**
         * Asynchronously requests the Host to create a new WebviewPanel.
         * @param {object} options Options for the panel (e.g., { title: 'My Panel' }).
         * @returns {Promise<string>} A promise that resolves with the unique ID of the created panel.
         */
        createPanel(options) {
            // @BLOCK:START(initializeUiApi:api-construction:createPanel-logic)
            return new Promise((resolve, reject) => {
                const requestId = crypto.randomUUID();
                const timeoutDuration = 5000; // 5 seconds

                const timeout = setTimeout(() => {
                    unsubscribe(); // Clean up the listener
                    reject(new Error(`[Bridge SDK] createPanel request timed out after ${timeoutDuration}ms.`));
                }, timeoutDuration);

                // Subscribe to the response event BEFORE sending the request.
                const unsubscribe = sdk.onMessage('bridge:ui:createPanelResponse', (payload) => {
                    if (payload.requestId === requestId) {
                        clearTimeout(timeout);
                        unsubscribe();
                        if (payload.error) {
                            reject(new Error(`[Bridge SDK] Host failed to create panel: ${payload.error}`));
                        } else {
                            resolve(payload.panelId);
                        }
                    }
                });

                // Now, publish the request event to the main bus.
                sdk.postMessage('bridge:ui:createPanelRequest', { requestId, options });
            });
            // @BLOCK:END(initializeUiApi:api-construction:createPanel-logic)
        },
    };
    // @BLOCK:END(initializeUiApi:api-construction)

    // @BLOCK:START(initializeUiApi:return)
    return {
        ui: uiApi,
    };
    // @BLOCK:END(initializeUiApi:return)
}
// @BLOCK:END(initializeUiApi)

// @BLOCK:START(exports)
module.exports = initializeUiApi;
// @BLOCK:END(exports)