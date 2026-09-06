// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const PROCESS_TOOLS = {
  process: "process",
  process_work_item_type_write: "process_work_item_type_write",
  process_field_write: "process_field_write",
  process_state_write: "process_state_write",
};

function configureProcessTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- process -----------------------------------------------------------------
  server.tool(
    PROCESS_TOOLS.process,
    "Retrieve process template and work item type customization data. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list_processes", "get_process", "list_work_item_types", "get_work_item_type", "list_states"])
        .describe(
          "The action to perform. Options: list_processes (list process templates in the organization), get_process (get one by ID), " +
            "list_work_item_types (list work item types in a process), get_work_item_type (get one by reference name), " +
            "list_states (list workflow states for a work item type)."
        ),
      processId: z.string().optional().describe("The process template ID. Required for get_process, list_work_item_types, get_work_item_type, and list_states."),
      witRefName: z.string().optional().describe("The work item type reference name (e.g. 'Microsoft.VSTS.WorkItemTypes.Bug'). Required for get_work_item_type and list_states."),
    },
    async ({ action, processId, witRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();

        if (action === "list_processes") {
          const processes = await processApi.getListOfProcesses();
          return { content: [{ type: "text", text: JSON.stringify(processes, null, 2) }] };
        }

        if (action === "get_process") {
          if (!processId) return { content: [{ type: "text", text: "processId is required for get_process" }], isError: true };

          const process = await processApi.getProcessByItsId(processId);
          return { content: [{ type: "text", text: JSON.stringify(process, null, 2) }] };
        }

        if (action === "list_work_item_types") {
          if (!processId) return { content: [{ type: "text", text: "processId is required for list_work_item_types" }], isError: true };

          const workItemTypes = await processApi.getProcessWorkItemTypes(processId);
          return { content: [{ type: "text", text: JSON.stringify(workItemTypes, null, 2) }] };
        }

        if (action === "get_work_item_type") {
          if (!processId) return { content: [{ type: "text", text: "processId is required for get_work_item_type" }], isError: true };
          if (!witRefName) return { content: [{ type: "text", text: "witRefName is required for get_work_item_type" }], isError: true };

          const workItemType = await processApi.getProcessWorkItemType(processId, witRefName);
          return { content: [{ type: "text", text: JSON.stringify(workItemType, null, 2) }] };
        }

        if (action === "list_states") {
          if (!processId) return { content: [{ type: "text", text: "processId is required for list_states" }], isError: true };
          if (!witRefName) return { content: [{ type: "text", text: "witRefName is required for list_states" }], isError: true };

          const states = await processApi.getStateDefinitions(processId, witRefName);
          return { content: [{ type: "text", text: JSON.stringify(states, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with process operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- process_work_item_type_write -----------------------------------------------
  server.tool(
    PROCESS_TOOLS.process_work_item_type_write,
    "Create, update, or delete a work item type in a process template. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      processId: z.string().describe("The process template ID."),
      witRefName: z.string().optional().describe("The work item type reference name. Required for update and delete."),
      name: z.string().optional().describe("The work item type name. Required for create."),
      description: z.string().optional().describe("The work item type description. Used for create and update."),
      color: z.string().optional().describe("Hex color code (without '#'), e.g. 'FF0000'. Used for create and update."),
      icon: z.string().optional().describe("The icon identifier, e.g. 'icon_book'. Used for create and update."),
      inheritsFrom: z.string().optional().describe("Reference name of the parent work item type to inherit from. Used for create."),
      isDisabled: z.boolean().optional().describe("Whether the work item type should be disabled. Used for update."),
    },
    async ({ action, processId, witRefName, name, description, color, icon, inheritsFrom, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const workItemType = await processApi.createProcessWorkItemType({ name, description, color, icon, inheritsFrom }, processId);
          return { content: [{ type: "text", text: JSON.stringify(workItemType, null, 2) }] };
        }

        if (action === "update") {
          if (!witRefName) return { content: [{ type: "text", text: "witRefName is required for update" }], isError: true };

          const workItemType = await processApi.updateProcessWorkItemType({ description, color, icon, isDisabled }, processId, witRefName);
          return { content: [{ type: "text", text: JSON.stringify(workItemType, null, 2) }] };
        }

        if (action === "delete") {
          if (!witRefName) return { content: [{ type: "text", text: "witRefName is required for delete" }], isError: true };

          await processApi.deleteProcessWorkItemType(processId, witRefName);
          return { content: [{ type: "text", text: `Work item type '${witRefName}' deleted from process ${processId}.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with work item type write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- process_field_write ------------------------------------------------------
  server.tool(
    PROCESS_TOOLS.process_field_write,
    "Add or update a field on a work item type within a process template. Use the action parameter to specify the operation.",
    {
      action: z.enum(["add", "update"]).describe("The action to perform. Options: add, update."),
      processId: z.string().describe("The process template ID."),
      witRefName: z.string().describe("The work item type reference name."),
      referenceName: z.string().describe("The field's reference name (e.g. 'Custom.MyField' for a new field, or an existing field's reference name to add it to this type)."),
      allowedValues: z.array(z.string()).optional().describe("Allowed values for the field. Used for add and update."),
      defaultValue: z.string().optional().describe("The default value of the field. Used for add and update."),
      readOnly: z.boolean().optional().describe("Whether the field is read-only. Used for add and update."),
      required: z.boolean().optional().describe("Whether the field is required. Used for add and update."),
    },
    async ({ action, processId, witRefName, referenceName, allowedValues, defaultValue, readOnly, required }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();

        if (action === "add") {
          const field = await processApi.addFieldToWorkItemType({ referenceName, allowedValues, defaultValue, readOnly, required }, processId, witRefName);
          return { content: [{ type: "text", text: JSON.stringify(field, null, 2) }] };
        }

        if (action === "update") {
          const field = await processApi.updateWorkItemTypeField({ allowedValues, defaultValue, readOnly, required }, processId, witRefName, referenceName);
          return { content: [{ type: "text", text: JSON.stringify(field, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with field write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- process_state_write -------------------------------------------------------
  server.tool(
    PROCESS_TOOLS.process_state_write,
    "Create, update, or delete a workflow state for a work item type. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      processId: z.string().describe("The process template ID."),
      witRefName: z.string().describe("The work item type reference name."),
      stateId: z.string().optional().describe("The state ID. Required for update and delete."),
      name: z.string().optional().describe("The state name. Required for create; new name for update."),
      color: z.string().optional().describe("Hex color code (without '#'). Used for create and update."),
      stateCategory: z.enum(["Proposed", "InProgress", "Resolved", "Completed", "Removed"]).optional().describe("The state category. Used for create and update."),
      order: z.coerce.number().int().optional().describe("Order in which the state should appear. Used for create and update."),
    },
    async ({ action, processId, witRefName, stateId, name, color, stateCategory, order }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const state = await processApi.createStateDefinition({ name, color, stateCategory, order }, processId, witRefName);
          return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
        }

        if (action === "update") {
          if (!stateId) return { content: [{ type: "text", text: "stateId is required for update" }], isError: true };

          const state = await processApi.updateStateDefinition({ name, color, stateCategory, order }, processId, witRefName, stateId);
          return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
        }

        if (action === "delete") {
          if (!stateId) return { content: [{ type: "text", text: "stateId is required for delete" }], isError: true };

          await processApi.deleteStateDefinition(processId, witRefName, stateId);
          return { content: [{ type: "text", text: `State ${stateId} deleted from work item type '${witRefName}'.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with state write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { PROCESS_TOOLS, configureProcessTools };
