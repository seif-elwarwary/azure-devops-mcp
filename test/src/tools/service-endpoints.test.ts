// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureServiceEndpointTools, SERVICE_ENDPOINT_TOOLS } from "../../../src/tools/service-endpoints";

describe("service-endpoint tools", () => {
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

    configureServiceEndpointTools(server, tokenProvider, connectionProvider, userAgentProvider);
  });

  function mockFetchResponse(ok: boolean, status: number, text: string) {
    fetchMock.mockResolvedValue({ ok, status, text: () => Promise.resolve(text) });
  }

  describe("service_endpoint", () => {
    it("lists service endpoints", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint);
      mockFetchResponse(true, 200, JSON.stringify({ count: 1, value: [{ id: "ep1" }] }));

      const result = await handler({ action: "list", project: "proj" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/proj/_apis/serviceendpoint/endpoints?api-version=7.1-preview.4", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ count: 1, value: [{ id: "ep1" }] }));
    });

    it("gets a service endpoint by ID", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint);
      mockFetchResponse(true, 200, JSON.stringify({ id: "ep1", name: "MyConnection" }));

      const result = await handler({ action: "get", project: "proj", endpointId: "ep1" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/proj/_apis/serviceendpoint/endpoints/ep1?api-version=7.1-preview.4", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ id: "ep1", name: "MyConnection" }));
    });

    it("surfaces API errors", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint);
      mockFetchResponse(false, 403, "Forbidden");

      const result = await handler({ action: "get", project: "proj", endpointId: "ep1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
    });
  });

  describe("service_endpoint_write", () => {
    it("creates a service endpoint from JSON", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint_write);
      mockFetchResponse(true, 200, JSON.stringify({ id: "ep2", name: "New Connection" }));

      const endpoint = { name: "New Connection", type: "generic", url: "https://example.com" };
      const result = await handler({ action: "create", project: "proj", endpointJson: JSON.stringify(endpoint) });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/proj/_apis/serviceendpoint/endpoints?api-version=7.1-preview.4",
        expect.objectContaining({ method: "POST", body: JSON.stringify(endpoint) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: "ep2", name: "New Connection" }));
    });

    it("rejects invalid endpointJson", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint_write);
      const result = await handler({ action: "create", project: "proj", endpointJson: "not json" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("deletes a service endpoint", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint_write);
      mockFetchResponse(true, 204, "");

      const result = await handler({ action: "delete", project: "proj1", projectId: "proj1", endpointId: "ep1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/serviceendpoint/endpoints/ep1?projectIds=proj1&api-version=7.1-preview.4",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.content[0].text).toContain("deleted");
    });

    it("requires endpointId for update", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.service_endpoint_write);
      const result = await handler({ action: "update", project: "proj", endpointJson: "{}" });
      expect(result.isError).toBe(true);
    });
  });
});
