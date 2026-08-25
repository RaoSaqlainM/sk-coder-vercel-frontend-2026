import { describe, expect, it } from "vitest";
import { resolveWebSocketBase } from "./backendEndpoints";

describe("backend endpoint resolution", () => {
    it("derives the terminal WebSocket from a configured HTTPS API base", () => {
        expect(resolveWebSocketBase("https://backend.example.test/api")).toBe("wss://backend.example.test/api/ws/terminal");
    });

    it("uses an explicit WebSocket endpoint when supplied", () => {
        expect(resolveWebSocketBase("https://backend.example.test/api", "wss://terminal.example.test/api/ws/terminal")).toBe("wss://terminal.example.test/api/ws/terminal");
    });
});
