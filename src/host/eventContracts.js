// @BLOCK:START(Full Artifact)
/* *
 * SINGLE SOURCE OF TRUTH
 * This module defines the complete communication contract for the Bridge runtime.
 * All event strings used for messaging between the Host, Apps, and UIs are
 * centralized here to prevent "magic strings" and enable type-safe contracts.
 *
 * The nested structure allows for logical grouping of events by their domain.
 * Example: bridge.events.app.start
 */
const events = {
    app: {
        start: 'bridge:app:start',
        stop: 'bridge:app:stop',
        listRunningRequest: 'bridge:app:listRunningRequest',
        listRunningResponse: 'bridge:app:listRunningResponse',
    },
    ui: {
        render: 'bridge:ui:render',
        createPanelRequest: 'bridge:ui:createPanelRequest',
        createPanelResponse: 'bridge:ui:createPanelResponse',
    },
    workspace: {
        readFileRequest: 'bridge:workspace:readFileRequest',
        readFileResponse: 'bridge:workspace:readFileResponse',
    },
    os: {
        getInfoRequest: 'bridge:os:getInfoRequest',
        getInfoResponse: 'bridge:os:getInfoResponse',
    },
    vscode: {
        onSave: 'vscode:onSave',
        onRename: 'vscode:onRename',
    },
};

module.exports = events;
// @BLOCK:END(Full Artifact)