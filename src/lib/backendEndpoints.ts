export function resolveWebSocketBase(apiBase: string, configuredWebSocket?: string) {
    if (configuredWebSocket)
        return configuredWebSocket;
    return `${apiBase.replace(/^https:/, "wss:").replace(/^http:/, "ws:")}/ws/terminal`;
}
