// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureGitAdminTools, GIT_ADMIN_TOOLS } from "../../../src/tools/git-admin";

function parseSpotlighted(text: string): unknown {
  const match = text.match(/^<<([0-9a-f]{32})>> \[UNTRUSTED [^\]]*\] <<\1>>\n([\s\S]*)\n<<\/\1>>$/);
  if (!match) throw new Error("Expected a spotlighted response");
  return JSON.parse(match[2]);
}

describe("git-admin tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockGitApi: {
    createRepository: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateRepository: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRepository: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteRepository: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    restoreRepositoryFromRecycleBin: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRecycleBinRepositories: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteRepositoryFromRecycleBin: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getAnnotatedTag: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createAnnotatedTag: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getCommitDiffs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getFileDiffs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPush: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockGitApi = {
      createRepository: jest.fn(),
      updateRepository: jest.fn(),
      getRepository: jest.fn(),
      deleteRepository: jest.fn(),
      restoreRepositoryFromRecycleBin: jest.fn(),
      getRecycleBinRepositories: jest.fn(),
      deleteRepositoryFromRecycleBin: jest.fn(),
      getRefs: jest.fn(),
      getAnnotatedTag: jest.fn(),
      createAnnotatedTag: jest.fn(),
      updateRefs: jest.fn(),
      getCommitDiffs: jest.fn(),
      getFileDiffs: jest.fn(),
      createPush: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getGitApi: jest.fn().mockResolvedValue(mockGitApi) });

    configureGitAdminTools(server, tokenProvider, connectionProvider);
  });

  describe("repo_repository_write", () => {
    it("creates a repository", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_repository_write);
      mockGitApi.createRepository.mockResolvedValue({ id: "repo1", name: "new-repo" });

      const result = await handler({ action: "create", project: "proj", name: "new-repo" });

      expect(mockGitApi.createRepository).toHaveBeenCalledWith({ name: "new-repo" }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "repo1", name: "new-repo" });
    });

    it("requires name for create", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_repository_write);
      const result = await handler({ action: "create", project: "proj" });
      expect(result.isError).toBe(true);
    });

    it("renames a repository on update", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_repository_write);
      mockGitApi.getRepository.mockResolvedValue({ id: "repo1", name: "old-name" });
      mockGitApi.updateRepository.mockResolvedValue({ id: "repo1", name: "new-name" });

      const result = await handler({ action: "update", project: "proj", repositoryId: "repo1", name: "new-name" });

      expect(mockGitApi.updateRepository).toHaveBeenCalledWith({ id: "repo1", name: "new-name" }, "repo1", "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "repo1", name: "new-name" });
    });

    it("soft-deletes a repository", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_repository_write);
      const result = await handler({ action: "delete", project: "proj", repositoryId: "repo1" });

      expect(mockGitApi.deleteRepository).toHaveBeenCalledWith("repo1", "proj");
      expect(result.content[0].text).toContain("moved to the recycle bin");
    });

    it("restores a repository from the recycle bin", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_repository_write);
      mockGitApi.restoreRepositoryFromRecycleBin.mockResolvedValue({ id: "repo1", name: "restored" });

      const result = await handler({ action: "restore", project: "proj", repositoryId: "repo1" });

      expect(mockGitApi.restoreRepositoryFromRecycleBin).toHaveBeenCalledWith({ deleted: false }, "proj", "repo1");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "repo1", name: "restored" });
    });
  });

  describe("repo_recycle_bin", () => {
    it("lists soft-deleted repositories", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_recycle_bin);
      mockGitApi.getRecycleBinRepositories.mockResolvedValue([{ id: "repo1", name: "deleted-repo" }]);

      const result = await handler({ action: "list", project: "proj" });

      expect(mockGitApi.getRecycleBinRepositories).toHaveBeenCalledWith("proj");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "repo1", name: "deleted-repo" }]);
    });

    it("permanently deletes a repository from the recycle bin", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_recycle_bin);
      const result = await handler({ action: "delete", project: "proj", repositoryId: "repo1" });

      expect(mockGitApi.deleteRepositoryFromRecycleBin).toHaveBeenCalledWith("proj", "repo1");
      expect(result.content[0].text).toContain("permanently deleted");
    });
  });

  describe("repo_tag", () => {
    it("lists tags", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v1.0", objectId: "abc123" }]);

      const result = await handler({ action: "list", repositoryId: "repo1", project: "proj", top: 100 });

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo1", "proj", "tags/", undefined, undefined, undefined, undefined, undefined, undefined);
      expect(JSON.parse(result.content[0].text)).toEqual([{ name: "v1.0", objectId: "abc123" }]);
    });

    it("gets a lightweight tag (no annotated tag object)", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v1.0", objectId: "abc123" }]);
      mockGitApi.getAnnotatedTag.mockRejectedValue(new Error("not found"));

      const result = await handler({ action: "get", repositoryId: "repo1", project: "proj", tagName: "v1.0" });

      expect(JSON.parse(result.content[0].text)).toEqual({ name: "v1.0", objectId: "abc123" });
    });

    it("gets an annotated tag with message details", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v1.0", objectId: "tagobj1" }]);
      mockGitApi.getAnnotatedTag.mockResolvedValue({ message: "release", taggedBy: { name: "user1" }, taggedObject: { objectId: "commit1" } });

      const result = await handler({ action: "get", repositoryId: "repo1", project: "proj", tagName: "v1.0" });

      expect(JSON.parse(result.content[0].text)).toEqual({
        name: "v1.0",
        objectId: "tagobj1",
        message: "release",
        taggedBy: { name: "user1" },
        taggedObjectId: "commit1",
      });
    });

    it("errors when tag not found", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag);
      mockGitApi.getRefs.mockResolvedValue([]);

      const result = await handler({ action: "get", repositoryId: "repo1", project: "proj", tagName: "missing" });

      expect(result.isError).toBe(true);
    });
  });

  describe("repo_tag_write", () => {
    it("creates a lightweight tag from a branch", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag_write);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);
      mockGitApi.updateRefs.mockResolvedValue([{ success: true }]);

      const result = await handler({ action: "create", repositoryId: "repo1", project: "proj", tagName: "v1.0", sourceBranchName: "main" });

      expect(mockGitApi.createAnnotatedTag).not.toHaveBeenCalled();
      expect(mockGitApi.updateRefs).toHaveBeenCalledWith([{ name: "refs/tags/v1.0", newObjectId: "commit1", oldObjectId: "0000000000000000000000000000000000000000" }], "repo1", "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ name: "v1.0", objectId: "commit1" });
    });

    it("creates an annotated tag when a message is given", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag_write);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);
      mockGitApi.createAnnotatedTag.mockResolvedValue({ objectId: "tagobj1", message: "release notes" });
      mockGitApi.updateRefs.mockResolvedValue([{ success: true }]);

      const result = await handler({ action: "create", repositoryId: "repo1", project: "proj", tagName: "v1.0", sourceBranchName: "main", message: "release notes" });

      expect(mockGitApi.createAnnotatedTag).toHaveBeenCalledWith({ name: "v1.0", message: "release notes", taggedObject: { objectId: "commit1" } }, "proj", "repo1");
      expect(mockGitApi.updateRefs).toHaveBeenCalledWith([{ name: "refs/tags/v1.0", newObjectId: "tagobj1", oldObjectId: "0000000000000000000000000000000000000000" }], "repo1", "proj");
      expect(JSON.parse(result.content[0].text)).toMatchObject({ message: "release notes" });
    });

    it("errors when the ref update fails", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag_write);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);
      mockGitApi.updateRefs.mockResolvedValue([{ success: false, customMessage: "ref already exists" }]);

      const result = await handler({ action: "create", repositoryId: "repo1", project: "proj", tagName: "v1.0", sourceBranchName: "main" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ref already exists");
    });

    it("deletes a tag", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_tag_write);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v1.0", objectId: "commit1" }]);
      mockGitApi.updateRefs.mockResolvedValue([{ success: true }]);

      const result = await handler({ action: "delete", repositoryId: "repo1", project: "proj", tagName: "v1.0" });

      expect(mockGitApi.updateRefs).toHaveBeenCalledWith([{ name: "refs/tags/v1.0", newObjectId: "0000000000000000000000000000000000000000", oldObjectId: "commit1" }], "repo1", "proj");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("repo_commit_diff", () => {
    it("returns commit diffs between two branches", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_commit_diff);
      const diffs = { aheadCount: 2, behindCount: 0, changes: [{ item: { path: "/a.ts" } }] };
      mockGitApi.getCommitDiffs.mockResolvedValue(diffs);

      const result = await handler({
        repositoryId: "repo1",
        project: "proj",
        baseVersion: "main",
        baseVersionType: "Branch",
        targetVersion: "feature",
        targetVersionType: "Branch",
        top: 100,
        skip: 0,
      });

      expect(mockGitApi.getCommitDiffs).toHaveBeenCalledWith("repo1", "proj", undefined, 100, 0, { baseVersion: "main", baseVersionType: 0 }, { targetVersion: "feature", targetVersionType: 0 });
      expect(parseSpotlighted(result.content[0].text)).toEqual(diffs);
    });
  });

  describe("repo_file_diff", () => {
    it("returns file diffs for the given paths", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_file_diff);
      const fileDiffs = [{ path: "/a.ts", lineDiffBlocks: [] }];
      mockGitApi.getFileDiffs.mockResolvedValue(fileDiffs);

      const result = await handler({ repositoryId: "repo1", project: "proj", baseVersionCommit: "c1", targetVersionCommit: "c2", filePaths: ["/a.ts"] });

      expect(mockGitApi.getFileDiffs).toHaveBeenCalledWith({ baseVersionCommit: "c1", targetVersionCommit: "c2", fileDiffParams: [{ path: "/a.ts" }] }, "proj", "repo1");
      expect(parseSpotlighted(result.content[0].text)).toEqual(fileDiffs);
    });
  });

  describe("repo_push", () => {
    it("commits an edit to a branch", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_push);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);
      mockGitApi.createPush.mockResolvedValue({ pushId: 1 });

      const result = await handler({
        repositoryId: "repo1",
        project: "proj",
        branchName: "main",
        comment: "update file",
        changes: [{ changeType: "Edit", path: "/a.ts", content: "new content", contentType: "RawText" }],
      });

      expect(mockGitApi.createPush).toHaveBeenCalledWith(
        {
          refUpdates: [{ name: "refs/heads/main", oldObjectId: "commit1" }],
          commits: [
            {
              comment: "update file",
              changes: [{ changeType: 2, item: { path: "/a.ts" }, originalPath: undefined, newContent: { content: "new content", contentType: 0 } }],
            },
          ],
        },
        "repo1",
        "proj"
      );
      expect(JSON.parse(result.content[0].text)).toEqual({ pushId: 1 });
    });

    it("requires content for an Edit change", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_push);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);

      const result = await handler({ repositoryId: "repo1", project: "proj", branchName: "main", comment: "x", changes: [{ changeType: "Edit", path: "/a.ts" }] });

      expect(result.isError).toBe(true);
      expect(mockGitApi.createPush).not.toHaveBeenCalled();
    });

    it("requires originalPath for a Rename change", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_push);
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main", objectId: "commit1" }]);

      const result = await handler({ repositoryId: "repo1", project: "proj", branchName: "main", comment: "x", changes: [{ changeType: "Rename", path: "/b.ts" }] });

      expect(result.isError).toBe(true);
      expect(mockGitApi.createPush).not.toHaveBeenCalled();
    });

    it("errors when the target branch does not exist", async () => {
      const handler = getHandler(GIT_ADMIN_TOOLS.repo_push);
      mockGitApi.getRefs.mockResolvedValue([]);

      const result = await handler({ repositoryId: "repo1", project: "proj", branchName: "missing", comment: "x", changes: [{ changeType: "Add", path: "/a.ts", content: "x" }] });

      expect(result.isError).toBe(true);
      expect(mockGitApi.createPush).not.toHaveBeenCalled();
    });
  });
});
