# Reasoning Document: The Microkernel Foundation

## 1. Objective
The initial objective was to explore alternative communication mechanisms to the filesystem-based message bus, addressing potential performance concerns. However, through a deep architectural discussion, this goal evolved into a far more ambitious one: to completely refactor the Bridge extension from a monolithic application into a fully extensible, three-layered microkernel platform. The final objective was to build and validate the foundational bootloader for this new platform, prioritizing maximum extensibility and security over immediate feature parity, thereby transforming Bridge from a tool into a platform.

## 2. Architectural Decisions & Trade-offs
This implementation is the result of a significant strategic pivot away from the original architecture. The core of the discussion was not about which technology to use (IPC, Sockets, WebSockets), but about the fundamental structure of the extension itself.

### The Pivotal Insight: From Monolith to Microkernel
The key architectural breakthrough came from the idea of "Core Services" (originally "Host Apps"). This shifted the entire problem from "How should the Host manage communication?" to "What if the communication mechanism itself was a pluggable module?". This led to the final design of a three-layer microkernel architecture:
1.  **Layer 0 (The Bootloader):** A minimal, stable `extension.js` whose only responsibility is to discover, validate, and load the subsequent layers.
2.  **Layer 1 (Cores):** Modules that provide the fundamental, primitive functionalities of the system (e.g., an event bus). They are loaded first and their exports are assembled into a `KernelAPI`.
3.  **Layer 2 (Services):** Modules that implement all of Bridge's user-facing features. They are loaded second and consume the `KernelAPI` provided by the Cores.

### Key Trade-off: Guaranteed Stability vs. Maximum Extensibility
This new architecture represents a conscious decision to replace the old Golden Rules with a new set of principles. We explicitly traded the "guaranteed stability" of the old Golden Rule #1 (where the Host was a sealed box) for the "maximum extensibility" of allowing third-party code to run in the main extension process.

This trade-off was mitigated by a critical new security feature: a **mandatory, user-driven permission system**. No Core or Service can execute without the user's explicit approval ("Run Once" or "Always Allow"), which is then persisted in `config.json`. This makes the user the final arbiter of trust and security.

### Development Strategy: Deliberate "Big Bang" Rewrite
After considering a safer, evolutionary migration path, a deliberate decision was made to perform a complete "big bang" rewrite of the Host logic. The rationale was to ensure absolute architectural purity, preventing any legacy code or concepts from compromising the new microkernel model. The extensive chat history served as the primary knowledge base for the re-implementation.

## 3. Implementation Summary
The implementation, executed by Bruna, successfully delivered the foundational microkernel platform. The final state reflects the new architecture perfectly:
-   **New Directory Structure:** A new `src/bridge/` directory was created, containing the `kernel` logic and placeholder directories for `cores` and `services`.
-   **The Bootloader (Layer 0):** `extension.js` was refactored into a minimal bootloader that delegates all logic to a new `src/bridge/kernel/index.js` module.
-   **Dual-Boot Logic:** The kernel now implements a dual-mode initialization. For uninitialized workspaces, it registers a single `initializeWorkspace` command. For initialized workspaces, it runs the full boot sequence of Cores and Services.
-   **Secure Module Loading:** The bootloader successfully implements the permission system for both Cores and Services, prompting the user for approval and persisting the choice.
-   **Minimalist Onboarding:** The `initializeWorkspace` command was re-implemented to be minimal and non-prescriptive, scaffolding only the directories and the minimal `config.json` required for the platform to function.
-   **Architectural Validation:** The entire architecture was validated via two test modules: a `Log.core.js` that augments the `KernelAPI` and a `HelloWorld.service.js` that consumes it, proving the end-to-end functionality of the three-layer model.
-   **Bug Fixes & Hardening:** A critical activation bug in uninitialized workspaces was identified and fixed by centralizing all workspace path logic, making the onboarding experience more robust.