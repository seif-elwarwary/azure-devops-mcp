// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureDistributedTaskTools, DISTRIBUTED_TASK_TOOLS } from "../../../src/tools/distributedtask";

describe("distributedtask tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockTaskAgentApi: {
    getVariableGroups: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getVariableGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addVariableGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateVariableGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteVariableGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getTaskGroups: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getTaskGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addTaskGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateTaskGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteTaskGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getSecureFiles: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getSecureFile: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    uploadSecureFile: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteSecureFile: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getDeploymentGroups: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getDeploymentGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addDeploymentGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteDeploymentGroup: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getAgentPools: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getAgentPool: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addAgentPool: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteAgentPool: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getAgentQueues: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addAgentQueue: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteAgentQueue: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockTaskAgentApi = {
      getVariableGroups: jest.fn(),
      getVariableGroup: jest.fn(),
      addVariableGroup: jest.fn(),
      updateVariableGroup: jest.fn(),
      deleteVariableGroup: jest.fn(),
      getTaskGroups: jest.fn(),
      getTaskGroup: jest.fn(),
      addTaskGroup: jest.fn(),
      updateTaskGroup: jest.fn(),
      deleteTaskGroup: jest.fn(),
      getSecureFiles: jest.fn(),
      getSecureFile: jest.fn(),
      uploadSecureFile: jest.fn(),
      deleteSecureFile: jest.fn(),
      getDeploymentGroups: jest.fn(),
      getDeploymentGroup: jest.fn(),
      addDeploymentGroup: jest.fn(),
      deleteDeploymentGroup: jest.fn(),
      getAgentPools: jest.fn(),
      getAgentPool: jest.fn(),
      addAgentPool: jest.fn(),
      deleteAgentPool: jest.fn(),
      getAgentQueues: jest.fn(),
      addAgentQueue: jest.fn(),
      deleteAgentQueue: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getTaskAgentApi: jest.fn().mockResolvedValue(mockTaskAgentApi) });

    configureDistributedTaskTools(server, tokenProvider, connectionProvider);
  });

  describe("variable_group / variable_group_write", () => {
    it("lists variable groups", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.variable_group);
      mockTaskAgentApi.getVariableGroups.mockResolvedValue([{ id: 1, name: "vg1" }]);

      const result = await handler({ action: "list", project: "proj" });

      expect(mockTaskAgentApi.getVariableGroups).toHaveBeenCalledWith("proj", undefined);
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: 1, name: "vg1" }]);
    });

    it("creates a variable group", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.variable_group_write);
      mockTaskAgentApi.addVariableGroup.mockResolvedValue({ id: 2, name: "vg2" });

      const variables = { API_KEY: { value: "secret", isSecret: true } };
      const result = await handler({ action: "create", project: "proj1", projectId: "proj1", name: "vg2", description: "desc", variablesJson: JSON.stringify(variables) });

      expect(mockTaskAgentApi.addVariableGroup).toHaveBeenCalledWith({
        name: "vg2",
        description: "desc",
        type: "Vsts",
        variables,
        variableGroupProjectReferences: [{ name: "vg2", description: "desc", projectReference: { id: "proj1" } }],
      });
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 2, name: "vg2" });
    });

    it("deletes a variable group", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.variable_group_write);
      const result = await handler({ action: "delete", project: "proj1", projectId: "proj1", groupId: 2 });

      expect(mockTaskAgentApi.deleteVariableGroup).toHaveBeenCalledWith(2, ["proj1"]);
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("task_group / task_group_write", () => {
    it("lists task groups", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.task_group);
      mockTaskAgentApi.getTaskGroups.mockResolvedValue([{ id: "tg1" }]);

      const result = await handler({ action: "list", project: "proj" });

      expect(mockTaskAgentApi.getTaskGroups).toHaveBeenCalledWith("proj");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "tg1" }]);
    });

    it("creates a task group from JSON", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.task_group_write);
      mockTaskAgentApi.addTaskGroup.mockResolvedValue({ id: "tg2", name: "My Task Group" });

      const definition = { name: "My Task Group", tasks: [] };
      const result = await handler({ action: "create", project: "proj", taskGroupJson: JSON.stringify(definition) });

      expect(mockTaskAgentApi.addTaskGroup).toHaveBeenCalledWith(definition, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "tg2", name: "My Task Group" });
    });

    it("deletes a task group", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.task_group_write);
      const result = await handler({ action: "delete", project: "proj", taskGroupId: "tg2", comment: "cleanup" });

      expect(mockTaskAgentApi.deleteTaskGroup).toHaveBeenCalledWith("proj", "tg2", "cleanup");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("secure_file / secure_file_write", () => {
    it("uploads a secure file", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.secure_file_write);
      mockTaskAgentApi.uploadSecureFile.mockResolvedValue({ id: "sf1", name: "cert.pfx" });

      const result = await handler({ action: "upload", project: "proj", name: "cert.pfx", content: Buffer.from("data").toString("base64") });

      expect(mockTaskAgentApi.uploadSecureFile).toHaveBeenCalledWith(null, expect.anything(), "proj", "cert.pfx");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "sf1", name: "cert.pfx" });
    });

    it("deletes a secure file", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.secure_file_write);
      const result = await handler({ action: "delete", project: "proj", secureFileId: "sf1" });

      expect(mockTaskAgentApi.deleteSecureFile).toHaveBeenCalledWith("proj", "sf1");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("deployment_group / deployment_group_write", () => {
    it("creates a deployment group", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.deployment_group_write);
      mockTaskAgentApi.addDeploymentGroup.mockResolvedValue({ id: 5, name: "DG1" });

      const result = await handler({ action: "create", project: "proj", name: "DG1", description: "desc" });

      expect(mockTaskAgentApi.addDeploymentGroup).toHaveBeenCalledWith({ name: "DG1", description: "desc" }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 5, name: "DG1" });
    });

    it("deletes a deployment group", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.deployment_group_write);
      const result = await handler({ action: "delete", project: "proj", deploymentGroupId: 5 });

      expect(mockTaskAgentApi.deleteDeploymentGroup).toHaveBeenCalledWith("proj", 5);
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("agent_pool / agent_pool_write", () => {
    it("creates an agent pool", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.agent_pool_write);
      mockTaskAgentApi.addAgentPool.mockResolvedValue({ id: 7, name: "MyPool" });

      const result = await handler({ action: "create", name: "MyPool", isHosted: false });

      expect(mockTaskAgentApi.addAgentPool).toHaveBeenCalledWith({ name: "MyPool", isHosted: false, poolType: 1 });
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 7, name: "MyPool" });
    });

    it("deletes an agent pool", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.agent_pool_write);
      const result = await handler({ action: "delete", poolId: 7 });

      expect(mockTaskAgentApi.deleteAgentPool).toHaveBeenCalledWith(7);
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("agent_queue / agent_queue_write", () => {
    it("lists agent queues", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.agent_queue);
      mockTaskAgentApi.getAgentQueues.mockResolvedValue([{ id: 9, name: "Default" }]);

      const result = await handler({ project: "proj" });

      expect(mockTaskAgentApi.getAgentQueues).toHaveBeenCalledWith("proj", undefined);
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: 9, name: "Default" }]);
    });

    it("creates an agent queue", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.agent_queue_write);
      mockTaskAgentApi.addAgentQueue.mockResolvedValue({ id: 10, name: "Q1" });

      const result = await handler({ action: "create", project: "proj", name: "Q1", poolId: 7 });

      expect(mockTaskAgentApi.addAgentQueue).toHaveBeenCalledWith({ name: "Q1", pool: { id: 7 } }, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 10, name: "Q1" });
    });

    it("deletes an agent queue", async () => {
      const handler = getHandler(DISTRIBUTED_TASK_TOOLS.agent_queue_write);
      const result = await handler({ action: "delete", project: "proj", queueId: 10 });

      expect(mockTaskAgentApi.deleteAgentQueue).toHaveBeenCalledWith(10, "proj");
      expect(result.content[0].text).toContain("deleted");
    });
  });
});
