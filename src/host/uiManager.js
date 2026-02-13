// @BLOCK:START(imports)
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
// @BLOCK:END(imports)

// @BLOCK:START(module-scope)
/** @type {import('./configManager').get} */
let config = null;
/** @type {vscode.OutputChannel} */
let outputChannel = null;
/** @type {vscode.ExtensionContext} */
let extensionContext = null;

/**
 * A central registry for all active UI surfaces.
 * This allows the Host to be agnostic about whether it's talking to a WVV or a WVP.
 * @type {Map<string, {view: vscode.WebviewView | vscode.WebviewPanel, type: 'wvv' | 'wvp'}>}
 */
const activeInterfaces = new Map();

/**
 * A map to hold readiness promises for static WebviewViews.
 * This solves the race condition where a render call arrives before the view is resolved by VS Code.
 * @type {Map<string, {resolve: Function, promise: Promise<void>}>}
 */
const readinessPromises = new Map();

const UI_SHIM = `<script>
    const vscode = acquireVsCodeApi();
    window.bridge = {
        postMessage: (event, payload) => vscode.postMessage({ event, payload }),
        // onMessage will be handled by a global window event listener in the user's UI code.
    };
</script>`;
// @BLOCK:END(module-scope)

// @BLOCK:START(createReadinessPromise)
/**
 * Creates a readiness promise for a static view.
 * @param {string} id The ID of the view (e.g., 'sidebar').
 */
function createReadinessPromise(id) {
    // @BLOCK:START(createReadinessPromise:execution)
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    readinessPromises.set(id, { resolve, promise });
    // @BLOCK:END(createReadinessPromise:execution)
}
// @BLOCK:END(createReadinessPromise)

// @BLOCK:START(initialize)
/**
 * Initializes the UI Manager.
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {import('./configManager').get} appConfig The loaded application configuration.
 * @param {vscode.OutputChannel} channel The output channel for logging.
 */
function initialize(context, appConfig, channel) {
    // @BLOCK:START(initialize:setup)
    config = appConfig;
    outputChannel = channel;
    extensionContext = context;
    // @BLOCK:END(initialize:setup)

    // @BLOCK:START(initialize:create-promises)
    // Create readiness promises BEFORE registering the providers.
    createReadinessPromise('sidebar');
    createReadinessPromise('bottombar');
    // @BLOCK:END(initialize:create-promises)
    
    // @BLOCK:START(initialize:register-providers)
    // extension.js is now responsible for requiring and creating the providers.
    // This breaks the circular dependency.
    const SidebarProvider = require('./view/sidebarProvider');
    const BottombarProvider = require('./view/bottombarProvider');

    const sidebarProvider = new SidebarProvider(context.extensionUri);
    const bottombarProvider = new BottombarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('bridge.sidebar', sidebarProvider),
        vscode.window.registerWebviewViewProvider('bridge.bottombar', bottombarProvider)
    );
    // @BLOCK:END(initialize:register-providers)
}
// @BLOCK:END(initialize)

// @BLOCK:START(handleMessage)
/**
 * Handles incoming messages from the central message bus that are relevant to the UI Manager.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
function handleMessage(event, payload) {
    // @BLOCK:START(handleMessage:execution)
    const messageBus = require('./messageBus'); // Late require to avoid circular dependency

    switch (event) {
        case 'bridge:ui:createPanelRequest':
            // @BLOCK:START(handleMessage:execution:case-create-panel)
            try {
                const panelId = createWebviewPanel(payload.options);
                // Publish the successful response back to the bus with the original requestId.
                messageBus.postMessage('bridge:ui:createPanelResponse', {
                    requestId: payload.requestId,
                    panelId: panelId,
                });
            } catch (error) {
                // If creation fails, publish an error response.
                messageBus.postMessage('bridge:ui:createPanelResponse', {
                    requestId: payload.requestId,
                    error: error.message,
                });
            }
            // @BLOCK:END(handleMessage:execution:case-create-panel)
            break;

        case 'bridge:ui:render':
            // @BLOCK:START(handleMessage:execution:case-render)
            if (payload && payload.targetId && payload.componentPath) {
                render(payload.targetId, payload.componentPath);
            }
            // @BLOCK:END(handleMessage:execution:case-render)
            break;
    }
    // @BLOCK:END(handleMessage:execution)
}
// @BLOCK:END(handleMessage)

// @BLOCK:START(registerWebviewView)
/**
 * Registers a resolved WebviewView instance with the manager.
 * This is called by the provider's resolveWebviewView method.
 * @param {string} id 'sidebar' or 'bottombar'
 * @param {vscode.WebviewView} view The resolved webview view instance.
 */
function registerWebviewView(id, view) {
    // @BLOCK:START(registerWebviewView:register-instance)
    activeInterfaces.set(id, { view, type: 'wvv' });
    outputChannel.appendLine(`[UI Manager] Registered WebviewView: ${id}`);
    // @BLOCK:END(registerWebviewView:register-instance)

    // @BLOCK:START(registerWebviewView:resolve-promise)
    // Signal that this view is now ready for rendering.
    if (readinessPromises.has(id)) {
        readinessPromises.get(id).resolve();
        outputChannel.appendLine(`[UI Manager] Readiness promise resolved for: ${id}`);
    }
    // @BLOCK:END(registerWebviewView:resolve-promise)

    // @BLOCK:START(registerWebviewView:event-listeners)
    view.onDidDispose(() => {
        // @BLOCK:START(registerWebviewView:event-listeners:on-dispose)
        activeInterfaces.delete(id);
        createReadinessPromise(id); // Re-create the promise for when the view might reappear.
        outputChannel.appendLine(`[UI Manager] Disposed WebviewView: ${id}`);
        // @BLOCK:END(registerWebviewView:event-listeners:on-dispose)
    });

    view.webview.onDidReceiveMessage(message => {
        // @BLOCK:START(registerWebviewView:event-listeners:on-receive-message)
        const { event, payload } = message;
        if (event) {
            const messageBus = require('./messageBus'); // Late require
            outputChannel.appendLine(`[UI Manager] Received message from '${id}': '${event}'`);
            messageBus.postMessage(event, payload);
        }
        // @BLOCK:END(registerWebviewView:event-listeners:on-receive-message)
    });
    // @BLOCK:END(registerWebviewView:event-listeners)
}
// @BLOCK:END(registerWebviewView)

// @BLOCK:START(createWebviewPanel)
/**
 * Creates a dynamic WebviewPanel.
 * @param {object} options Options for the panel, like title.
 * @returns {string} The unique ID of the created panel.
 */
function createWebviewPanel(options = {}) {
    // @BLOCK:START(createWebviewPanel:execution)
    const panelId = `wvp:${new Date().getTime()}`;
    const panel = vscode.window.createWebviewPanel(
        panelId,
        options.title || 'Bridge Panel',
        vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    activeInterfaces.set(panelId, { view: panel, type: 'wvp' });
    outputChannel.appendLine(`[UI Manager] Created WebviewPanel: ${panelId}`);

    // @BLOCK:START(createWebviewPanel:execution:event-listeners)
    panel.onDidDispose(() => {
        // @BLOCK:START(createWebviewPanel:execution:event-listeners:on-dispose)
        activeInterfaces.delete(panelId);
        outputChannel.appendLine(`[UI Manager] Disposed WebviewPanel: ${panelId}`);
        // @BLOCK:END(createWebviewPanel:execution:event-listeners:on-dispose)
    });

    panel.webview.onDidReceiveMessage(message => {
        // @BLOCK:START(createWebviewPanel:execution:event-listeners:on-receive-message)
        const { event, payload } = message;
        if (event) {
            const messageBus = require('./messageBus'); // Late require
            outputChannel.appendLine(`[UI Manager] Received message from '${panelId}': '${event}'`);
            messageBus.postMessage(event, payload);
        }
        // @BLOCK:END(createWebviewPanel:execution:event-listeners:on-receive-message)
    });
    // @BLOCK:END(createWebviewPanel:execution:event-listeners)

    return panelId;
    // @BLOCK:END(createWebviewPanel:execution)
}
// @BLOCK:END(createWebviewPanel)

// @BLOCK:START(render)
/**
 * Renders an HTML component into a target UI surface.
 * @param {string} targetId The ID of the target UI (e.g., 'sidebar', 'wvp:12345').
 * @param {string} componentPath The relative path of the HTML file within the UI directory.
 */
async function render(targetId, componentPath) {
    // @BLOCK:START(render:ensure-readiness)
    // If the target is a static view that isn't registered yet, we need to make it visible
    // to force VS Code to call its resolveWebviewView method.
    if (readinessPromises.has(targetId) && !activeInterfaces.has(targetId)) {
        outputChannel.appendLine(`[UI Manager] Target '${targetId}' is not ready. Forcing focus...`);
        focus(targetId); // This command makes the view visible.
    }

    // Now, wait for it to be ready. If it was already ready, this resolves instantly.
    // If we just focused it, this will wait for the provider to register it.
    if (readinessPromises.has(targetId)) {
        outputChannel.appendLine(`[UI Manager] Awaiting readiness for '${targetId}'...`);
        await readinessPromises.get(targetId).promise;
        outputChannel.appendLine(`[UI Manager] '${targetId}' is ready. Proceeding with render.`);
    }
    // @BLOCK:END(render:ensure-readiness)

    // @BLOCK:START(render:get-target)
    const ui = activeInterfaces.get(targetId);
    if (!ui) {
        outputChannel.appendLine(`[UI Manager] Render failed: No UI found for targetId '${targetId}'`);
        return;
    }
    // @BLOCK:END(render:get-target)

    // @BLOCK:START(render:prepare-html)
    const fullHtmlPath = path.join(config.ui.path, componentPath);
    if (!fs.existsSync(fullHtmlPath)) {
        ui.view.webview.html = `<h1>Bridge Error: UI component not found</h1><p>Path: ${fullHtmlPath}</p>`;
        return;
    }

    let html = fs.readFileSync(fullHtmlPath, 'utf8');
    const baseUri = ui.view.webview.asWebviewUri(vscode.Uri.file(config.ui.path));

    // Replace relative paths with webview-compatible URIs.
    html = html.replace(/(src|href)="\.\//g, `$1="${baseUri}/`);

    // Inject the Bridge API shim.
    if (html.includes('</head>')) {
        html = html.replace('</head>', `${UI_SHIM}</head>`);
    } else {
        html = UI_SHIM + html;
    }
    // @BLOCK:END(render:prepare-html)

    // @BLOCK:START(render:set-html)
    ui.view.webview.html = html;
    // @BLOCK:END(render:set-html)
}
// @BLOCK:END(render)

// @BLOCK:START(broadcast)
/**
 * Sends a message to all active UI surfaces.
 * @param {string} event The event name.
 * @param {object} payload The event payload.
 */
function broadcast(event, payload) {
    // @BLOCK:START(broadcast:execution)
    if (activeInterfaces.size === 0) return;

    outputChannel.appendLine(`[UI Manager] Broadcasting message '${event}' to ${activeInterfaces.size} UIs.`);
    for (const { view } of activeInterfaces.values()) {
        view.webview.postMessage({ event, payload });
    }
    // @BLOCK:END(broadcast:execution)
}
// @BLOCK:END(broadcast)

// @BLOCK:START(focus)
/**
 * Brings a specific UI surface into focus.
 * @param {'sidebar' | 'bottombar'} id
 */
function focus(id) {
    // @BLOCK:START(focus:execution)
    if (id === 'sidebar') {
        vscode.commands.executeCommand('workbench.view.extension.bridge-container');
    } else if (id === 'bottombar') {
        vscode.commands.executeCommand('workbench.panel.bridge-panel-container.focus');
    }
    // @BLOCK:END(focus:execution)
}
// @BLOCK:END(focus)

// @BLOCK:START(deactivate)
/**
 * Disposes all created WebviewPanels.
 */
function deactivate() {
    // @BLOCK:START(deactivate:execution)
    for (const [id, { view, type }] of activeInterfaces.entries()) {
        if (type === 'wvp') {
            view.dispose();
        }
    }
    activeInterfaces.clear();
    // @BLOCK:END(deactivate:execution)
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    handleMessage,
    registerWebviewView,
    createWebviewPanel,
    render,
    broadcast,
    focus,
    deactivate,
};
// @BLOCK:END(exports)