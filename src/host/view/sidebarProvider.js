// @BLOCK:START(imports)
const vscode = require('vscode');
const uiManager = require('../uiManager');
// @BLOCK:END(imports)

// @BLOCK:START(SidebarProvider)
/* *
 * Implements the VS Code WebviewViewProvider for the Bridge sidebar.
 * Its primary role is to act as a factory, handing over the resolved
 * webview instance to the central uiManager for state management.
 */
class SidebarProvider {
    // @BLOCK:START(SidebarProvider:constructor)
    /* *
     * @param {vscode.ExtensionContext['extensionUri']} extensionUri
     */
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }
    // @BLOCK:END(SidebarProvider:constructor)

    // @BLOCK:START(SidebarProvider:resolveWebviewView)
    /**
     * This method is called by VS Code when the view is first created.
     * @param {vscode.WebviewView} webviewView
     * @param {vscode.WebviewViewResolveContext} context
     * @param {vscode.CancellationToken} _token
     */
    resolveWebviewView(webviewView, context, _token) {
        // @BLOCK:START(SidebarProvider:resolveWebviewView:configure-webview)
        // --- Webview Configuration ---
        const workspaceRootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const localResourceRoots = [this._extensionUri];
        if (workspaceRootUri) {
            localResourceRoots.push(workspaceRootUri);
        }

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: localResourceRoots,
        };
        // @BLOCK:END(SidebarProvider:resolveWebviewView:configure-webview)

        // @BLOCK:START(SidebarProvider:resolveWebviewView:handover-to-manager)
        // --- Handover to Central Manager ---
        // The provider's job is done once it registers the view with the uiManager.
        // All subsequent logic (rendering, message handling) is managed centrally.
        uiManager.registerWebviewView('sidebar', webviewView);
        // @BLOCK:END(SidebarProvider:resolveWebviewView:handover-to-manager)

        // @BLOCK:START(SidebarProvider:resolveWebviewView:set-initial-html)
        // --- Initial Content ---
        webviewView.webview.html = this._getInitialHtml();
        // @BLOCK:END(SidebarProvider:resolveWebviewView:set-initial-html)
    }
    // @BLOCK:END(SidebarProvider:resolveWebviewView)

    // @BLOCK:START(SidebarProvider:_getInitialHtml)
    /**
     * Provides a simple initial HTML content to display while the system initializes.
     * @returns {string}
     */
    _getInitialHtml() {
        // @BLOCK:START(SidebarProvider:_getInitialHtml:execution)
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bridge</title>
        </head>
        <body>
            <h1>Bridge</h1>
            <p>Waiting for an App to render content...</p>
        </body>
        </html>
    `;
        // @BLOCK:END(SidebarProvider:_getInitialHtml:execution)
    }
    // @BLOCK:END(SidebarProvider:_getInitialHtml)
}
// @BLOCK:END(SidebarProvider)

// @BLOCK:START(exports)
module.exports = SidebarProvider;
// @BLOCK:END(exports)