// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureWorkItemsAdminTools, WORK_ITEMS_ADMIN_TOOLS } from "../../../src/tools/work-items-admin";

describe("work-items-admin tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockWorkItemTrackingApi: {
    getClassificationNode: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createOrUpdateClassificationNode: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateClassificationNode: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteClassificationNode: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getTags: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getTag: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateTag: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteTag: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deleteQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createAttachment: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateWorkItem: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getDeletedWorkItemShallowReferences: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    restoreWorkItem: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    destroyWorkItem: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  function getHandler(toolName: string) {
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockWorkItemTrackingApi = {
      getClassificationNode: jest.fn(),
      createOrUpdateClassificationNode: jest.fn(),
      updateClassificationNode: jest.fn(),
      deleteClassificationNode: jest.fn(),
      getTags: jest.fn(),
      getTag: jest.fn(),
      updateTag: jest.fn(),
      deleteTag: jest.fn(),
      createQuery: jest.fn(),
      updateQuery: jest.fn(),
      deleteQuery: jest.fn(),
      createAttachment: jest.fn(),
      updateWorkItem: jest.fn(),
      getDeletedWorkItemShallowReferences: jest.fn(),
      restoreWorkItem: jest.fn(),
      destroyWorkItem: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({ getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemTrackingApi) });

    configureWorkItemsAdminTools(server, tokenProvider, connectionProvider);
  });

  describe("wit_area", () => {
    it("gets the area path tree", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_area);
      mockWorkItemTrackingApi.getClassificationNode.mockResolvedValue({ name: "proj", children: [] });

      const result = await handler({ project: "proj", depth: 1 });

      expect(mockWorkItemTrackingApi.getClassificationNode).toHaveBeenCalledWith("proj", 0, undefined, 1);
      expect(JSON.parse(result.content[0].text)).toEqual({ name: "proj", children: [] });
    });
  });

  describe("wit_area_write", () => {
    it("creates an area path", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_area_write);
      mockWorkItemTrackingApi.createOrUpdateClassificationNode.mockResolvedValue({ name: "Team A" });

      const result = await handler({ action: "create", project: "proj", name: "Team A" });

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalledWith({ name: "Team A" }, "proj", 0, undefined);
      expect(JSON.parse(result.content[0].text)).toEqual({ name: "Team A" });
    });

    it("renames an area path on update", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_area_write);
      mockWorkItemTrackingApi.updateClassificationNode.mockResolvedValue({ name: "Team B" });

      const result = await handler({ action: "update", project: "proj", path: "Team A", name: "Team B" });

      expect(mockWorkItemTrackingApi.updateClassificationNode).toHaveBeenCalledWith({ name: "Team B" }, "proj", 0, "Team A");
      expect(JSON.parse(result.content[0].text)).toEqual({ name: "Team B" });
    });

    it("deletes an area path", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_area_write);
      const result = await handler({ action: "delete", project: "proj", path: "Team A" });

      expect(mockWorkItemTrackingApi.deleteClassificationNode).toHaveBeenCalledWith("proj", 0, "Team A", undefined);
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("wit_tag", () => {
    it("lists tags", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_tag);
      mockWorkItemTrackingApi.getTags.mockResolvedValue([{ id: "1", name: "bug" }]);

      const result = await handler({ action: "list", project: "proj" });

      expect(mockWorkItemTrackingApi.getTags).toHaveBeenCalledWith("proj");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "1", name: "bug" }]);
    });
  });

  describe("wit_tag_write", () => {
    it("renames a tag", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_tag_write);
      mockWorkItemTrackingApi.updateTag.mockResolvedValue({ name: "defect" });

      const result = await handler({ action: "update", project: "proj", tagIdOrName: "bug", name: "defect" });

      expect(mockWorkItemTrackingApi.updateTag).toHaveBeenCalledWith({ name: "defect" }, "proj", "bug");
      expect(JSON.parse(result.content[0].text)).toEqual({ name: "defect" });
    });

    it("deletes a tag", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_tag_write);
      const result = await handler({ action: "delete", project: "proj", tagIdOrName: "bug" });

      expect(mockWorkItemTrackingApi.deleteTag).toHaveBeenCalledWith("proj", "bug");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("wit_query_write", () => {
    it("creates a flat query", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_query_write);
      mockWorkItemTrackingApi.createQuery.mockResolvedValue({ id: "q1", name: "My Query" });

      const result = await handler({ action: "create", project: "proj", path: "My Queries", name: "My Query", wiql: "SELECT [System.Id] FROM WorkItems", isFolder: false });

      expect(mockWorkItemTrackingApi.createQuery).toHaveBeenCalledWith({ name: "My Query", isFolder: false, wiql: "SELECT [System.Id] FROM WorkItems", isPublic: undefined }, "proj", "My Queries");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "q1", name: "My Query" });
    });

    it("requires wiql unless isFolder is true", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_query_write);
      const result = await handler({ action: "create", project: "proj", path: "My Queries", name: "My Query" });
      expect(result.isError).toBe(true);
    });

    it("creates a folder without wiql", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_query_write);
      mockWorkItemTrackingApi.createQuery.mockResolvedValue({ id: "f1", name: "Folder" });

      const result = await handler({ action: "create", project: "proj", path: "My Queries", name: "Folder", isFolder: true });

      expect(mockWorkItemTrackingApi.createQuery).toHaveBeenCalledWith({ name: "Folder", isFolder: true, wiql: undefined, isPublic: undefined }, "proj", "My Queries");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "f1", name: "Folder" });
    });

    it("deletes a query", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_query_write);
      const result = await handler({ action: "delete", project: "proj", path: "My Queries/My Query" });

      expect(mockWorkItemTrackingApi.deleteQuery).toHaveBeenCalledWith("proj", "My Queries/My Query");
      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("wit_attachment_write", () => {
    it("uploads an attachment without linking it", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_attachment_write);
      mockWorkItemTrackingApi.createAttachment.mockResolvedValue({ id: "att1", url: "https://example/attachments/att1" });

      const result = await handler({ project: "proj", fileName: "log.txt", content: Buffer.from("hello").toString("base64") });

      expect(mockWorkItemTrackingApi.createAttachment).toHaveBeenCalledWith(null, expect.anything(), "log.txt", undefined, "proj");
      expect(mockWorkItemTrackingApi.updateWorkItem).not.toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text)).toEqual({ id: "att1", url: "https://example/attachments/att1" });
    });

    it("uploads and links an attachment to a work item", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_attachment_write);
      mockWorkItemTrackingApi.createAttachment.mockResolvedValue({ id: "att1", url: "https://example/attachments/att1" });
      mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue({ id: 42 });

      const result = await handler({ project: "proj", fileName: "log.txt", content: Buffer.from("hello").toString("base64"), workItemId: 42, comment: "see attached" });

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
        null,
        [{ op: "add", path: "/relations/-", value: { rel: "AttachedFile", url: "https://example/attachments/att1", attributes: { comment: "see attached" } } }],
        42,
        "proj"
      );
      expect(JSON.parse(result.content[0].text)).toEqual({ attachment: { id: "att1", url: "https://example/attachments/att1" }, workItem: { id: 42 } });
    });
  });

  describe("wit_recycle_bin", () => {
    it("lists deleted work items", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_recycle_bin);
      mockWorkItemTrackingApi.getDeletedWorkItemShallowReferences.mockResolvedValue([{ id: 42 }]);

      const result = await handler({ project: "proj" });

      expect(mockWorkItemTrackingApi.getDeletedWorkItemShallowReferences).toHaveBeenCalledWith("proj");
      expect(JSON.parse(result.content[0].text)).toEqual([{ id: 42 }]);
    });
  });

  describe("wit_recycle_bin_write", () => {
    it("restores a deleted work item", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_recycle_bin_write);
      mockWorkItemTrackingApi.restoreWorkItem.mockResolvedValue({ id: 42, isDeleted: false });

      const result = await handler({ action: "restore", id: 42, project: "proj" });

      expect(mockWorkItemTrackingApi.restoreWorkItem).toHaveBeenCalledWith({ isDeleted: false }, 42, "proj");
      expect(JSON.parse(result.content[0].text)).toEqual({ id: 42, isDeleted: false });
    });

    it("permanently destroys a deleted work item", async () => {
      const handler = getHandler(WORK_ITEMS_ADMIN_TOOLS.wit_recycle_bin_write);
      const result = await handler({ action: "destroy", id: 42, project: "proj" });

      expect(mockWorkItemTrackingApi.destroyWorkItem).toHaveBeenCalledWith(42, "proj");
      expect(result.content[0].text).toContain("destroyed");
    });
  });
});
