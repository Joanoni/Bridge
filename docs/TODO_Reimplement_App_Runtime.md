# Blueprint: Rebuilding the Bridge App Runtime

This document outlines the component-based implementation required to restore and enhance the original "App" runtime functionality of the Bridge platform. It serves as the technical specification for the "standard distribution" of components that will provide a complete, out-of-the-box experience.

Each section defines a distinct, modular component that adheres to the new dependency-aware architecture.

---

## Phase 1: Foundational Components

These components provide the fundamental primitives required for inter-component collaboration.

### 1. Component: `Logger`
-   **Purpose**: Provides a robust, namespaced logging service for all other components.
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:logger",
      "main": "./index.js",
      "provides": "logger",
      "dependsOn": [],
      "interface": {
        "getLogger": { "type": "function" }
      }
    }
    ```
-   **Responsibilities**:
    -   The `getLogger(name)` function must create and manage a dedicated VS Code `OutputChannel` for the requesting component (e.g., `Bridge: component-name`).
    -   It should return a logger object (`{ log, warn, error }`) that writes to that specific channel.

### 2. Component: `EventBus`
-   **Purpose**: Provides a synchronous, in-memory event bus for decoupled communication *between* components running in the main extension host.
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:event-bus",
      "main": "./index.js",
      "provides": "event-bus",
      "dependsOn": ["logger"],
      "interface": {
        "on": { "type": "function" },
        "broadcast": { "type": "function" }
      }
    }
    ```
-   **Responsibilities**:
    -   Implement a standard event emitter pattern (`on`, `broadcast`). This bus is for internal, host-level component collaboration only.

---

## Phase 2: Core Functionality Components

These components use the foundational primitives to implement the core features of the Bridge runtime.

### 3. Component: `RegisterCommand`
-   **Purpose**: Registers and handles user-facing commands in the VS Code UI.
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:command-registrar",
      "main": "./index.js",
      "provides": "command-registrar",
      "dependsOn": ["logger", "event-bus"],
      "interface": {}
    }
    ```
-   **Responsibilities**:
    -   Register commands like `bridge.runApp` with VS Code.
    -   When a command is triggered, use the `event-bus` to broadcast a clear, namespaced event describing the user's intent (e.g., `command:run-app:triggered`).

### 4. Component: `CommunicationBus`
-   **Purpose**: Provides the primary, high-performance communication channel between sandboxed Apps, UIs, and the host components.
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:communication-bus",
      "main": "./index.js",
      "provides": "communication-bus",
      "dependsOn": ["logger"],
      "interface": {
        "getConnectionInfo": { "type": "function" }
      }
    }
    ```
-   **Responsibilities**:
    -   Start and manage a central WebSocket server.
    -   The `getConnectionInfo()` function should return the details needed for a client to connect (e.g., `{ port: 12345 }`).
    -   Act as a message broker, broadcasting messages received from one client to all other connected clients.

### 5. Component: `ProcessManagement`
-   **Purpose**: Manages the lifecycle of sandboxed user applications (child processes).
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:process-management",
      "main": "./index.js",
      "provides": "process-management",
      "dependsOn": ["logger", "event-bus", "communication-bus"],
      "interface": {}
    }
    ```
-   **Responsibilities**:
    -   Use the `event-bus` to listen for events from the `RegisterCommand` (e.g., `command:run-app:triggered`).
    -   Use `child_process.fork()` to spawn the `bootstrapper.js`.
    -   Use the `communication-bus` API to get connection details and pass them to the new process via a one-time IPC handshake.

### 6. Component: `UiManagement`
-   **Purpose**: Manages the lifecycle of VS Code Webviews (Sidebar, Bottom Bar, and dynamic panels).
-   **Manifest (`bridge.json`)**:
    ```json
    {
      "name": "bridge:ui-management",
      "main": "./index.js",
      "provides": "ui-management",
      "dependsOn": ["logger", "communication-bus"],
      "interface": {}
    }
    ```
-   **Responsibilities**:
    -   Register the `WebviewViewProvider`s for the static views (`bridge.sidebar`, `bridge.bottombar`).
    -   For each created webview, inject a client-side script that connects it as a client to the `CommunicationBus` WebSocket server.
    -   Listen for messages on the `communication-bus` (e.g., `ui:render`, `ui:create-panel`) and translate them into actions on the corresponding VS Code webview APIs.
    -   Forward messages originating from a webview back into the `communication-bus` for Apps to consume.

---

## Phase 3: Client-Side Runtime

This is the code that will run inside the sandboxed child process.

### 7. The New `bootstrapper.js` and `SDK`
-   **Location**: `src/app/` (or a new, more appropriate location).
-   **Responsibilities**:
    -   **`bootstrapper.js`**: Wait for the IPC handshake from `ProcessManagement`, connect to the `CommunicationBus` WebSocket server using the provided details, build the `global.bridge` SDK object, and load the user's script.
    -   **`SDK`**: The new SDK will be a lightweight WebSocket client. It will provide the `bridge.postMessage` and `bridge.onMessage` APIs, which will simply send and receive JSON payloads over the WebSocket connection. The `bridge.ui.render()` function, for example, will simply become `bridge.postMessage('ui:render', ...)`.