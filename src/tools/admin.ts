// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TeamProject, WebApiTeam } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { z } from "zod";

const ADMIN_TOOLS = {
  core_project_write: "core_project_write",
  core_team_write: "core_team_write",
};

function configureAdminTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- core_project_write --------------------------------------------------------
  server.tool(
    ADMIN_TOOLS.core_project_write,
    "Create, update, or delete an Azure DevOps project. Create and delete are asynchronous server-side operations; " +
      "this tool returns an operation reference (id/url/status) rather than waiting for completion. Use the operation " +
      "URL to poll status. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      projectId: z.string().optional().describe("The project ID or name. Required for update and delete."),
      name: z.string().optional().describe("The project name. Required for create. New name for update (rename)."),
      description: z.string().optional().describe("The project description. Used for create and update."),
      sourceControlType: z.enum(["Git", "Tfvc"]).optional().default("Git").describe("The version control type for a new project. Used for create. Defaults to 'Git'."),
      processTemplateId: z.string().optional().describe("The GUID of the process template to use (see Azure DevOps project process settings). Required for create."),
    },
    async ({ action, projectId, name, description, sourceControlType, processTemplateId }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };
          if (!processTemplateId) return { content: [{ type: "text", text: "processTemplateId is required for create" }], isError: true };

          const projectToCreate: TeamProject = {
            name,
            description,
            capabilities: {
              versioncontrol: { sourceControlType },
              processTemplate: { templateTypeId: processTemplateId },
            },
          };

          const operation = await coreApi.queueCreateProject(projectToCreate);
          return { content: [{ type: "text", text: JSON.stringify(operation, null, 2) }] };
        }

        if (action === "update") {
          if (!projectId) return { content: [{ type: "text", text: "projectId is required for update" }], isError: true };
          if (name === undefined && description === undefined) {
            return { content: [{ type: "text", text: "At least one of name or description must be provided for update." }], isError: true };
          }

          const projectUpdate: TeamProject = { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) };
          const operation = await coreApi.updateProject(projectUpdate, projectId);
          return { content: [{ type: "text", text: JSON.stringify(operation, null, 2) }] };
        }

        if (action === "delete") {
          if (!projectId) return { content: [{ type: "text", text: "projectId is required for delete" }], isError: true };

          const operation = await coreApi.queueDeleteProject(projectId);
          return { content: [{ type: "text", text: JSON.stringify(operation, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with project write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- core_team_write -----------------------------------------------------------
  server.tool(
    ADMIN_TOOLS.core_team_write,
    "Create, rename, or delete a team within a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update (rename/redescribe), delete."),
      projectId: z.string().describe("The name or ID of the Azure DevOps project."),
      teamId: z.string().optional().describe("The team ID or name. Required for update and delete."),
      name: z.string().optional().describe("The team name. Required for create. New name for update."),
      description: z.string().optional().describe("The team description. Used for create and update."),
    },
    async ({ action, projectId, teamId, name, description }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const team: WebApiTeam = { name, description };
          const created = await coreApi.createTeam(team, projectId);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (!teamId) return { content: [{ type: "text", text: "teamId is required for update" }], isError: true };
          if (name === undefined && description === undefined) {
            return { content: [{ type: "text", text: "At least one of name or description must be provided for update." }], isError: true };
          }

          const existing = await coreApi.getTeam(projectId, teamId);
          const updated = await coreApi.updateTeam({ ...existing, ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) }, projectId, teamId);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (!teamId) return { content: [{ type: "text", text: "teamId is required for delete" }], isError: true };

          await coreApi.deleteTeam(projectId, teamId);
          return { content: [{ type: "text", text: `Team '${teamId}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with team write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { ADMIN_TOOLS, configureAdminTools };
