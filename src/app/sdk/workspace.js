// @BLOCK:START(imports)
const crypto = require('crypto');
const fs = require('fs');
// @BLOCK:END(imports)

// @BLOCK:START(initializeWorkspaceApi)
/**
 * Initializes and returns the workspace interaction API for the SDK.
 * This module provides functions for interacting with the VS Code workspace,
 * like reading files, abstracting the complex IPC logic.
 * @param {object} sdk The main SDK object, used to access postMessage and onMessage.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {object} The workspace portion of the SDK.
 */
function initializeWorkspaceApi(sdk, envConfig) {
    // @BLOCK:START(initializeWorkspaceApi:api-construction)
    const workspaceApi = {
        /**
         * Asynchronously reads the content of a file within the workspace.
         * This function handles large files by using a temporary file bridge
         * to avoid overloading the IPC channel.
         * @param {string} filePath The absolute path to the file.
         * @returns {Promise<string>} A promise that resolves with the file content.
         */
        readFile(filePath) {
            // @BLOCK:START(initializeWorkspaceApi:api-construction:readFile-logic)
            return new Promise((resolve, reject) => {
                const requestId = crypto.randomUUID();
                const timeoutDuration = 5000; // 5 seconds

                const timeout = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`[Bridge SDK] readFile request timed out for file: ${filePath}`));
                }, timeoutDuration);

                const unsubscribe = sdk.onMessage('bridge:workspace:readFileResponse', (payload) => {
                    // @BLOCK:START(initializeWorkspaceApi:api-construction:readFile-logic:on-response)
                    if (payload.requestId === requestId) {
                        clearTimeout(timeout);
                        unsubscribe();

                        if (payload.error) {
                            reject(new Error(payload.error));
                        } else if (payload.tempFilePath) {
                            try {
                                // Read the content directly from the temp file provided by the Host.
                                const content = fs.readFileSync(payload.tempFilePath, 'utf8');
                                // Clean up the temporary file.
                                fs.unlinkSync(payload.tempFilePath);
                                resolve(content);
                            } catch (fileError) {
                                reject(new Error(`[Bridge SDK] Failed to read temporary file: ${fileError.message}`));
                            }
                        } else {
                            reject(new Error('[Bridge SDK] Invalid response from Host for readFile request.'));
                        }
                    }
                    // @BLOCK:END(initializeWorkspaceApi:api-construction:readFile-logic:on-response)
                });

                sdk.postMessage('bridge:workspace:readFileRequest', { requestId, filePath });
            });
            // @BLOCK:END(initializeWorkspaceApi:api-construction:readFile-logic)
        },
    };
    // @BLOCK:END(initializeWorkspaceApi:api-construction)

    // @BLOCK:START(initializeWorkspaceApi:return)
    return {
        workspace: workspaceApi,
    };
    // @BLOCK:END(initializeWorkspaceApi:return)
}
// @BLOCK:END(initializeWorkspaceApi)

// @BLOCK:START(exports)
module.exports = initializeWorkspaceApi;
// @BLOCK:END(exports)