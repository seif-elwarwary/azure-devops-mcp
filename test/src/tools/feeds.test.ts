// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureFeedTools, FEED_TOOLS } from "../../../src/tools/feeds";

describe("feed tools", () => {
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

    configureFeedTools(server, tokenProvider, connectionProvider, userAgentProvider);
  });

  function mockFetchResponse(ok: boolean, status: number, text: string) {
    fetchMock.mockResolvedValue({ ok, status, text: () => Promise.resolve(text) });
  }

  describe("feed", () => {
    it("lists organization-scoped feeds", async () => {
      const handler = getHandler(FEED_TOOLS.feed);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ id: "f1" }] }));

      const result = await handler({ action: "list" });

      expect(fetchMock).toHaveBeenCalledWith("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ id: "f1" }] }));
    });

    it("lists project-scoped feeds", async () => {
      const handler = getHandler(FEED_TOOLS.feed);
      mockFetchResponse(true, 200, JSON.stringify({ value: [] }));

      await handler({ action: "list", project: "proj" });

      expect(fetchMock).toHaveBeenCalledWith("https://feeds.dev.azure.com/contoso/proj/_apis/packaging/feeds?api-version=7.1-preview.1", expect.anything());
    });

    it("lists packages in a feed", async () => {
      const handler = getHandler(FEED_TOOLS.feed);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ id: "p1" }] }));

      const result = await handler({ action: "list_packages", feedId: "f1", includeAllVersions: false });

      expect(fetchMock).toHaveBeenCalledWith("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds/f1/packages?includeAllVersions=false&api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ id: "p1" }] }));
    });

    it("requires feedId for get_package", async () => {
      const handler = getHandler(FEED_TOOLS.feed);
      const result = await handler({ action: "get_package", packageId: "p1" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("feed_write", () => {
    it("creates a feed", async () => {
      const handler = getHandler(FEED_TOOLS.feed_write);
      mockFetchResponse(true, 200, JSON.stringify({ id: "f2", name: "MyFeed" }));

      const result = await handler({ action: "create", name: "MyFeed", description: "desc" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://feeds.dev.azure.com/contoso/_apis/packaging/feeds?api-version=7.1-preview.1",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "MyFeed", description: "desc" }) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: "f2", name: "MyFeed" }));
    });

    it("updates a feed", async () => {
      const handler = getHandler(FEED_TOOLS.feed_write);
      mockFetchResponse(true, 200, JSON.stringify({ id: "f2", description: "new desc" }));

      const result = await handler({ action: "update", feedId: "f2", description: "new desc" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://feeds.dev.azure.com/contoso/_apis/packaging/feeds/f2?api-version=7.1-preview.1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ description: "new desc" }) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: "f2", description: "new desc" }));
    });

    it("deletes a feed", async () => {
      const handler = getHandler(FEED_TOOLS.feed_write);
      mockFetchResponse(true, 204, "");

      const result = await handler({ action: "delete", feedId: "f2" });

      expect(fetchMock).toHaveBeenCalledWith("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds/f2?api-version=7.1-preview.1", expect.objectContaining({ method: "DELETE" }));
      expect(result.content[0].text).toContain("deleted");
    });

    it("rejects invalid feedJson", async () => {
      const handler = getHandler(FEED_TOOLS.feed_write);
      const result = await handler({ action: "create", name: "MyFeed", feedJson: "not json" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
