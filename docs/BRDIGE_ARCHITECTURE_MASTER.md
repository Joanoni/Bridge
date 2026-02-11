# Bridge: Master Technical Documentation

## 1. Core Philosophy: Conceptual Recoil
**Bridge** is not just a VS Code extension; it is an orchestration layer that turns the IDE into a reactive runtime for custom tools.
- **Goal**: Allow users to extend VS Code without writing full extensions.
- **Methodology**: "Conceptual Recoil" — prioritize native structures (Webviews, Node.js processes) over complex abstractions. If a solution gets too complex, we step back and simplify.

---

## 2. System Architecture

The system operates on a **Host-Client model** entirely local to the user's machine.

### 2.1. The Host (VS Code Extension)
- **Role**: The "Server" and Window Manager.
- **Runtime**: Runs within the VS Code Extension Host process.
- **Responsibility**: 
  - Manages the `WebviewView` (UI) anchored in the Side Bar.
  - Listens for global events (File Save, Commands).
  - Spawns and kills child processes (Pipelines).
- **Key File**: `extension.js`.

### 2.2. The Orchestrator (Pipeline Process)
- **Role**: The "Controller".
- **Runtime**: A dedicated Node.js process spawned via `child_process.fork()`.
- **Isolation**: 
  - Uses `process.execPath` to utilize VS Code's internal Node.js binary.
  - Independent of the user's system Node.js (mostly).
  - One process per active pipeline execution.
- **Key File**: `internal/bootstrapper.js` (The DNA injected into the process).

### 2.3. The UI (Webview)
- **Role**: The "View".
- **Runtime**: Chromium-based isolated sandbox (iframe).
- **Communication**: JSON-RPC style messaging (`postMessage`).
- **Location**: Anchored in the Activity Bar or Bottom Panel.

---

## 3. Directory Structure & File Roles

Reflecting your current repository state:

```text
root/
├── .bridge/
│   ├── pipelines/           # Entry points for automation (Controllers)
│   │   ├── status-pipeline.js
│   │   ├── text-pipeline.js
│   │   └── on-save-example.js
│   ├── scripts/             # Reusable atomic logic (Workers)
│   │   └── text-processor.js
│   └── ui/                  # UI Components (HTML/CSS/JS)
│       ├── save-notification.html
│       ├── status-loader.html
│       ├── status.html
│       └── text-result.html
├── internal/
│   └── bootstrapper.js      # The environment setup for child processes
├── extension.js             # Main VS Code entry point
└── package.json             # Manifest and Configuration
```

---

## 4. Scripting Model: Pipelines vs. Scripts

We unified the concept of "Scripts" but strictly differentiated their roles in the hierarchy.

### A. Pipelines (The Entry Point)
- **Definition**: Files located in `.bridge/pipelines/`.
- **Characteristics**: 
  - Must export a `config` object (for triggers).
  - Must export a `run()` function.
  - Executed in a fresh OS Process.
- **Capabilities**: Can control UI, call other scripts, and manage state.

### B. Atomic Scripts (The Workers)
- **Definition**: Files located in `.bridge/scripts/`.
- **Execution**: Run via `bridge.execute('script.js', payload)`.
- **Isolation Strategy**: 
  - Executed inside a Node.js `vm.Context` (Virtual Machine).
  - **Wrapper Mechanism**: The code is wrapped in an Async IIFE `(async () => { ... })()` before execution.
  - **Benefit**: Allows top-level `return` statements and `await` usage without syntax errors.

### C. The Bridge SDK (`global.bridge`)
Injected automatically by `bootstrapper.js` into every script:
- `bridge.ui.render(component, payload)`: Loads HTML into the view.
- `bridge.ui.postMessage(data)`: Sends updates to an active view.
- `bridge.ui.onMessage(callback)`: Listens for UI events (clicks, inputs).
- `bridge.execute(path, payload)`: Runs a sub-script in a VM.
- `bridge.state`: A shared memory object persistent across the pipeline lifecycle.

---

## 5. The Trigger System

How Bridge decides when to run code.

### 5.1. Command Trigger (`bridge.runPipeline`)
- **Mechanism**: Reads `.bridge/pipelines/`, shows a QuickPick list, and manually executes the selected file.

### 5.2. Event Trigger (`onSave`)
- **Implementation**: `extension.js` sets up a `vscode.workspace.onDidSaveTextDocument` listener.
- **Discovery**: It scans pipeline files using Regex (`/trigger:\s*['"]onSave['"]/`) to avoid loading the full JS engine for every file save.
- **Payload Injection**: Event data (Filename, Timestamp) is serialized into `process.env.BRIDGE_EVENT_PAYLOAD`. The bootstrapper parses this and injects it into `bridge.input`.

### 5.3. View Trigger (`bridge.openView`)
- **Mechanism**: Uses `vscode.commands.executeCommand('bridgeView.focus')` to programmatically open the anchored view, mimicking the native Chat behavior.

---

## 6. UI Architecture

Bridge is "Framework Agnostic". It serves static HTML but enables reactive behavior.

### 6.1. The Rendering Loop
1. **Pipeline**: Calls `bridge.ui.render('my-component', { status: 'loading' })`.
2. **Host**: 
   - Reads `.bridge/ui/my-component.html`.
   - Replaces relative paths (`./`) with secure VS Code Webview URIs.
   - Sets the Webview HTML.
   - Sends a `HYDRATE` message after a short delay (150ms).
3. **Component (HTML)**:
   - Listens for `window.onmessage`.
   - Updates the DOM based on the payload.

---

## 7. Current Implementation Details (v0.1.0)

### `package.json`
- Defines the `viewsContainers` (Activity Bar Icon).
- Defines the `views` (The Webview panel).
- Sets `keybindings` (`Ctrl+Alt+.`) to open the view.

### `extension.js`
- Implements `BridgeViewProvider` to manage the Webview lifecycle.
- Handles the `fork` logic using `process.execPath`.
- Translates `UI_EVENT` from Webview to IPC messages for the Pipeline.
- Implements the Trigger Listener logic.

### `internal/bootstrapper.js`
- The wrapper that runs before the user's code.
- Sets up the `vm` context with the Async IIFE wrapper.
- Proxies `console.log` to the VS Code Output.
- Handles exceptions to prevent the extension host from crashing.

---

## 8. Future Roadmap (The Dream)

1. **Marketplace**: A way for users to share Pipelines, Scripts and UI components.