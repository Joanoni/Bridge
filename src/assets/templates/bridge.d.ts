// @BLOCK:START(Full Artifact)
/**
 * Defines the structure for the Bridge SDK's event contracts.
 * This provides intellisense for all available system events.
 */
interface BridgeEvents {
    app: {
        start: 'bridge:app:start';
        stop: 'bridge:app:stop';
        listRunningRequest: 'bridge:app:listRunningRequest';
        listRunningResponse: 'bridge:app:listRunningResponse';
    };
    ui: {
        render: 'bridge:ui:render';
        createPanelRequest: 'bridge:ui:createPanelRequest';
        createPanelResponse: 'bridge:ui:createPanelResponse';
    };
    workspace: {
        readFileRequest: 'bridge:workspace:readFileRequest';
        readFileResponse: 'bridge:workspace:readFileResponse';
    };
    os: {
        getInfoRequest: 'bridge:os:getInfoRequest';
        getInfoResponse: 'bridge:os:getInfoResponse';
    };
    vscode: {
        onSave: 'vscode:onSave';
        onRename: 'vscode:onRename';
    };
}

/**
 * Represents the main Bridge SDK object available globally in every App.
 */
interface BridgeSDK {
    /**
     * A structured object containing all valid event names for the Bridge system.
     * Use these constants instead of raw strings for type safety and autocompletion.
     * @example bridge.postMessage(bridge.events.app.start, { appName: 'myApp.js' });
     */
    events: BridgeEvents;

    /**
     * The absolute path to the root of the user's workspace.
     */
    workspaceRoot: string;

    /**
     * Sends a message to the central message bus.
     * @param event The event name, preferably from `bridge.events`.
     * @param payload A JSON-serializable object.
     */
    postMessage(event: string, payload: object): void;

    /**
     * Registers a callback for a specific event from the message bus.
     * @param event The event name to listen for, preferably from `bridge.events`.
     * @param callback The function to execute with the message payload.
     * @returns A function to unsubscribe the listener.
     */
    onMessage(event: string, callback: (payload: any) => void): () => void;

    /**
     * Provides APIs for managing the lifecycle of other Apps.
     */
    app: {
        /**
         * Starts a new App process.
         * @param appName The filename of the app to start (e.g., 'deploy.js').
         */
        startApp(appName: string): void;

        /**
         * Stops a running App process.
         * @param appName The filename of the app to stop (e.g., 'deploy.js').
         */
        stopApp(appName: string): void;

        /**
         * Retrieves a list of all currently running App filenames.
         * @returns A promise that resolves with an array of app names.
         */
        getRunningApps(): Promise<string[]>;
    };

    /**
     * Provides APIs for interacting with VS Code's UI surfaces.
     */
    ui: {
        sidebar: 'sidebar';
        bottombar: 'bottombar';

        /**
         * Renders an HTML file into a specified UI target.
         * @param targetId The ID of the UI surface (e.g., bridge.ui.sidebar).
         * @param componentPath The relative path to the HTML file within the UI directory.
         */
        render(targetId: string, componentPath: string): void;

        /**
         * Creates a new Webview Panel.
         * @param options Options for the panel (e.g., { title: 'My Panel' }).
         * @returns A promise that resolves with the unique ID of the created panel.
         */
        createPanel(options: { title: string }): Promise<string>;
    };

    /**
     * Provides APIs for secure access to the workspace.
     */
    workspace: {
        /**
         * Reads the content of a file within the workspace.
         * @param filePath The absolute path to the file.
         * @returns A promise that resolves with the file content as a string.
         */
        readFile(filePath: string): Promise<string>;
    };

    /**
     * Provides APIs for interacting with the underlying operating system.
     */
    os: {
        /**
         * Retrieves basic OS information.
         * @returns A promise that resolves with OS info.
         */
        getInfo(): Promise<{ hostname: string; platform: string }>;
    };

    /**
     * Executes a user-defined script in a sandboxed VM context.
     * @param scriptName The relative path/name of the script file.
     * @param payload Data to be made available to the script via `bridge.payload`.
     * @returns A promise that resolves with the return value of the script.
     */
    runScript(scriptName: string, payload?: any): Promise<any>;
}

declare global {
    const bridge: BridgeSDK;
}

// This empty export is crucial. It signals to TypeScript that this file is a module,
// which allows the `declare global` augmentation to work correctly.
export {};
// @BLOCK:END(Full Artifact)