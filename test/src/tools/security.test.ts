// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureSecurityTools, SECURITY_TOOLS } from "../../../src/tools/security";

describe("security tools", () => {
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

    configureSecurityTools(server, tokenProvider, connectionProvider, userAgentProvider);
  });

  function mockFetchResponse(ok: boolean, status: number, text: string) {
    fetchMock.mockResolvedValue({ ok, status, text: () => Promise.resolve(text) });
  }

  describe("security_namespace", () => {
    it("lists namespaces", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_namespace);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ namespaceId: "ns1" }] }));

      const result = await handler({ action: "list" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/securitynamespaces?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ namespaceId: "ns1" }] }));
    });

    it("gets a namespace by ID", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_namespace);
      mockFetchResponse(true, 200, JSON.stringify({ namespaceId: "ns1", actions: [] }));

      const result = await handler({ action: "get", securityNamespaceId: "ns1" });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/securitynamespaces/ns1?api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ namespaceId: "ns1", actions: [] }));
    });

    it("requires securityNamespaceId for get", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_namespace);
      const result = await handler({ action: "get" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("security_acl", () => {
    it("gets the ACL for a token", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl);
      mockFetchResponse(true, 200, JSON.stringify({ value: [{ token: "repoV2/repo1", acesDictionary: {} }] }));

      const result = await handler({ securityNamespaceId: "ns1", token: "repoV2/repo1", includeExtendedInfo: false });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/accesscontrollists/ns1?token=repoV2%2Frepo1&includeExtendedInfo=false&api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [{ token: "repoV2/repo1", acesDictionary: {} }] }));
    });

    it("filters by descriptors when provided", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl);
      mockFetchResponse(true, 200, "{}");

      await handler({ securityNamespaceId: "ns1", token: "repoV2/repo1", descriptors: ["desc1", "desc2"], includeExtendedInfo: false });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/accesscontrollists/ns1?token=repoV2%2Frepo1&includeExtendedInfo=false&descriptors=desc1%2Cdesc2&api-version=7.1-preview.1",
        expect.anything()
      );
    });
  });

  describe("security_acl_write", () => {
    it("sets ACEs from JSON", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl_write);
      mockFetchResponse(true, 200, JSON.stringify({ count: 1, value: [] }));

      const acl = { value: [{ token: "repoV2/repo1", merge: true, accessControlEntries: [{ descriptor: "desc1", allow: 2, deny: 0 }] }] };
      const result = await handler({ action: "set", securityNamespaceId: "ns1", aclJson: JSON.stringify(acl) });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/accesscontrollists/ns1?api-version=7.1-preview.1",
        expect.objectContaining({ method: "POST", body: JSON.stringify(acl) })
      );
      expect(result.content[0].text).toBe(JSON.stringify({ count: 1, value: [] }));
    });

    it("rejects invalid aclJson", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl_write);
      const result = await handler({ action: "set", securityNamespaceId: "ns1", aclJson: "not json" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("removes the entire ACL for a token", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl_write);
      mockFetchResponse(true, 204, "");

      const result = await handler({ action: "remove", securityNamespaceId: "ns1", token: "repoV2/repo1" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/accesscontrollists/ns1?tokens=repoV2%2Frepo1&api-version=7.1-preview.1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.content[0].text).toContain("removed");
    });

    it("requires token for remove", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_acl_write);
      const result = await handler({ action: "remove", securityNamespaceId: "ns1" });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("security_permission", () => {
    it("checks permissions for tokens", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_permission);
      mockFetchResponse(true, 200, JSON.stringify({ value: [true] }));

      const result = await handler({ securityNamespaceId: "ns1", permissions: 2, tokens: ["repoV2/repo1"] });

      expect(fetchMock).toHaveBeenCalledWith("https://dev.azure.com/contoso/_apis/permissions/ns1/2?tokens=repoV2%2Frepo1&api-version=7.1-preview.1", expect.anything());
      expect(result.content[0].text).toBe(JSON.stringify({ value: [true] }));
    });

    it("surfaces API errors", async () => {
      const handler = getHandler(SECURITY_TOOLS.security_permission);
      mockFetchResponse(false, 401, "Unauthorized");

      const result = await handler({ securityNamespaceId: "ns1", permissions: 2, tokens: ["repoV2/repo1"] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("401");
    });
  });
});
