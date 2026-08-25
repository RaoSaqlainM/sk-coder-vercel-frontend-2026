import { beginWorkspaceStage, commitWorkspaceStage, createWebPreviewSession, getWebPreviewSession, getWorkspaceStageStatus, launchWebPreviewSession, removeWebPreviewSession, uploadWorkspaceStageChunk } from "@/lib/backendRunner";
import { loadBrowserBlob } from "@/lib/browserStorage";
import type { FileNode } from "@/types/ide";
import { normalizeWorkspaceStagePath } from "@/lib/workspaceStagePath";

export type WebPreviewSession = {
    id: string;
    workspaceSessionId: string;
    projectPath: string | null;
    kind: "vite" | "next" | null;
    status: "staging" | "running";
    expiresAt: number;
    viewUrl: string | null;
    log?: string;
};

type StageSource = { path: string; blob: Blob };
const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

function fromServer(value: Omit<WebPreviewSession, "viewUrl"> & { viewPath: string | null }): WebPreviewSession {
    return { ...value, viewUrl: value.viewPath ? `${API_BASE}${value.viewPath}` : null };
}

async function collectSources(nodes: FileNode[]) {
    const files: StageSource[] = [];
    async function collect(items: FileNode[]): Promise<void> {
        for (const node of items) {
            if (node.type === "file") {
                if (node.assetBlobId) {
                    const blob = await loadBrowserBlob(node.assetBlobId);
                    if (!blob)
                        throw new Error(`${node.name} is not available in browser storage. Re-import it before starting project preview.`);
                    files.push({ path: node.path, blob });
                }
                else {
                    files.push({ path: node.path, blob: new Blob([node.content ?? ""], { type: "text/plain;charset=utf-8" }) });
                }
            }
            if (node.children)
                await collect(node.children);
        }
    }
    await collect(nodes);
    return files;
}

async function stageWorkspace(sessionId: string, nodes: FileNode[], onProgress?: (completed: number, total: number) => void) {
    const sources = await collectSources(nodes);
    let stage = await beginWorkspaceStage(sessionId, sources.map((source) => ({ path: normalizeWorkspaceStagePath(source.path), size: source.blob.size })));
    const byPath = new Map(sources.map((source) => [normalizeWorkspaceStagePath(source.path), source]));
    const total = sources.reduce((sum, source) => sum + source.blob.size, 0);
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            let completed = 0;
            for (const file of stage.files) {
                const source = byPath.get(file.path);
                if (!source)
                    throw new Error(`Workspace file changed during staging: ${file.path}`);
                const missing = new Set(file.missingOffsets);
                for (let offset = 0; offset < file.size; offset += stage.chunkBytes) {
                    const chunk = source.blob.slice(offset, Math.min(file.size, offset + stage.chunkBytes));
                    if (missing.has(offset))
                        await uploadWorkspaceStageChunk(sessionId, stage.stageId, file.path, offset, chunk);
                    completed += chunk.size;
                    onProgress?.(completed, total);
                }
            }
            await commitWorkspaceStage(sessionId, stage.stageId);
            return;
        }
        catch (error) {
            if (attempt === 1)
                throw error;
            stage = await getWorkspaceStageStatus(sessionId, stage.stageId);
        }
    }
}

export async function launchWebProjectPreview(project: FileNode, fileTree: FileNode[], onProgress?: (completed: number, total: number) => void) {
    const initial = await createWebPreviewSession();
    try {
        await stageWorkspace(initial.workspaceSessionId, fileTree, onProgress);
        return fromServer(await launchWebPreviewSession(initial.id, project.path));
    }
    catch (error) {
        await removeWebPreviewSession(initial.id).catch(() => undefined);
        throw error;
    }
}

export async function getWebProjectPreviewStatus(id: string) {
    return fromServer(await getWebPreviewSession(id));
}

export async function stopWebProjectPreview(id: string) {
    await removeWebPreviewSession(id);
}
