const BASE = import.meta.env.VITE_API_URL || "/api";
import { resolveWebSocketBase } from "./backendEndpoints";

const WS_BASE = resolveWebSocketBase(BASE, import.meta.env.VITE_WS_URL);
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTime: number;
    error?: string;
    sessionId?: string;
}
export type WorkspaceRetentionMode = "three-days" | "four-hours";
export type WorkspaceLifecycle = {
    id: string;
    createdAt: number;
    lastHeartbeatAt: number;
    expiresAt: number;
    retentionMode: WorkspaceRetentionMode;
    quotaBytes: number;
    state: "active" | "scheduled-delete" | "deleted";
    deleteUndoUntil: number | null;
    revision: number;
    tier?: string;
};
export type WorkspaceFilePayload = {
    path: string;
    content: string;
    encoding?: "utf8" | "base64";
};
export type WorkspaceStageFile = {
    path: string;
    size: number;
    sha256?: string;
    revision?: string;
};
export type WorkspaceStageStatus = {
    stageId: string;
    chunkBytes: number;
    files: Array<{
        path: string;
        size: number;
        missingOffsets: number[];
    }>;
};
function getDeviceId(): string {
    let id = localStorage.getItem("sk-device-id");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("sk-device-id", id);
    }
    return id;
}
function getHeaders() {
    return { "Content-Type": "application/json", "X-Device-Id": getDeviceId() };
}
export async function isBackendAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(3000), headers: getHeaders() });
        if (!response.ok)
            return false;
        const data = await response.json() as {
            status?: string;
        };
        return data.status === "ok";
    }
    catch {
        return false;
    }
}
async function workspaceRequest<T>(path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers: getHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({ error: response.statusText })) as T & {
        error?: string;
    };
    if (!response.ok)
        throw new Error(data.error || response.statusText);
    return data;
}
export async function createWorkspace(retentionMode: WorkspaceRetentionMode = "three-days") {
    return workspaceRequest<{
        id: string;
        expiresAt: number;
        retentionMode: WorkspaceRetentionMode;
        quotaBytes: number;
        tier: string;
    }>("/execute/sessions", "POST", { retentionMode });
}
export async function installWorkspaceDependencies(sessionId: string, manager: "npm" | "pnpm" | "yarn", mode: "install" | "ci", cwd = "/", packages: string[] = []) {
    return workspaceRequest<ExecResult & { lifecycleScriptsDisabled: boolean }>(`/execute/sessions/${encodeURIComponent(sessionId)}/dependencies`, "POST", { manager, mode, cwd, packages });
}
export async function createGuiSession() {
    return workspaceRequest<{
        id: string;
        workspaceSessionId: string;
        filePath: string | null;
        status: "staging" | "running";
        expiresAt: number;
        viewPath: string | null;
    }>("/gui/sessions", "POST");
}
export async function removeGuiSession(id: string) {
    const response = await fetch(`${BASE}/gui/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Device-Id": getDeviceId() },
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 404)
        throw new Error((await response.json().catch(() => ({ error: response.statusText })) as { error?: string }).error || response.statusText);
}
type WebPreviewSessionResponse = {
    id: string;
    workspaceSessionId: string;
    projectPath: string | null;
    kind: "vite" | "next" | null;
    status: "staging" | "running";
    expiresAt: number;
    viewPath: string | null;
    log?: string;
};
export async function createWebPreviewSession() {
    return workspaceRequest<WebPreviewSessionResponse>("/previews/sessions", "POST");
}
export async function launchWebPreviewSession(id: string, projectPath: string) {
    return workspaceRequest<WebPreviewSessionResponse>(`/previews/sessions/${encodeURIComponent(id)}/launch`, "POST", { projectPath });
}
export async function getWebPreviewSession(id: string) {
    return workspaceRequest<WebPreviewSessionResponse>(`/previews/sessions/${encodeURIComponent(id)}`, "GET");
}
export async function removeWebPreviewSession(id: string) {
    const response = await fetch(`${BASE}/previews/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Device-Id": getDeviceId() },
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 404)
        throw new Error((await response.json().catch(() => ({ error: response.statusText })) as { error?: string }).error || response.statusText);
}
export async function getWorkspaceLifecycle(sessionId: string) {
    return workspaceRequest<WorkspaceLifecycle>(`/execute/sessions/${encodeURIComponent(sessionId)}`, "GET");
}
export async function heartbeatWorkspace(sessionId: string, retentionMode: WorkspaceRetentionMode) {
    return workspaceRequest<WorkspaceLifecycle>(`/execute/sessions/${encodeURIComponent(sessionId)}/heartbeat`, "POST", { retentionMode });
}
export async function setWorkspaceRetention(sessionId: string, retentionMode: WorkspaceRetentionMode) {
    return workspaceRequest<WorkspaceLifecycle>(`/execute/sessions/${encodeURIComponent(sessionId)}/retention`, "PUT", { retentionMode });
}
export async function scheduleWorkspaceDelete(sessionId: string) {
    return workspaceRequest<WorkspaceLifecycle>(`/execute/sessions/${encodeURIComponent(sessionId)}/delete`, "POST");
}
export async function cancelWorkspaceDelete(sessionId: string) {
    return workspaceRequest<WorkspaceLifecycle>(`/execute/sessions/${encodeURIComponent(sessionId)}/cancel-delete`, "POST");
}
export async function runOnBackend(language: string, code: string, opts?: {
    sessionId?: string;
}): Promise<ExecResult> {
    try {
        const response = await fetch(`${BASE}/execute`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ language, code, ...opts }),
            signal: AbortSignal.timeout(125000),
        });
        const data = await response.json().catch(() => null) as ExecResult | null;
        return data ?? { stdout: "", stderr: response.statusText, exitCode: 1, executionTime: 0, error: response.statusText };
    }
    catch (error) {
        return { stdout: "", stderr: String(error), exitCode: 1, executionTime: 0, error: String(error) };
    }
}
export async function syncWorkspaceFiles(sessionId: string, files: WorkspaceFilePayload[]) {
    const response = await fetch(`${BASE}/execute/sessions/${encodeURIComponent(sessionId)}/files`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
        throw new Error((await response.json().catch(() => ({ error: response.statusText })) as {
            error?: string;
        }).error || response.statusText);
}
export async function beginWorkspaceStage(sessionId: string, files: WorkspaceStageFile[], stageId?: string) {
    return workspaceRequest<WorkspaceStageStatus>(`/execute/sessions/${encodeURIComponent(sessionId)}/stage/manifest`, "POST", { files, ...(stageId ? { stageId } : {}) });
}
export async function getWorkspaceStageStatus(sessionId: string, stageId: string) {
    return workspaceRequest<WorkspaceStageStatus>(`/execute/sessions/${encodeURIComponent(sessionId)}/stage/${encodeURIComponent(stageId)}`, "GET");
}
export async function uploadWorkspaceStageChunk(sessionId: string, stageId: string, path: string, offset: number, chunk: Blob) {
    const response = await fetch(`${BASE}/execute/sessions/${encodeURIComponent(sessionId)}/stage/${encodeURIComponent(stageId)}/chunk`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Device-Id": getDeviceId(),
            "X-Stage-Path": path,
            "X-Stage-Offset": String(offset),
        },
        body: chunk,
        signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
        throw new Error((await response.json().catch(() => ({ error: response.statusText })) as { error?: string }).error || response.statusText);
}
export async function commitWorkspaceStage(sessionId: string, stageId: string) {
    return workspaceRequest<{ revision: number }>(`/execute/sessions/${encodeURIComponent(sessionId)}/stage/${encodeURIComponent(stageId)}/commit`, "POST");
}
export async function removeWorkspaceStage(sessionId: string, stageId: string) {
    const response = await fetch(`${BASE}/execute/sessions/${encodeURIComponent(sessionId)}/stage/${encodeURIComponent(stageId)}`, {
        method: "DELETE",
        headers: { "X-Device-Id": getDeviceId() },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok && response.status !== 404)
        throw new Error(response.statusText);
}
export interface RuntimeInfo {
    name: string;
    available: boolean;
}
export async function getAvailableRuntimes(): Promise<RuntimeInfo[]> {
    try {
        const response = await fetch(`${BASE}/execute/runtimes`, { signal: AbortSignal.timeout(5000), headers: getHeaders() });
        if (!response.ok)
            return [];
        return ((await response.json()) as {
            runtimes?: RuntimeInfo[];
        }).runtimes ?? [];
    }
    catch {
        return [];
    }
}
export async function getWorkspaceRuntimeStatus(): Promise<{
    ready: boolean;
}> {
    try {
        const response = await fetch(`${BASE}/execute/runtimes`, { signal: AbortSignal.timeout(5000), headers: getHeaders() });
        if (!response.ok)
            return { ready: false };
        const data = await response.json() as {
            status?: {
                ready?: boolean;
            };
        };
        return { ready: data.status?.ready === true };
    }
    catch {
        return { ready: false };
    }
}
export type ApkJobMode = "inspect" | "resources" | "full";
export type ApkJob = {
    id: string;
    workspaceSessionId: string;
    sourcePath: string;
    mode: ApkJobMode;
    status: "queued" | "running" | "complete" | "failed" | "expired";
    createdAt: number;
    expiresAt: number;
    log: string;
    error: string | null;
    artifactReady: boolean;
    artifactSigned: boolean;
};
export async function createApkJob(workspaceSessionId: string, sourcePath: string, mode: ApkJobMode) {
    return workspaceRequest<ApkJob>("/apk/jobs", "POST", { workspaceSessionId, sourcePath, mode });
}
export async function getApkJob(id: string) {
    return workspaceRequest<ApkJob>(`/apk/jobs/${encodeURIComponent(id)}`, "GET");
}
export async function getApkDecodedEntries(id: string) {
    return workspaceRequest<{ entries: string[] }>(`/apk/jobs/${encodeURIComponent(id)}/entries`, "GET");
}
export async function getApkDecodedEntry(id: string, entryPath: string) {
    return workspaceRequest<{ path: string; size: number; content: string }>(`/apk/jobs/${encodeURIComponent(id)}/entries/${entryPath.split("/").map(encodeURIComponent).join("/")}`, "GET");
}
export async function updateApkDecodedEntry(id: string, entryPath: string, content: string) {
    return workspaceRequest<{ path: string; size: number }>(`/apk/jobs/${encodeURIComponent(id)}/entries/${entryPath.split("/").map(encodeURIComponent).join("/")}`, "PUT", { content });
}
export async function buildApkJob(id: string, outputName?: string, sign = false) {
    return workspaceRequest<ApkJob>(`/apk/jobs/${encodeURIComponent(id)}/build`, "POST", { outputName, sign });
}
export function getApkArtifactUrl(id: string) {
    return `${BASE}/apk/jobs/${encodeURIComponent(id)}/artifact`;
}
export async function downloadApkArtifact(id: string) {
    const response = await fetch(getApkArtifactUrl(id), { headers: { "X-Device-Id": getDeviceId() }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({ error: response.statusText })) as { error?: string }).error || response.statusText);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "sk-coder-unsigned.apk";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export type TerminalSocketHandlers = {
    onReady: (sessionId: string, mode?: string) => void;
    onStdout: (data: string) => void;
    onStderr: (data: string) => void;
    onExit: (code: number) => void;
    onState?: (state: "live" | "running", cwd?: string) => void;
    onError: (error: string) => void;
    onClose: (reason: string) => void;
};
export function createTerminalWebSocket(handlers: TerminalSocketHandlers, sessionId?: string, terminalId = "shell") {
    const query = new URLSearchParams({ terminalId });
    if (sessionId)
        query.set("sessionId", sessionId);
    const endpoint = `${WS_BASE}?${query.toString()}`;
    const ws = new WebSocket(endpoint);
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data as string) as {
                type?: string;
                data?: string;
                code?: number;
                sessionId?: string;
                mode?: string;
                state?: "live" | "running";
                cwd?: string;
            };
            if (message.type === "ready" && message.sessionId)
                handlers.onReady(message.sessionId, message.mode);
            else if (message.type === "stdout")
                handlers.onStdout(message.data ?? "");
            else if (message.type === "stderr")
                handlers.onStderr(message.data ?? "");
            else if (message.type === "exit")
                handlers.onExit(message.code ?? 0);
            else if (message.type === "state" && message.state)
                handlers.onState?.(message.state, message.cwd);
        }
        catch {
            handlers.onError("Invalid terminal response.");
        }
    };
    ws.onerror = () => handlers.onError("WebSocket connection failed");
    ws.onclose = (event) => handlers.onClose(event.reason || `WebSocket closed (${event.code})`);
    return {
        sendCommand: (command: string) => { if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "command", command })); },
        sendInput: (data: string) => { if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "input", data })); },
        interrupt: () => { if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "interrupt" })); },
        resize: (cols: number, rows: number) => { if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "resize", cols, rows })); },
        isOpen: () => ws.readyState === WebSocket.OPEN,
        close: () => ws.close(),
    };
}
