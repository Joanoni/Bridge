// @BLOCK:START(imports)
// No imports needed for this module.
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/* *
 * A map where the key is the event name and the value is a Set of callback functions.
 * @type {Map<string, Set<Function>>}
 */
const listeners = new Map();
// @BLOCK:END(module-scope)

// @BLOCK:START(initializeMessageApi)
/* *
 * Initializes and returns the message-related API for the SDK.
 * @param {object} sdk The main SDK object.
 * @param {object} envConfig Environment configuration from the Host.
 * @returns {{postMessage: Function, onMessage: Function}}
 */
function initializeMessageApi(sdk, envConfig) {
    // @BLOCK:START(initializeMessageApi:host-listener)
    // Listen for incoming messages from the Host and dispatch them to local listeners.
    process.on('message', (message) => {
        // @BLOCK:START(initializeMessageApi:host-listener:handler)
        const { event, payload } = message;
        if (event && listeners.has(event)) {
            listeners.get(event).forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[Bridge SDK] Error in listener for event '${event}':`, error);
                }
            });
        }
        // @BLOCK:END(initializeMessageApi:host-listener:handler)
    });
    // @BLOCK:END(initializeMessageApi:host-listener)

    // @BLOCK:START(initializeMessageApi:postMessage)
    /**
     * Sends a message from the App to the Host's central Message Bus.
     * @param {string} event The event name (e.g., 'user:deploy:start').
     * @param {object} payload The data payload.
     */
    function postMessage(event, payload) {
        // @BLOCK:START(initializeMessageApi:postMessage:execution)
        if (typeof event !== 'string' || !event) {
            console.error('[Bridge SDK] postMessage requires a non-empty string for the event name.');
            return;
        }
        process.send({ event, payload });
        // @BLOCK:END(initializeMessageApi:postMessage:execution)
    }
    // @BLOCK:END(initializeMessageApi:postMessage)

    // @BLOCK:START(initializeMessageApi:onMessage)
    /**
     * Registers a callback to be executed when a message with a specific event name is received.
     * @param {string} event The event name to listen for.
     * @param {function(object): void} callback The function to execute with the payload.
     * @returns {function(): void} An unsubscribe function.
     */
    function onMessage(event, callback) {
        // @BLOCK:START(initializeMessageApi:onMessage:execution)
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);

        // Return an unsubscribe function for cleanup.
        return () => {
            // @BLOCK:START(initializeMessageApi:onMessage:execution:unsubscribe)
            if (listeners.has(event)) {
                listeners.get(event).delete(callback);
            }
            // @BLOCK:END(initializeMessageApi:onMessage:execution:unsubscribe)
        };
        // @BLOCK:END(initializeMessageApi:onMessage:execution)
    }
    // @BLOCK:END(initializeMessageApi:onMessage)

    // @BLOCK:START(initializeMessageApi:return)
    return {
        postMessage,
        onMessage,
    };
    // @BLOCK:END(initializeMessageApi:return)
}
// @BLOCK:END(initializeMessageApi)

// @BLOCK:START(exports)
module.exports = initializeMessageApi;
// @BLOCK:END(exports)