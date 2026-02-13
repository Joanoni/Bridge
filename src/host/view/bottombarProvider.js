// @BLOCK:START(imports)
const vscode = require('vscode');
const uiManager = require('../uiManager');
// @BLOCK:END(imports)

// @BLOCK:START(BottombarProvider)
/* *
 * Implements the VS Code WebviewViewProvider for the Bridge bottom bar panel.
 * Its primary role is to act as a factory, handing over the resolved
 * webview instance to the central uiManager for state management.
 */
class BottombarProvider {
    // @BLOCK:START(BottombarProvider:constructor)
    /* *
     * @param {vscode.ExtensionContext['extensionUri']} extensionUri
     */
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }
    // @BLOCK:END(BottombarProvider:constructor)

    // @BLOCK:START(BottombarProvider:resolveWebviewView)
    /**
     * This method is called by VS Code when the view is first created.
     * @param {vscode.WebviewView} webviewView
     * @param {vscode.WebviewViewResolveContext} context
     * @param {vscode.CancellationToken} _token
     */
    resolveWebviewView(webviewView, context, _token) {
        // @BLOCK:START(BottombarProvider:resolveWebviewView:configure-webview)
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
        // @BLOCK:END(BottombarProvider:resolveWebviewView:configure-webview)

        // @BLOCK:START(BottombarProvider:resolveWebviewView:handover-to-manager)
        // --- Handover to Central Manager ---
        // The provider's job is done once it registers the view with the uiManager.
        // All subsequent logic (rendering, message handling) is managed centrally.
        uiManager.registerWebviewView('bottombar', webviewView);
        // @BLOCK:END(BottombarProvider:resolveWebviewView:handover-to-manager)

        // @BLOCK:START(BottombarProvider:resolveWebviewView:set-initial-html)
        // --- Initial Content ---
        webviewView.webview.html = this._getInitialHtml();
        // @BLOCK:END(BottombarProvider:resolveWebviewView:set-initial-html)
    }
    // @BLOCK:END(BottombarProvider:resolveWebviewView)

    // @BLOCK:START(BottombarProvider:_getInitialHtml)
    /**
     * Provides a simple initial HTML content to display while the system initializes.
     * @returns {string}
     */
    _getInitialHtml() {
        // @BLOCK:START(BottombarProvider:_getInitialHtml:execution)
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bridge Terminal</title>
        </head>
        <body>
            <h1>Bridge Terminal</h1>
            <p>Waiting for an App to render content...</p>
        </body>
        </html>
    `;
        // @BLOCK:END(BottombarProvider:_getInitialHtml:execution)
    }
    // @BLOCK:END(BottombarProvider:_getInitialHtml)
}
// @BLOCK:END(BottombarProvider)

// @BLOCK:START(exports)
module.exports = BottombarProvider;
// @BLOCK:END(exports)