import { describe, expect, it } from "vitest";
import { filterConsecutivePromptLines, isCleanLinuxPrompt } from "./terminalTranscript";

describe("terminal transcript prompt handling", () => {
    it("recognizes a clean Linux workspace prompt", () => {
        expect(isCleanLinuxPrompt("node@sk-coder:~$ ")).toBe(true);
        expect(isCleanLinuxPrompt("node@sk-coder:/workspace/project$ ")).toBe(true);
        expect(isCleanLinuxPrompt("browser-terminal-lifecycle-ok")).toBe(false);
    });

    it("drops only a consecutive reconnect prompt while retaining command output and the next prompt", () => {
        expect(filterConsecutivePromptLines(["node@sk-coder:~$"], ["node@sk-coder:~$", "browser-terminal-lifecycle-ok", "node@sk-coder:~$"], "output")).toEqual(["browser-terminal-lifecycle-ok", "node@sk-coder:~$"]);
    });

    it("normalizes terminal carriage-return prompt variants before comparing them", () => {
        expect(filterConsecutivePromptLines(["\rnode@sk-coder:~$"], ["node@sk-coder:~$ ", "browser-ack-once-ok", "\rnode@sk-coder:~$"], "output")).toEqual(["browser-ack-once-ok", "node@sk-coder:~$"]);
    });
});
