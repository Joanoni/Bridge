// @BLOCK:START(Full Artifact)
const fs = require('fs');
const path = require('path');

// @BLOCK:START(discoverComponents)
/**
 * Discovers all components by reading their manifests from paths defined in config.
 * @param {string} workspaceRoot The root of the user's workspace.
 * @param {import('vscode').OutputChannel} outputChannel
 * @returns {Map<string, object>} A map of component names to their manifest data.
 */
function discoverComponents(workspaceRoot, outputChannel) {
    const components = new Map();
    const bridgeRoot = path.join(workspaceRoot, '.bridge');
    const configPath = path.join(bridgeRoot, 'config.json');

    if (!fs.existsSync(configPath)) {
        return components;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const componentPaths = config?.components?.paths || [];

        for (const relativePath of componentPaths) {
            const absoluteComponentsPath = path.join(bridgeRoot, relativePath);
            if (!fs.existsSync(absoluteComponentsPath)) continue;

            const componentFolders = fs.readdirSync(absoluteComponentsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const folder of componentFolders) {
                const manifestPath = path.join(absoluteComponentsPath, folder, 'bridge.json');
                if (fs.existsSync(manifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (!manifest.name || !manifest.provides || !manifest.main || !manifest.interface) {
                        outputChannel.appendLine(`[Resolver] Warning: Invalid or incomplete manifest in '${folder}'. Skipping.`);
                        continue;
                    }
                    manifest.path = path.join(absoluteComponentsPath, folder);
                    components.set(manifest.name, manifest);
                }
            }
        }
    } catch (error) {
        outputChannel.appendLine(`[Resolver] Error discovering components: ${error.message}`);
    }

    return components;
}
// @BLOCK:END(discoverComponents)

// @BLOCK:START(buildDependencyGraph)
/**
 * Builds a dependency graph and validates for collisions and missing dependencies.
 * @param {Map<string, object>} components A map of discovered components.
 * @returns {Map<string, {manifest: object, dependencies: Set<string>, dependents: Set<string>}>} The dependency graph.
 */
function buildDependencyGraph(components) {
    const graph = new Map();
    const providers = new Map();

    // First pass: Initialize graph nodes and check for provider collisions.
    for (const [name, manifest] of components.entries()) {
        const contract = manifest.provides;
        if (providers.has(contract)) {
            const existingProvider = providers.get(contract);
            throw new Error(`Contract Collision: The contract '${contract}' is provided by multiple components ('${existingProvider}' and '${name}').`);
        }
        providers.set(contract, name);
        graph.set(name, { manifest, dependencies: new Set(), dependents: new Set() });
    }

    // Second pass: Build edges and check for missing dependencies.
    for (const [name, manifest] of components.entries()) {
        const dependencies = manifest.dependsOn || [];
        for (const depContract of dependencies) {
            if (!providers.has(depContract)) {
                throw new Error(`Missing Dependency: Component '${name}' requires contract '${depContract}', which is not provided by any component.`);
            }
            const providerName = providers.get(depContract);
            graph.get(name).dependencies.add(providerName);
            graph.get(providerName).dependents.add(name);
        }
    }

    return graph;
}
// @BLOCK:END(buildDependencyGraph)

// @BLOCK:START(topologicalSort)
/**
 * Performs a topological sort on the dependency graph and detects cycles.
 * @param {Map<string, {manifest: object, dependencies: Set<string>, dependents: Set<string>}>} graph The dependency graph.
 * @returns {string[]} An array of component names in initialization order.
 */
function topologicalSort(graph) {
    const sorted = [];
    const queue = [];
    const inDegree = new Map();

    // Initialize in-degrees and find starting nodes (degree 0).
    for (const [name, node] of graph.entries()) {
        const degree = node.dependencies.size;
        inDegree.set(name, degree);
        if (degree === 0) {
            queue.push(name);
        }
    }

    while (queue.length > 0) {
        const currentName = queue.shift();
        sorted.push(currentName);
        const currentNode = graph.get(currentName);

        for (const dependentName of currentNode.dependents) {
            const newDegree = inDegree.get(dependentName) - 1;
            inDegree.set(dependentName, newDegree);
            if (newDegree === 0) {
                queue.push(dependentName);
            }
        }
    }

    if (sorted.length !== graph.size) {
        // Cycle detected. Find the cycle to provide a helpful error message.
        const cycleNodes = [...graph.keys()].filter(name => !sorted.includes(name));
        throw new Error(`Circular Dependency Detected: A cycle exists among the following components: ${cycleNodes.join(', ')}.`);
    }

    return sorted;
}
// @BLOCK:END(topologicalSort)

// @BLOCK:START(exports)
module.exports = {
    discoverComponents,
    buildDependencyGraph,
    topologicalSort,
};
// @BLOCK:END(exports)
// @BLOCK:END(Full Artifact)