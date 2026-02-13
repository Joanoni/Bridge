// @BLOCK:START(exports)
/* *
 * Defines a curated set of safe, common globals to be exposed to the script sandbox (vm).
 * This acts as an "allow-list", ensuring scripts have access to useful tools
 * without compromising the security and isolation of the sandbox.
 *
 * This is the single source of truth for the script execution environment.
 */
module.exports = {
    // Timers
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,

    // URL Parsing
    URL,
    URLSearchParams,

    // Encoding / Decoding
    TextEncoder,
    TextDecoder,

    // Add other safe and common globals here in the future.
    // Intentionally excluded: Buffer, process (partially added in sandbox), etc.

};
// @BLOCK:END(exports)