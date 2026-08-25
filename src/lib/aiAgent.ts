export type AgentAction = {
    id: string;
    type: "read";
    path: string;
} | {
    id: string;
    type: "write";
    path: string;
    content: string;
} | {
    id: string;
    type: "create_folder";
    path: string;
} | {
    id: string;
    type: "rename";
    path: string;
    name: string;
} | {
    id: string;
    type: "move";
    path: string;
    folderPath: string;
} | {
    id: string;
    type: "delete";
    path: string;
} | {
    id: string;
    type: "run";
    command: string;
} | {
    id: string;
    type: "preview";
    path?: string;
};
type RawAction = {
    type?: unknown;
    path?: unknown;
    content?: unknown;
    command?: unknown;
    name?: unknown;
    folderPath?: unknown;
};
function safePath(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim() || value.length > 240)
        return false;
    const path = value.trim();
    return path.startsWith("/") && !path.includes("\0") && !path.split("/").includes("..");
}
function safeName(value: unknown): value is string {
    return typeof value === "string" && Boolean(value.trim()) && value.trim().length <= 120 && !/[\\/\0]/.test(value) && value !== "." && value !== "..";
}
function safeCommand(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 2000 && !value.includes("\0");
}
export function buildAgentInstruction() {
    return "Act as a workspace-aware coding assistant. Use only the user workspace supplied in context. First explain the diagnosis and the smallest safe plan. When the user asks to inspect, create, edit, organize, preview, or run workspace code, always return one <sk-actions> JSON array that contains the smallest proposed workspace action or actions for explicit review. Supported actions are read {type,path}, write {type,path,content}, create_folder {type,path}, rename {type,path,name}, move {type,path,folderPath}, delete {type,path}, run {type,command}, and preview {type,path}. Use absolute workspace paths. Do not claim an action has already happened. Each action is reviewed by the user before it is applied. Use read first if a needed workspace file is not supplied. For one-file source execution, use run with command run /absolute/path/to/file.ext. For package, build, project, server, or multi-step commands, propose the exact command and explain that it opens SK Shell. Ask a question instead of guessing when the task is ambiguous.";
}
export function extractAgentProposal(reply: string) {
    const match = reply.match(/<sk-actions>\s*([\s\S]*?)\s*<\/sk-actions>/i);
    if (!match)
        return { explanation: reply.trim(), actions: [] as AgentAction[] };
    const explanation = reply.replace(match[0], "").trim();
    try {
        const raw = JSON.parse(match[1]) as unknown;
        if (!Array.isArray(raw))
            return { explanation, actions: [] as AgentAction[] };
        const actions: AgentAction[] = [];
        raw.slice(0, 12).forEach((value, index) => {
            const action = value as RawAction;
            const id = `${Date.now().toString(36)}-${index}`;
            if (action.type === "read" && safePath(action.path))
                actions.push({ id, type: "read", path: action.path });
            else if (action.type === "write" && safePath(action.path) && typeof action.content === "string" && action.content.length <= 2000000)
                actions.push({ id, type: "write", path: action.path, content: action.content });
            else if (action.type === "create_folder" && safePath(action.path))
                actions.push({ id, type: "create_folder", path: action.path });
            else if (action.type === "rename" && safePath(action.path) && safeName(action.name))
                actions.push({ id, type: "rename", path: action.path, name: action.name.trim() });
            else if (action.type === "move" && safePath(action.path) && safePath(action.folderPath))
                actions.push({ id, type: "move", path: action.path, folderPath: action.folderPath });
            else if (action.type === "delete" && safePath(action.path))
                actions.push({ id, type: "delete", path: action.path });
            else if (action.type === "run" && safeCommand(action.command))
                actions.push({ id, type: "run", command: action.command });
            else if (action.type === "preview" && (action.path === undefined || safePath(action.path)))
                actions.push(typeof action.path === "string" ? { id, type: "preview", path: action.path } : { id, type: "preview" });
        });
        return { explanation, actions };
    }
    catch {
        return { explanation, actions: [] as AgentAction[] };
    }
}
export function actionLabel(action: AgentAction) {
    if (action.type === "read")
        return `Open ${action.path}`;
    if (action.type === "write")
        return `Write ${action.path}`;
    if (action.type === "create_folder")
        return `Create folder ${action.path}`;
    if (action.type === "rename")
        return `Rename ${action.path} to ${action.name}`;
    if (action.type === "move")
        return `Move ${action.path} to ${action.folderPath}`;
    if (action.type === "delete")
        return `Delete ${action.path}`;
    if (action.type === "run")
        return `Run ${action.command}`;
    return `Open ${action.path || "workspace"} in Preview`;
}
