// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { QueryHierarchyItem, TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { Readable } from "stream";

const WORK_ITEMS_ADMIN_TOOLS = {
  wit_area: "wit_area",
  wit_area_write: "wit_area_write",
  wit_tag: "wit_tag",
  wit_tag_write: "wit_tag_write",
  wit_query_write: "wit_query_write",
  wit_attachment_write: "wit_attachment_write",
  wit_recycle_bin: "wit_recycle_bin",
  wit_recycle_bin_write: "wit_recycle_bin_write",
};

function configureWorkItemsAdminTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- wit_area ------------------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_area,
    "Get the area path tree for a project, optionally rooted at a specific path.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      path: z.string().optional().describe("Area path relative to the project root, e.g. 'Team A/Sub Area'. Defaults to the project root."),
      depth: z.coerce.number().int().min(0).optional().default(1).describe("How many levels of child area paths to include. Defaults to 1."),
    },
    async ({ project, path, depth }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        const node = await workItemTrackingApi.getClassificationNode(project, TreeStructureGroup.Areas, path, depth);
        return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error getting area path: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_area_write --------------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_area_write,
    "Create, rename, or delete an area path. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update (rename), delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      name: z.string().optional().describe("The area name. Required for create; the new name for update."),
      parentPath: z.string().optional().describe("Path of the parent area path to create under, relative to the project root. Used for create. Defaults to the project root."),
      path: z.string().optional().describe("The area path to update or delete, relative to the project root. Required for update and delete."),
      reclassifyId: z.coerce.number().int().optional().describe("The area path ID to move existing work items to when deleting. Used for delete."),
    },
    async ({ action, project, name, parentPath, path, reclassifyId }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const node = await workItemTrackingApi.createOrUpdateClassificationNode({ name }, project, TreeStructureGroup.Areas, parentPath);
          return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
        }

        if (action === "update") {
          if (!path) return { content: [{ type: "text", text: "path is required for update" }], isError: true };
          if (!name) return { content: [{ type: "text", text: "name is required for update" }], isError: true };

          const node = await workItemTrackingApi.updateClassificationNode({ name }, project, TreeStructureGroup.Areas, path);
          return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
        }

        if (action === "delete") {
          if (!path) return { content: [{ type: "text", text: "path is required for delete" }], isError: true };

          await workItemTrackingApi.deleteClassificationNode(project, TreeStructureGroup.Areas, path, reclassifyId);
          return { content: [{ type: "text", text: `Area path '${path}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with area path write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_tag ---------------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_tag,
    "Retrieve work item tag data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list (list all tags in a project), get (get a single tag by ID or name)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      tagIdOrName: z.string().optional().describe("The tag ID or name. Required for get."),
    },
    async ({ action, project, tagIdOrName }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        if (action === "list") {
          const tags = await workItemTrackingApi.getTags(project);
          return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
        }

        if (action === "get") {
          if (!tagIdOrName) return { content: [{ type: "text", text: "tagIdOrName is required for get" }], isError: true };

          const tag = await workItemTrackingApi.getTag(project, tagIdOrName);
          return { content: [{ type: "text", text: JSON.stringify(tag, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with tag operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_tag_write -----------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_tag_write,
    "Rename or delete a work item tag. Tags are created implicitly the first time they are applied to a work item. Use the action parameter to specify the operation.",
    {
      action: z.enum(["update", "delete"]).describe("The action to perform. Options: update (rename), delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      tagIdOrName: z.string().describe("The tag ID or name."),
      name: z.string().optional().describe("The new tag name. Required for update."),
    },
    async ({ action, project, tagIdOrName, name }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        if (action === "update") {
          if (!name) return { content: [{ type: "text", text: "name is required for update" }], isError: true };

          const tag = await workItemTrackingApi.updateTag({ name }, project, tagIdOrName);
          return { content: [{ type: "text", text: JSON.stringify(tag, null, 2) }] };
        }

        if (action === "delete") {
          await workItemTrackingApi.deleteTag(project, tagIdOrName);
          return { content: [{ type: "text", text: `Tag '${tagIdOrName}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with tag write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_query_write -----------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_query_write,
    "Create, update, or delete a work item query or query folder. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      path: z.string().describe("For create: the parent folder path to create under (e.g. 'My Queries'). For update/delete: the full path or ID of the query or folder to modify."),
      name: z.string().optional().describe("The name of the query or folder. Required for create."),
      wiql: z.string().optional().describe("The WIQL text for a flat query. Omit (with isFolder true) to create a folder instead."),
      isFolder: z.boolean().optional().default(false).describe("Whether this is a query folder rather than a flat query. Used for create. Defaults to false."),
      isPublic: z.boolean().optional().describe("Whether the query/folder is shared (public) rather than personal. Used for create and update."),
    },
    async ({ action, project, path, name, wiql, isFolder, isPublic }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };
          if (!isFolder && !wiql) return { content: [{ type: "text", text: "wiql is required for create unless isFolder is true" }], isError: true };

          const query: QueryHierarchyItem = { name, isFolder, wiql: isFolder ? undefined : wiql, isPublic };
          const created = await workItemTrackingApi.createQuery(query, project, path);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (name === undefined && wiql === undefined && isPublic === undefined) {
            return { content: [{ type: "text", text: "At least one of name, wiql, or isPublic must be provided for update." }], isError: true };
          }

          const query: QueryHierarchyItem = { ...(name !== undefined ? { name } : {}), ...(wiql !== undefined ? { wiql } : {}), ...(isPublic !== undefined ? { isPublic } : {}) };
          const updated = await workItemTrackingApi.updateQuery(query, project, path);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          await workItemTrackingApi.deleteQuery(project, path);
          return { content: [{ type: "text", text: `Query '${path}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with query write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_attachment_write ------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_attachment_write,
    "Upload a file as a work item attachment, optionally linking it directly to a work item.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      fileName: z.string().describe("The name of the file, including extension."),
      content: z.string().describe("The file content, base64-encoded."),
      workItemId: z.coerce.number().int().optional().describe("If provided, links the uploaded attachment to this work item."),
      comment: z.string().optional().describe("Comment to attach to the link. Used only when workItemId is provided."),
    },
    async ({ project, fileName, content, workItemId, comment }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        const buffer = Buffer.from(content, "base64");
        const attachment = await workItemTrackingApi.createAttachment(null, Readable.from(buffer), fileName, undefined, project);

        if (!workItemId) {
          return { content: [{ type: "text", text: JSON.stringify(attachment, null, 2) }] };
        }

        const patchDocument = [
          {
            op: "add",
            path: "/relations/-",
            value: { rel: "AttachedFile", url: attachment.url, attributes: comment ? { comment } : undefined },
          },
        ];

        const workItem = await workItemTrackingApi.updateWorkItem(null, patchDocument, workItemId, project);
        return { content: [{ type: "text", text: JSON.stringify({ attachment, workItem }, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error uploading attachment: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_recycle_bin -------------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_recycle_bin,
    "List work items in a project's recycle bin.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. If omitted, lists deleted work items across the organization."),
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        const deletedWorkItems = await workItemTrackingApi.getDeletedWorkItemShallowReferences(project);
        return { content: [{ type: "text", text: JSON.stringify(deletedWorkItems, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing the recycle bin: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_recycle_bin_write --------------------------------------------------
  server.tool(
    WORK_ITEMS_ADMIN_TOOLS.wit_recycle_bin_write,
    "Restore or permanently destroy a deleted work item. Use the action parameter to specify the operation.",
    {
      action: z.enum(["restore", "destroy"]).describe("The action to perform. Options: restore (undelete), destroy (permanently delete)."),
      id: z.coerce.number().int().describe("The ID of the deleted work item."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project."),
    },
    async ({ action, id, project }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        if (action === "restore") {
          const workItem = await workItemTrackingApi.restoreWorkItem({ isDeleted: false }, id, project);
          return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
        }

        if (action === "destroy") {
          await workItemTrackingApi.destroyWorkItem(id, project);
          return { content: [{ type: "text", text: `Work item ${id} permanently destroyed.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with recycle bin write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { WORK_ITEMS_ADMIN_TOOLS, configureWorkItemsAdminTools };
