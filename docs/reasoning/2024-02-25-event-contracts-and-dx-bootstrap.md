# Reasoning Document: Event Contracts & Developer Experience Bootstrapping

## 1. Objective
The primary objective was to eliminate "magic strings" used for event names throughout the Bridge codebase. This aimed to improve developer experience (DX) by providing type-safe contracts and intellisense, reducing a common source of runtime errors.

A secondary, but equally critical, objective emerged during development: to fix the extension's "eager" activation behavior. Previously, the extension would activate in any workspace, leading to a poor user experience in non-Bridge projects. The goal became to create a deliberate, non-invasive onboarding process.

## 2. Architectural Decisions & Trade-offs
The final solution was the result of significant iteration, revealing important architectural insights along the way.

### Event Contract Design
- **Structure:** We chose a nested object structure for the event contracts (e.g., `events.app.start`). This was favored over a flat structure for better organization, scalability, and logical grouping of events by domain.
- **Injection Mechanism:** An IPC-based "handshake" was chosen to inject the event contracts from the Host to the App at startup. This was deemed architecturally superior to using environment variables, as it avoids potential size limitations and establishes a more robust and extensible configuration channel between the isolated processes, reinforcing the Host-App boundary.

### Activation and Command Visibility (Key Iteration)
- **Initial Approach (Flawed):** The initial design attempted to control command visibility using `when` clauses in `package.json` tied to a context flag set during a lazy activation (`onCommand`).
- **Discovered Trade-off:** Extensive testing proved this approach to be fundamentally flawed. It created a race condition where the VS Code UI would render the command list *before* the extension's activation logic could run to set the context, leading to an inconsistent and buggy user experience.
- **Conceptual Recoil (Pivotal Shift):** Following a user-driven insight, we pivoted away from the complexity of hiding UI elements. The final, simpler, and more robust architecture embraces **graceful degradation**.
- **Final Architecture:**
    1. All commands are declared statically in `package.json` to ensure they are always discoverable by the user.
    2. The extension activates on startup (`onStartupFinished`) to perform a single, lightweight check for the existence of `.bridge/config.json`.
    3. Based on this check, a context flag (`bridge.workspaceInitialized`) is set for UI elements like views and keybindings.
    4. The implementation of each command contains a "guard clause". If a command is run in an uninitialized workspace, it doesn't fail but instead presents the user with a helpful prompt to initialize the project. This provides a superior, guided user experience.

### Developer Experience Refinement
- **The `export {}` Fix:** Initial tests showed that intellisense was not working as expected. The root cause was that the `bridge.d.ts` file was not being treated as a module by TypeScript's language server. Adding an empty `export {};` statement was a critical refinement to force module-mode processing, allowing the `declare global` augmentation to function correctly.

## 3. Implementation Summary
The implementation, led by Bruna, evolved significantly through a rigorous test-driven cycle. The final state reflects the refined architecture:
- **Single Source of Truth:** A new `src/host/eventContracts.js` module now centralizes all event strings for the entire system.
- **Bootstrapping Assets:** A `src/assets/templates` directory was created to hold the boilerplate for `config.json`, `jsconfig.json`, and the crucial `bridge.d.ts` type definition file.
- **Programmatic Command Logic:** The core logic in `src/host/extension.js` was refactored to implement the "graceful degradation" model, registering command implementations that behave differently based on the workspace's initialization state.
- **IPC Handshake:** `processManager.js` was updated to send an `INIT` IPC message with the event contracts upon forking an App, and `bootstrapper.js` was modified to await this message before completing the SDK setup, ensuring the App is always correctly configured before user code execution.