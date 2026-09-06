// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureReleaseTools, RELEASE_TOOLS } from "../../../src/tools/release";

function parseSpotlighted(text: string): unknown {
  const match = text.match(/^<<([0-9a-f]{32})>> \[UNTRUSTED [^\]]*\] <<\1>>\n([\s\S]*)\n<<\/\1>>$/);
  if (!match) throw new Error("Expected a spotlighted response");
  return JSON.parse(match[2]);
}

describe("release tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockReleaseApi: {
    getReleaseDefinitions: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getReleaseDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getReleaseDefinitionHistory: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createReleaseDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateReleaseDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteReleaseDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    undeleteReleaseDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getReleases: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRelease: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createRelease: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateRelease: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockReleaseApi = {
      getReleaseDefinitions: jest.fn(),
      getReleaseDefinition: jest.fn(),
      getReleaseDefinitionHistory: jest.fn(),
      createReleaseDefinition: jest.fn(),
      updateReleaseDefinition: jest.fn(),
      deleteReleaseDefinition: jest.fn(),
      undeleteReleaseDefinition: jest.fn(),
      getReleases: jest.fn(),
      getRelease: jest.fn(),
      createRelease: jest.fn(),
      updateRelease: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getReleaseApi: jest.fn().mockResolvedValue(mockReleaseApi) });

    configureReleaseTools(server, tokenProvider, connectionProvider);
  });

  describe("release_definition", () => {
    it("lists definitions", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_definition);
      mockReleaseApi.getReleaseDefinitions.mockResolvedValue([{ id: 1, name: "Def" }]);

      const result = await handler({ action: "list", project: "proj" });

      expect(mockReleaseApi.getReleaseDefinitions).toHaveBeenCalledWith("proj", undefined, undefined, undefined, undefined, undefined);
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: 1, name: "Def" }]);
    });

    it("gets a definition by ID", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_definition);
      mockReleaseApi.getReleaseDefinition.mockResolvedValue({ id: 1, name: "Def" });

      const result = await handler({ action: "get", project: "proj", definitionId: 1 });

      expect(mockReleaseApi.getReleaseDefinition).toHaveBeenCalledWith("proj", 1);
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, name: "Def" });
    });
  });

  describe("release_definition_write", () => {
    it("creates a definition from JSON", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_definition_write);
      mockReleaseApi.createReleaseDefinition.mockResolvedValue({ id: 2, name: "New Def" });

      const result = await handler({ action: "create", project: "proj", definitionJson: JSON.stringify({ name: "New Def" }) });

      expect(mockReleaseApi.createReleaseDefinition).toHaveBeenCalledWith({ name: "New Def" }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 2, name: "New Def" });
    });

    it("rejects invalid definitionJson", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_definition_write);
      const result = await handler({ action: "create", project: "proj", definitionJson: "not json" });
      expect(result.isError).toBe(true);
    });

    it("deletes a definition", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_definition_write);
      const result = await handler({ action: "delete", project: "proj", definitionId: 2, comment: "cleanup" });

      expect(mockReleaseApi.deleteReleaseDefinition).toHaveBeenCalledWith("proj", 2, "cleanup");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("release", () => {
    it("gets a release with spotlighted content", async () => {
      const handler = getHandler(RELEASE_TOOLS.release);
      const release = { id: 10, name: "Release 1" };
      mockReleaseApi.getRelease.mockResolvedValue(release);

      const result = await handler({ action: "get", project: "proj", releaseId: 10 });

      expect(mockReleaseApi.getRelease).toHaveBeenCalledWith("proj", 10);
      expect(parseSpotlighted(result.content[0].text)).toEqual(release);
    });
  });

  describe("release_write", () => {
    it("creates a release", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_write);
      mockReleaseApi.createRelease.mockResolvedValue({ id: 11 });

      const result = await handler({ action: "create", project: "proj", definitionId: 1, description: "deploy", artifactAlias: "build", artifactBuildId: "123" });

      expect(mockReleaseApi.createRelease).toHaveBeenCalledWith({ definitionId: 1, description: "deploy", artifacts: [{ alias: "build", instanceReference: { id: "123" } }] }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 11 });
    });

    it("abandons a release", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_write);
      mockReleaseApi.getRelease.mockResolvedValue({ id: 11, status: 2 });
      mockReleaseApi.updateRelease.mockResolvedValue({ id: 11, status: 4 });

      const result = await handler({ action: "abandon", project: "proj", releaseId: 11 });

      expect(mockReleaseApi.updateRelease).toHaveBeenCalledWith({ id: 11, status: 4 }, "proj", 11);
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 11, status: 4 });
    });

    it("requires definitionId for create", async () => {
      const handler = getHandler(RELEASE_TOOLS.release_write);
      const result = await handler({ action: "create", project: "proj" });
      expect(result.isError).toBe(true);
    });
  });
});
