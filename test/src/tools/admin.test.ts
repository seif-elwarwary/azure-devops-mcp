// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureAdminTools, ADMIN_TOOLS } from "../../../src/tools/admin";

describe("admin tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockCoreApi: {
    queueCreateProject: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateProject: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    queueDeleteProject: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createTeam: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getTeam: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateTeam: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteTeam: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockCoreApi = {
      queueCreateProject: jest.fn(),
      updateProject: jest.fn(),
      queueDeleteProject: jest.fn(),
      createTeam: jest.fn(),
      getTeam: jest.fn(),
      updateTeam: jest.fn(),
      deleteTeam: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getCoreApi: jest.fn().mockResolvedValue(mockCoreApi) });

    configureAdminTools(server, tokenProvider, connectionProvider);
  });

  describe("core_project_write", () => {
    it("creates a project", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_project_write);
      mockCoreApi.queueCreateProject.mockResolvedValue({ id: "op1", status: "queued" });

      const result = await handler({ action: "create", name: "NewProj", description: "desc", sourceControlType: "Git", processTemplateId: "guid-1" });

      expect(mockCoreApi.queueCreateProject).toHaveBeenCalledWith({
        name: "NewProj",
        description: "desc",
        capabilities: { versioncontrol: { sourceControlType: "Git" }, processTemplate: { templateTypeId: "guid-1" } },
      });
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "op1", status: "queued" });
    });

    it("requires processTemplateId for create", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_project_write);
      const result = await handler({ action: "create", name: "NewProj" });
      expect(result.isError).toBe(true);
    });

    it("updates a project", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_project_write);
      mockCoreApi.updateProject.mockResolvedValue({ id: "op2", status: "queued" });

      const result = await handler({ action: "update", projectId: "proj1", description: "new desc" });

      expect(mockCoreApi.updateProject).toHaveBeenCalledWith({ description: "new desc" }, "proj1");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "op2", status: "queued" });
    });

    it("queues a project deletion", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_project_write);
      mockCoreApi.queueDeleteProject.mockResolvedValue({ id: "op3", status: "queued" });

      const result = await handler({ action: "delete", projectId: "proj1" });

      expect(mockCoreApi.queueDeleteProject).toHaveBeenCalledWith("proj1");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "op3", status: "queued" });
    });
  });

  describe("core_team_write", () => {
    it("creates a team", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_team_write);
      mockCoreApi.createTeam.mockResolvedValue({ id: "team1", name: "Team A" });

      const result = await handler({ action: "create", projectId: "proj1", name: "Team A", description: "desc" });

      expect(mockCoreApi.createTeam).toHaveBeenCalledWith({ name: "Team A", description: "desc" }, "proj1");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "team1", name: "Team A" });
    });

    it("renames a team on update", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_team_write);
      mockCoreApi.getTeam.mockResolvedValue({ id: "team1", name: "Old Name" });
      mockCoreApi.updateTeam.mockResolvedValue({ id: "team1", name: "New Name" });

      const result = await handler({ action: "update", projectId: "proj1", teamId: "team1", name: "New Name" });

      expect(mockCoreApi.updateTeam).toHaveBeenCalledWith({ id: "team1", name: "New Name" }, "proj1", "team1");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "team1", name: "New Name" });
    });

    it("deletes a team", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_team_write);
      const result = await handler({ action: "delete", projectId: "proj1", teamId: "team1" });

      expect(mockCoreApi.deleteTeam).toHaveBeenCalledWith("proj1", "team1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("requires teamId for delete", async () => {
      const handler = getHandler(ADMIN_TOOLS.core_team_write);
      const result = await handler({ action: "delete", projectId: "proj1" });
      expect(result.isError).toBe(true);
    });
  });
});
