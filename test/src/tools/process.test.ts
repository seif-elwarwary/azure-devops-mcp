// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureProcessTools, PROCESS_TOOLS } from "../../../src/tools/process";

describe("process tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockProcessApi: {
    getListOfProcesses: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getProcessByItsId: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getProcessWorkItemTypes: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getProcessWorkItemType: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getStateDefinitions: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createProcessWorkItemType: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateProcessWorkItemType: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteProcessWorkItemType: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    addFieldToWorkItemType: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateWorkItemTypeField: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createStateDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateStateDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteStateDefinition: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockProcessApi = {
      getListOfProcesses: jest.fn(),
      getProcessByItsId: jest.fn(),
      getProcessWorkItemTypes: jest.fn(),
      getProcessWorkItemType: jest.fn(),
      getStateDefinitions: jest.fn(),
      createProcessWorkItemType: jest.fn(),
      updateProcessWorkItemType: jest.fn(),
      deleteProcessWorkItemType: jest.fn(),
      addFieldToWorkItemType: jest.fn(),
      updateWorkItemTypeField: jest.fn(),
      createStateDefinition: jest.fn(),
      updateStateDefinition: jest.fn(),
      deleteStateDefinition: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getWorkItemTrackingProcessApi: jest.fn().mockResolvedValue(mockProcessApi) });

    configureProcessTools(server, tokenProvider, connectionProvider);
  });

  describe("process", () => {
    it("lists processes", async () => {
      const handler = getHandler(PROCESS_TOOLS.process);
      mockProcessApi.getListOfProcesses.mockResolvedValue([{ typeId: "p1", name: "Agile" }]);

      const result = await handler({ action: "list_processes" });

      expect(mockProcessApi.getListOfProcesses).toHaveBeenCalledWith();
      expect(JSON.parse(result.content[0].text)).toEqual([{ typeId: "p1", name: "Agile" }]);
    });

    it("gets work item types for a process", async () => {
      const handler = getHandler(PROCESS_TOOLS.process);
      mockProcessApi.getProcessWorkItemTypes.mockResolvedValue([{ referenceName: "Bug" }]);

      const result = await handler({ action: "list_work_item_types", processId: "p1" });

      expect(mockProcessApi.getProcessWorkItemTypes).toHaveBeenCalledWith("p1");
      expect(JSON.parse(result.content[0].text)).toEqual([{ referenceName: "Bug" }]);
    });

    it("lists states for a work item type", async () => {
      const handler = getHandler(PROCESS_TOOLS.process);
      mockProcessApi.getStateDefinitions.mockResolvedValue([{ id: "s1", name: "New" }]);

      const result = await handler({ action: "list_states", processId: "p1", witRefName: "Bug" });

      expect(mockProcessApi.getStateDefinitions).toHaveBeenCalledWith("p1", "Bug");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "s1", name: "New" }]);
    });

    it("requires witRefName for list_states", async () => {
      const handler = getHandler(PROCESS_TOOLS.process);
      const result = await handler({ action: "list_states", processId: "p1" });
      expect(result.isError).toBe(true);
    });
  });

  describe("process_work_item_type_write", () => {
    it("creates a work item type", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_work_item_type_write);
      mockProcessApi.createProcessWorkItemType.mockResolvedValue({ referenceName: "Custom.Feature" });

      const result = await handler({ action: "create", processId: "p1", name: "Feature", color: "FF0000", icon: "icon_book", inheritsFrom: "Microsoft.VSTS.WorkItemTypes.Issue" });

      expect(mockProcessApi.createProcessWorkItemType).toHaveBeenCalledWith(
        { name: "Feature", description: undefined, color: "FF0000", icon: "icon_book", inheritsFrom: "Microsoft.VSTS.WorkItemTypes.Issue" },
        "p1"
      );
      expect(JSON.parse(result.content[0].text)).toEqual({ referenceName: "Custom.Feature" });
    });

    it("deletes a work item type", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_work_item_type_write);
      const result = await handler({ action: "delete", processId: "p1", witRefName: "Custom.Feature" });

      expect(mockProcessApi.deleteProcessWorkItemType).toHaveBeenCalledWith("p1", "Custom.Feature");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("process_field_write", () => {
    it("adds a field to a work item type", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_field_write);
      mockProcessApi.addFieldToWorkItemType.mockResolvedValue({ referenceName: "Custom.Priority" });

      const result = await handler({ action: "add", processId: "p1", witRefName: "Bug", referenceName: "Custom.Priority", required: true });

      expect(mockProcessApi.addFieldToWorkItemType).toHaveBeenCalledWith(
        { referenceName: "Custom.Priority", allowedValues: undefined, defaultValue: undefined, readOnly: undefined, required: true },
        "p1",
        "Bug"
      );
      expect(JSON.parse(result.content[0].text)).toEqual({ referenceName: "Custom.Priority" });
    });
  });

  describe("process_state_write", () => {
    it("creates a state", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_state_write);
      mockProcessApi.createStateDefinition.mockResolvedValue({ id: "s2", name: "In Review" });

      const result = await handler({ action: "create", processId: "p1", witRefName: "Bug", name: "In Review", color: "0000FF", stateCategory: "InProgress", order: 3 });

      expect(mockProcessApi.createStateDefinition).toHaveBeenCalledWith({ name: "In Review", color: "0000FF", stateCategory: "InProgress", order: 3 }, "p1", "Bug");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "s2", name: "In Review" });
    });

    it("deletes a state", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_state_write);
      const result = await handler({ action: "delete", processId: "p1", witRefName: "Bug", stateId: "s2" });

      expect(mockProcessApi.deleteStateDefinition).toHaveBeenCalledWith("p1", "Bug", "s2");
      expect(result.content[0].text).toContain("deleted");
    });

    it("requires stateId for delete", async () => {
      const handler = getHandler(PROCESS_TOOLS.process_state_write);
      const result = await handler({ action: "delete", processId: "p1", witRefName: "Bug" });
      expect(result.isError).toBe(true);
    });
  });
});
