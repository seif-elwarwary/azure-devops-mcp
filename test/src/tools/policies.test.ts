// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configurePolicyTools, POLICY_TOOLS } from "../../../src/tools/policies";

describe("policy tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockPolicyApi: {
    getPolicyTypes: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPolicyConfigurations: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPolicyConfiguration: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPolicyConfiguration: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updatePolicyConfiguration: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deletePolicyConfiguration: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockPolicyApi = {
      getPolicyTypes: jest.fn(),
      getPolicyConfigurations: jest.fn(),
      getPolicyConfiguration: jest.fn(),
      createPolicyConfiguration: jest.fn(),
      updatePolicyConfiguration: jest.fn(),
      deletePolicyConfiguration: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getPolicyApi: jest.fn().mockResolvedValue(mockPolicyApi) });

    configurePolicyTools(server, tokenProvider, connectionProvider);
  });

  describe("policy", () => {
    it("lists policy types", async () => {
      const handler = getHandler(POLICY_TOOLS.policy);
      mockPolicyApi.getPolicyTypes.mockResolvedValue([{ id: "type1", displayName: "Minimum number of reviewers" }]);

      const result = await handler({ action: "list_types", project: "proj" });

      expect(mockPolicyApi.getPolicyTypes).toHaveBeenCalledWith("proj");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "type1", displayName: "Minimum number of reviewers" }]);
    });

    it("lists policy configurations with scope and type filters", async () => {
      const handler = getHandler(POLICY_TOOLS.policy);
      mockPolicyApi.getPolicyConfigurations.mockResolvedValue({ value: [{ id: 1 }] });

      const result = await handler({ action: "list", project: "proj", scope: "repo1", policyTypeId: "type1" });

      expect(mockPolicyApi.getPolicyConfigurations).toHaveBeenCalledWith("proj", "repo1", "type1");
      expect(JSON.parse(result.content[0].text)).toEqual({ value: [{ id: 1 }] });
    });

    it("gets a single policy configuration", async () => {
      const handler = getHandler(POLICY_TOOLS.policy);
      mockPolicyApi.getPolicyConfiguration.mockResolvedValue({ id: 1, isEnabled: true });

      const result = await handler({ action: "get", project: "proj", configurationId: 1 });

      expect(mockPolicyApi.getPolicyConfiguration).toHaveBeenCalledWith("proj", 1);
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, isEnabled: true });
    });

    it("requires configurationId for get", async () => {
      const handler = getHandler(POLICY_TOOLS.policy);
      const result = await handler({ action: "get", project: "proj" });
      expect(result.isError).toBe(true);
    });
  });

  describe("policy_write", () => {
    it("creates a policy configuration", async () => {
      const handler = getHandler(POLICY_TOOLS.policy_write);
      mockPolicyApi.createPolicyConfiguration.mockResolvedValue({ id: 5 });

      const settings = { minimumApproverCount: 2, scope: [{ repositoryId: "repo1", refName: "refs/heads/main" }] };
      const result = await handler({ action: "create", project: "proj", policyTypeId: "type1", settingsJson: JSON.stringify(settings), isEnabled: true, isBlocking: true });

      expect(mockPolicyApi.createPolicyConfiguration).toHaveBeenCalledWith({ type: { id: "type1" }, isEnabled: true, isBlocking: true, settings }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 5 });
    });

    it("rejects invalid settingsJson on create", async () => {
      const handler = getHandler(POLICY_TOOLS.policy_write);
      const result = await handler({ action: "create", project: "proj", policyTypeId: "type1", settingsJson: "not json", isEnabled: true, isBlocking: true });

      expect(result.isError).toBe(true);
      expect(mockPolicyApi.createPolicyConfiguration).not.toHaveBeenCalled();
    });

    it("updates a policy configuration, merging existing settings when settingsJson is omitted", async () => {
      const handler = getHandler(POLICY_TOOLS.policy_write);
      mockPolicyApi.getPolicyConfiguration.mockResolvedValue({ id: 5, type: { id: "type1" }, isEnabled: true, isBlocking: true, settings: { minimumApproverCount: 2 } });
      mockPolicyApi.updatePolicyConfiguration.mockResolvedValue({ id: 5, isEnabled: false });

      const result = await handler({ action: "update", project: "proj", configurationId: 5, isEnabled: false, isBlocking: true });

      expect(mockPolicyApi.updatePolicyConfiguration).toHaveBeenCalledWith({ id: 5, type: { id: "type1" }, isEnabled: false, isBlocking: true, settings: { minimumApproverCount: 2 } }, "proj", 5);
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 5, isEnabled: false });
    });

    it("deletes a policy configuration", async () => {
      const handler = getHandler(POLICY_TOOLS.policy_write);
      const result = await handler({ action: "delete", project: "proj", configurationId: 5 });

      expect(mockPolicyApi.deletePolicyConfiguration).toHaveBeenCalledWith("proj", 5);
      expect(result.content[0].text).toContain("deleted");
    });

    it("requires configurationId for delete", async () => {
      const handler = getHandler(POLICY_TOOLS.policy_write);
      const result = await handler({ action: "delete", project: "proj" });
      expect(result.isError).toBe(true);
    });
  });
});
