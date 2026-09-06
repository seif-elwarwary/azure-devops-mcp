// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureServiceHookTools, SERVICE_HOOK_TOOLS } from "../../../src/tools/service-hooks";

describe("service-hook tools", () => {
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

    configureServiceHookTools(server, tokenProvider, connectionProvider, userAgentProvider);
  });

  function mockFetchResponse(ok: boolean, status: number, text: string) {
    fetchMock.mockResolvedValue({ ok, status, text: () => Promise.resolve(text) });
  }

  describe("service_hook", () => {
    it("lists publishers", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ id: "tfs" }] }));

      const result = await handler({ action: "list_publishers" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/hooks/publishers?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ id: "tfs" }] }));
    });

    it("lists event types for a publisher", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ id: "git.push" }] }));

      const result = await handler({ action: "list_event_types", publisherId: "tfs" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/hooks/publishers/tfs/eventTypes?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ id: "git.push" }] }));
    });

    it("lists subscriptions", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ id: "sub1" }] }));

      const result = await handler({ action: "list_subscriptions" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/hooks/subscriptions?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ id: "sub1" }] }));
    });

    it("requires publisherId for list_event_types", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook);
      const result = await handler({ action: "list_event_types" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("service_hook_write", () => {
    it("creates a subscription from JSON", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook_write);
      mockFetchResponse(true, 200, JSON.stringify({ id: "sub2" }));

      const subscription = { publisherId: "tfs", eventType: "git.push", consumerId: "webHooks", consumerActionId: "httpRequest" };
      const result = await handler({ action: "create", subscriptionJson: JSON.stringify(subscription) });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/hooks/subscriptions?api-version=7.1-preview.1",
        expect.objectContaining({ method: "POST", body: JSON.stringify(subscription) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: "sub2" }));
    });

    it("rejects invalid subscriptionJson", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook_write);
      const result = await handler({ action: "create", subscriptionJson: "not json" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("deletes a subscription", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook_write);
      mockFetchResponse(true, 204, "");

      const result = await handler({ action: "delete", subscriptionId: "sub2" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/hooks/subscriptions/sub2?api-version=7.1-preview.1", expect.objectContaining({ method: "DELETE" }));
      expect(result.content[0].text).toContain("deleted");
    });

    it("requires subscriptionId for delete", async () => {
      const handler = getHandler(SERVICE_HOOK_TOOLS.service_hook_write);
      const result = await handler({ action: "delete" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
