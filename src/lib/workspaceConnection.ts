import type { FileNode } from "@/types/ide";

const revisions = new WeakMap<FileNode[], string>();

function hashValue(hash: number, value: string) {
    let next = hash;
    for (let index = 0; index < value.length; index++) {
        next ^= value.charCodeAt(index);
        next = Math.imul(next, 16777619);
    }
    return next;
}

export function workspaceTreeRevision(nodes: FileNode[]) {
    const cached = revisions.get(nodes);
    if (cached)
        return cached;
    let hash = 2166136261;
    let count = 0;
    const visit = (items: FileNode[]) => {
        for (const node of items) {
            count++;
            hash = hashValue(hash, `${node.type}\u0000${node.path}\u0000${node.name}\u0000${node.assetBlobId ?? ""}\u0000${node.assetMimeType ?? ""}\u0000${node.assetSize ?? ""}\u0000${node.content ?? ""}\u0000`);
            if (node.children)
                visit(node.children);
        }
    };
    visit(nodes);
    const revision = `${count}:${hash >>> 0}`;
    revisions.set(nodes, revision);
    return revision;
}

export function needsWorkspaceStage(stagedRevision: string | null, currentRevision: string) {
    return stagedRevision !== currentRevision;
}
