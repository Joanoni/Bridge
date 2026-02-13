// @BLOCK:START(imports)
const initializeMessageApi = require('./message');
const initializeUiApi = require('./ui');
const initializeAppApi = require('./app');
const initializeScriptApi = require('./script');
const initializeWorkspaceApi = require('./workspace');
const initializeOsApi = require('./os'); // Import the new module
// @BLOCK:END(imports)

// @BLOCK:START(buildAppSdk)
/* *
 * Builds the complete SDK object for the App context.
 * This function assembles all available API modules into the global.bridge object.
 * @param {object} envConfig Configuration passed from the Host via environment variables.
 * @returns {object} The fully constructed bridge object.
 */
function buildAppSdk(envConfig) {
    // @BLOCK:START(buildAppSdk:sdk-construction)
    const sdk = {};

    // Initialize each API module and pass a reference to the main sdk object.
    // This allows modules to call each other if necessary (e.g., ui needs to send messages).
    Object.assign(sdk, initializeMessageApi(sdk, envConfig));
    Object.assign(sdk, initializeUiApi(sdk, envConfig));
    Object.assign(sdk, initializeAppApi(sdk, envConfig));
    Object.assign(sdk, initializeScriptApi(sdk, envConfig));
    Object.assign(sdk, initializeWorkspaceApi(sdk, envConfig));
    Object.assign(sdk, initializeOsApi(sdk, envConfig)); // Add the os API

    // Add non-module specific properties
    sdk.workspaceRoot = envConfig.workspaceRoot;

    return sdk;
    // @BLOCK:END(buildAppSdk:sdk-construction)
}
// @BLOCK:END(buildAppSdk)

// @BLOCK:START(buildScriptSdk)
/* *
 * Builds a restricted SDK object for the Script (vm) context.
 * Scripts get a limited, secure API surface.
 * @param {object} payload The payload passed to the script.
 * @returns {object} The restricted bridge object for the script context.
 */
function buildScriptSdk(payload) {
    // @BLOCK:START(buildScriptSdk:sdk-construction)
    // For now, it's a simple object, but this structure allows us to add
    // message passing or other features to scripts in the future in a controlled way.
    const sdk = {
        payload: payload || null,
    };

    return sdk;
    // @BLOCK:END(buildScriptSdk:sdk-construction)
}
// @BLOCK:END(buildScriptSdk)

// @BLOCK:START(exports)
module.exports = buildAppSdk;
module.exports.buildScriptSdk = buildScriptSdk;
// @BLOCK:END(exports)