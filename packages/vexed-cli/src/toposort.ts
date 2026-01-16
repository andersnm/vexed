export function topoSort<T>(nodes: T[], edges: Array<{ from: T; to: T }>): T[] {
    const incoming = new Map<T, number>();
    const outgoing = new Map<T, T[]>();

    // Initialize maps
    for (const node of nodes) {
        incoming.set(node, 0);
        outgoing.set(node, []);
    }

    // Build adjacency + incoming counts
    for (const { from, to } of edges) {
        outgoing.get(to)!.push(from);
        incoming.set(from, (incoming.get(from) || 0) + 1);
    }

    // Queue of nodes with no incoming edges
    const queue: T[] = nodes.filter(n => incoming.get(n) === 0);
    const result: T[] = [];

    while (queue.length > 0) {
        const node = queue.shift()!;
        result.push(node);

        for (const next of outgoing.get(node)!) {
            incoming.set(next, incoming.get(next)! - 1);
            if (incoming.get(next) === 0) {
                queue.push(next);
            }
        }
    }

    // Cycle detection
    if (result.length !== nodes.length) {
        throw new Error("Cycle detected in dependency graph");
    }

    return result;
}
