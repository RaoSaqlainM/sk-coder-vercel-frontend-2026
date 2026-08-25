import { describe, expect, it } from "vitest";
import { needsWorkspaceStage, workspaceTreeRevision } from "./workspaceConnection";

describe("workspace connection staging", () => {
    it("does not restage equivalent browser source after rehydration", () => {
        const first = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "same" }];
        const restored = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "same" }];
        expect(needsWorkspaceStage(workspaceTreeRevision(first), workspaceTreeRevision(restored))).toBe(false);
    });

    it("restages when browser source changes", () => {
        const first = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "before" }];
        const changed = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "after" }];
        expect(needsWorkspaceStage(workspaceTreeRevision(first), workspaceTreeRevision(changed))).toBe(true);
    });
});
