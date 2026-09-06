// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureGraphTools, GRAPH_TOOLS } from "../../../src/tools/graph";

describe("graph tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let userAgentProvider: () => string;
  let fetchMock: jest.Mock;

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue("fake-token");
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" });
    userAgentProvider = () => "Jest";

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    configureGraphTools(server, tokenProvider, connectionProvider, userAgentProvider);
  });

  function mockFetchResponse(ok: boolean, status: number, text: string) {
    fetchMock.mockResolvedValue({ ok, status, text: () => Promise.resolve(text) });
  }

  describe("graph_group", () => {
    it("lists groups scoped to a project", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group);
      mockFetchResponse(true, 200, JSON.stringify({ count: 1, value: [{ displayName: "Contributors" }] }));

      const result = await handler({ action: "list", scopeDescriptor: "scp.abc" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://vssps.dev.azure.com/contoso/_apis/graph/groups?api-version=7.1-preview.1&scopeDescriptor=scp.abc",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fake-token" }) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ count: 1, value: [{ displayName: "Contributors" }] }));
    });

    it("resolves a project descriptor", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group);
      mockFetchResponse(true, 200, JSON.stringify({ value: "vssgp.proj123" }));

      const result = await handler({ action: "resolve_project_descriptor", projectId: "guid-1" });

      expect(fetchMock).toHaveBeenCalledWith("https://vssps.dev.azure.com/contoso/_apis/graph/descriptors/guid-1?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: "vssgp.proj123" }));
    });

    it("surfaces API errors", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group);
      mockFetchResponse(false, 404, "Not found");

      const result = await handler({ action: "get", groupDescriptor: "vssgp.missing" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("404");
    });

    it("requires groupDescriptor for get", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group);
      const result = await handler({ action: "get" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("graph_group_write", () => {
    it("creates a group", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group_write);
      mockFetchResponse(true, 201, JSON.stringify({ displayName: "New Group" }));

      const result = await handler({ action: "create", displayName: "New Group", description: "desc", scopeDescriptor: "scp.abc" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://vssps.dev.azure.com/contoso/_apis/graph/groups?api-version=7.1-preview.1&scopeDescriptor=scp.abc",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ displayName: "New Group", description: "desc" }) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ displayName: "New Group" }));
    });

    it("deletes a group", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_group_write);
      mockFetchResponse(true, 204, "");

      const result = await handler({ action: "delete", groupDescriptor: "vssgp.abc" });

      expect(fetchMock).toHaveBeenCalledWith("https://vssps.dev.azure.com/contoso/_apis/graph/groups/vssgp.abc?api-version=7.1-preview.1", expect.objectContaining({ method: "DELETE" }));
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("graph_membership_write", () => {
    it("adds a membership", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_membership_write);
      mockFetchResponse(true, 200, "");

      const result = await handler({ action: "add", subjectDescriptor: "aad.user1", containerDescriptor: "vssgp.group1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://vssps.dev.azure.com/contoso/_apis/graph/memberships/aad.user1/vssgp.group1?api-version=7.1-preview.1",
        expect.objectContaining({ method: "PUT" })
      );
      expect(result.content[0].text).toContain("added");
    });

    it("removes a membership", async () => {
      const handler = getHandler(GRAPH_TOOLS.graph_membership_write);
      mockFetchResponse(true, 200, "");

      const result = await handler({ action: "remove", subjectDescriptor: "aad.user1", containerDescriptor: "vssgp.group1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://vssps.dev.azure.com/contoso/_apis/graph/memberships/aad.user1/vssgp.group1?api-version=7.1-preview.1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.content[0].text).toContain("removed");
    });
  });
});
