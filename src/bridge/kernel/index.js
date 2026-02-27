// @BLOCK:START(Full Artifact)
const vscode = require('vscode');
const path = require('path');
const loader = require('./loader');
const config = require('./config');
const workspace = require('./workspace');

// @BLOCK:START(module-scope)
/**
 * Holds the state of the running kernel.
 * @type {{
 *   context: vscode.ExtensionContext | null,
 *   outputChannel: vscode.OutputChannel | null,
 *   activeCores: any[],
 *   activeServices: any[],
 *   kernelAPI: object
 * }}
 */
const kernelState = {
    context: null,
    outputChannel: null,
    activeCores: [],
    activeServices: [],
    kernelAPI: {},
};
// @BLOCK:END(module-scope)

// @BLOCK:START(runBootSequence)
/**
 * Runs the full boot sequence for an initialized workspace.
 * @param {string} bridgeRoot The path to the .bridge directory.
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {vscode.OutputChannel} outputChannel The output channel.
 */
async function runBootSequence(bridgeRoot, context, outputChannel) {
    // --- PHASE 1: Load Cores and Build KernelAPI ---
    outputChannel.appendLine("[Kernel] Phase 1: Initializing Cores...");
    const coresPath = path.join(bridgeRoot, 'cores');
    const coreModules = loader.loadModules(coresPath, outputChannel);

    for (const core of coreModules) {
        try {
            const hasPermission = await config.checkPermission(core.name, 'core', outputChannel);
            if (hasPermission) {
                const apiContributions = await core.module.initialize({ context, outputChannel });
                Object.assign(kernelState.kernelAPI, apiContributions);
                kernelState.activeCores.push(core);
                outputChannel.appendLine(`[Kernel] > Core '${core.name}' initialized.`);
            } else {
                outputChannel.appendLine(`[Kernel] > Core '${core.name}' skipped due to lack of permission.`);
            }
        } catch (error) {
            outputChannel.appendLine(`[Kernel] > FAILED to initialize Core '${core.name}': ${error.message}`);
        }
    }
    outputChannel.appendLine("[Kernel] KernelAPI assembled.");

    // --- PHASE 2: Load Services with KernelAPI ---
    outputChannel.appendLine("[Kernel] Phase 2: Initializing Services...");
    const servicesPath = path.join(bridgeRoot, 'services');
    const serviceModules = loader.loadModules(servicesPath, outputChannel);

    for (const service of serviceModules) {
        try {
            const hasPermission = await config.checkPermission(service.name, 'service', outputChannel);
            if (hasPermission) {
                await service.module.initialize(kernelState.kernelAPI);
                kernelState.activeServices.push(service);
                outputChannel.appendLine(`[Kernel] > Service '${service.name}' initialized.`);
            } else {
                outputChannel.appendLine(`[Kernel] > Service '${service.name}' skipped due to lack of permission.`);
            }
        } catch (error) {
            outputChannel.appendLine(`[Kernel] > FAILED to initialize Service '${service.name}': ${error.message}`);
        }
    }
    outputChannel.appendLine("[Kernel] All services initialized.");
}
// @BLOCK:END(runBootSequence)


// @BLOCK:START(initialize)
/**
 * Initializes the Bridge microkernel.
 * Checks if the workspace is configured. If so, runs the full boot sequence.
 * If not, registers the 'initializeWorkspace' command.
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {vscode.OutputChannel} outputChannel The output channel for logging.
 */
async function initialize(context, outputChannel) {
    kernelState.context = context;
    kernelState.outputChannel = outputChannel;

    // Use the new centralized path logic. We pass `true` to check for config.json's existence.
    const bridgeRoot = config.getBridgeRoot(true);

    if (bridgeRoot) {
        // --- CONFIGURED WORKSPACE ---
        vscode.commands.executeCommand('setContext', 'bridge.workspaceInitialized', true);
        await runBootSequence(bridgeRoot, context, outputChannel);
    } else {
        // --- UNCONFIGURED WORKSPACE ---
        vscode.commands.executeCommand('setContext', 'bridge.workspaceInitialized', false);
        outputChannel.appendLine("[Kernel] No .bridge/config.json found. Registering 'initializeWorkspace' command.");
        const disposable = vscode.commands.registerCommand('bridge.initializeWorkspace', () => {
            workspace.initializeWorkspace(context);
        });
        context.subscriptions.push(disposable);
    }
}
// @BLOCK:END(initialize)

// @BLOCK:START(deactivate)
/**
 * Deactivates all active services and cores in reverse order.
 */
function deactivate() {
    if (kernelState.outputChannel) {
        kernelState.outputChannel.appendLine("[Kernel] Deactivating all services and cores...");
    }

    // Deactivate services first
    for (const service of kernelState.activeServices.reverse()) {
        try {
            if (typeof service.module.deactivate === 'function') {
                service.module.deactivate();
            }
        } catch (error) {
            if (kernelState.outputChannel) {
                kernelState.outputChannel.appendLine(`[Kernel] Error deactivating service '${service.name}': ${error.message}`);
            }
        }
    }

    // Then deactivate cores
    for (const core of kernelState.activeCores.reverse()) {
        try {
            if (typeof core.module.deactivate === 'function') {
                core.module.deactivate();
            }
        } catch (error) {
            if (kernelState.outputChannel) {
                kernelState.outputChannel.appendLine(`[Kernel] Error deactivating core '${core.name}': ${error.message}`);
            }
        }
    }

    // Reset kernel state for clean re-activation
    kernelState.activeCores = [];
    kernelState.activeServices = [];
    kernelState.kernelAPI = {};
    kernelState.context = null;
    kernelState.outputChannel = null;
}
// @BLOCK:END(deactivate)

// @BLOCK:START(exports)
module.exports = {
    initialize,
    deactivate,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)