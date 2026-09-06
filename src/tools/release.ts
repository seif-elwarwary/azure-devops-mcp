// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { ReleaseDefinition, ReleaseStatus } from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";
import { z } from "zod";
import { createExternalContentResponse } from "../shared/content-safety.js";

const RELEASE_TOOLS = {
  release_definition: "release_definition",
  release_definition_write: "release_definition_write",
  release: "release",
  release_write: "release_write",
};

function parseDefinitionJson(definitionJson: string): { definition?: ReleaseDefinition; error?: string } {
  try {
    return { definition: JSON.parse(definitionJson) as ReleaseDefinition };
  } catch (error) {
    return { error: `definitionJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureReleaseTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- release_definition ------------------------------------------------------
  server.tool(
    RELEASE_TOOLS.release_definition,
    "Retrieve classic Release definition data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get", "get_history"]).describe("The action to perform. Options: list, get (by ID), get_history (revision history)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      definitionId: z.coerce.number().int().optional().describe("The release definition ID. Required for get and get_history."),
      searchText: z.string().optional().describe("Filter definitions by name. Used for list."),
      top: z.coerce.number().optional().describe("The maximum number of definitions to return. Used for list."),
    },
    async ({ action, project, definitionId, searchText, top }) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();

        if (action === "list") {
          const definitions = await releaseApi.getReleaseDefinitions(project, searchText, undefined, undefined, undefined, top);
          return { content: [{ type: "text", text: JSON.stringify(definitions, null, 2) }] };
        }

        if (action === "get") {
          if (definitionId === undefined) return { content: [{ type: "text", text: "definitionId is required for get" }], isError: true };

          const definition = await releaseApi.getReleaseDefinition(project, definitionId);
          return { content: [{ type: "text", text: JSON.stringify(definition, null, 2) }] };
        }

        if (action === "get_history") {
          if (definitionId === undefined) return { content: [{ type: "text", text: "definitionId is required for get_history" }], isError: true };

          const history = await releaseApi.getReleaseDefinitionHistory(project, definitionId);
          return { content: [{ type: "text", text: JSON.stringify(history, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with release definition operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- release_definition_write --------------------------------------------------
  server.tool(
    RELEASE_TOOLS.release_definition_write,
    "Create, update, delete, or undelete a classic Release definition. definitionJson is the full ReleaseDefinition " +
      "object (name, environments, artifacts, triggers, etc.) as documented in the Azure DevOps REST API. Use the " +
      "action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete", "undelete"]).describe("The action to perform. Options: create, update, delete, undelete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      definitionId: z.coerce.number().int().optional().describe("The release definition ID. Required for delete and undelete."),
      definitionJson: z.string().optional().describe("The release definition as a JSON-encoded object. Required for create and update."),
      comment: z.string().optional().describe("Comment for the deletion. Used for delete."),
    },
    async ({ action, project, definitionId, definitionJson, comment }) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();

        if (action === "create") {
          if (!definitionJson) return { content: [{ type: "text", text: "definitionJson is required for create" }], isError: true };

          const { definition, error } = parseDefinitionJson(definitionJson);
          if (error || !definition) return { content: [{ type: "text", text: error ?? "Invalid definitionJson" }], isError: true };

          const created = await releaseApi.createReleaseDefinition(definition, project);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (!definitionJson) return { content: [{ type: "text", text: "definitionJson is required for update" }], isError: true };

          const { definition, error } = parseDefinitionJson(definitionJson);
          if (error || !definition) return { content: [{ type: "text", text: error ?? "Invalid definitionJson" }], isError: true };

          const updated = await releaseApi.updateReleaseDefinition(definition, project);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (definitionId === undefined) return { content: [{ type: "text", text: "definitionId is required for delete" }], isError: true };

          await releaseApi.deleteReleaseDefinition(project, definitionId, comment);
          return { content: [{ type: "text", text: `Release definition ${definitionId} deleted.` }] };
        }

        if (action === "undelete") {
          if (definitionId === undefined) return { content: [{ type: "text", text: "definitionId is required for undelete" }], isError: true };

          const definition = await releaseApi.undeleteReleaseDefinition({ comment }, project, definitionId);
          return { content: [{ type: "text", text: JSON.stringify(definition, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with release definition write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- release -------------------------------------------------------------------
  server.tool(
    RELEASE_TOOLS.release,
    "Retrieve classic Release data. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      releaseId: z.coerce.number().int().optional().describe("The release ID. Required for get."),
      definitionId: z.coerce.number().int().optional().describe("Filter by release definition ID. Used for list."),
      top: z.coerce.number().optional().describe("The maximum number of releases to return. Used for list."),
    },
    async ({ action, project, releaseId, definitionId, top }) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();

        if (action === "list") {
          const releases = await releaseApi.getReleases(project, definitionId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, top);
          return { content: [{ type: "text", text: JSON.stringify(releases, null, 2) }] };
        }

        if (action === "get") {
          if (releaseId === undefined) return { content: [{ type: "text", text: "releaseId is required for get" }], isError: true };

          const release = await releaseApi.getRelease(project, releaseId);
          return createExternalContentResponse(release, "release");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with release operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- release_write ---------------------------------------------------------------
  server.tool(
    RELEASE_TOOLS.release_write,
    "Create (deploy) a new release from a definition, or abandon an existing one. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "abandon"]).describe("The action to perform. Options: create (start a new release), abandon (cancel a release)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      definitionId: z.coerce.number().int().optional().describe("The release definition ID. Required for create."),
      description: z.string().optional().describe("Description for the new release. Used for create."),
      artifactAlias: z.string().optional().describe("The alias of the artifact to pin (see the release definition's artifacts). Used for create."),
      artifactBuildId: z.string().optional().describe("The build ID/version to use for the pinned artifact. Used for create with artifactAlias."),
      releaseId: z.coerce.number().int().optional().describe("The release ID. Required for abandon."),
    },
    async ({ action, project, definitionId, description, artifactAlias, artifactBuildId, releaseId }) => {
      try {
        const connection = await connectionProvider();
        const releaseApi = await connection.getReleaseApi();

        if (action === "create") {
          if (definitionId === undefined) return { content: [{ type: "text", text: "definitionId is required for create" }], isError: true };

          const artifacts = artifactAlias && artifactBuildId ? [{ alias: artifactAlias, instanceReference: { id: artifactBuildId } }] : undefined;
          const release = await releaseApi.createRelease({ definitionId, description, artifacts }, project);
          return { content: [{ type: "text", text: JSON.stringify(release, null, 2) }] };
        }

        if (action === "abandon") {
          if (releaseId === undefined) return { content: [{ type: "text", text: "releaseId is required for abandon" }], isError: true };

          const existing = await releaseApi.getRelease(project, releaseId);
          const updated = await releaseApi.updateRelease({ ...existing, status: ReleaseStatus.Abandoned }, project, releaseId);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with release write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { RELEASE_TOOLS, configureReleaseTools };
