// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { PolicyConfiguration } from "azure-devops-node-api/interfaces/PolicyInterfaces.js";
import { z } from "zod";

const POLICY_TOOLS = {
  policy: "policy",
  policy_write: "policy_write",
};

function parseSettings(settingsJson: string): { settings?: Record<string, unknown>; error?: string } {
  try {
    const parsed: unknown = JSON.parse(settingsJson);
    if (typeof parsed !== "object" || parsed === null) return { error: "settingsJson must be a JSON object" };
    return { settings: parsed as Record<string, unknown> };
  } catch (error) {
    return { error: `settingsJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configurePolicyTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- policy ------------------------------------------------------------------
  server.tool(
    POLICY_TOOLS.policy,
    "Retrieve branch/repository policy data for a project. Use the action parameter to specify the operation. " +
      "Policy settings are policy-type-specific JSON; use list_types to discover available policy type IDs, then " +
      "consult the Azure DevOps REST API documentation for the settings shape of a given type.",
    {
      action: z
        .enum(["list_types", "list", "get"])
        .describe("The action to perform. Options: list_types (list available policy types), list (list policy configurations), get (get a single policy configuration by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      configurationId: z.coerce.number().int().optional().describe("The policy configuration ID. Required for get."),
      scope: z.string().optional().describe("Filter by scope (repository ID, or 'proj' for project-wide). Used for list."),
      policyTypeId: z.string().optional().describe("Filter by policy type ID (see list_types). Used for list."),
    },
    async ({ action, project, configurationId, scope, policyTypeId }) => {
      try {
        const connection = await connectionProvider();
        const policyApi = await connection.getPolicyApi();

        if (action === "list_types") {
          const types = await policyApi.getPolicyTypes(project);
          return { content: [{ type: "text", text: JSON.stringify(types, null, 2) }] };
        }

        if (action === "list") {
          const configurations = await policyApi.getPolicyConfigurations(project, scope, policyTypeId);
          return { content: [{ type: "text", text: JSON.stringify(configurations, null, 2) }] };
        }

        if (action === "get") {
          if (configurationId === undefined) return { content: [{ type: "text", text: "configurationId is required for get" }], isError: true };

          const configuration = await policyApi.getPolicyConfiguration(project, configurationId);
          return { content: [{ type: "text", text: JSON.stringify(configuration, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with policy operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- policy_write --------------------------------------------------------------
  server.tool(
    POLICY_TOOLS.policy_write,
    "Create, update, or delete a branch/repository policy configuration. Use the action parameter to specify the operation. " +
      "The settings object always includes a 'scope' array of { repositoryId, refName, matchKind } to target a branch; " +
      "use policy (list_types) to discover the policy type ID and consult Azure DevOps documentation for the rest of the settings shape.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      configurationId: z.coerce.number().int().optional().describe("The policy configuration ID. Required for update and delete."),
      policyTypeId: z.string().optional().describe("The policy type ID (see the policy tool's list_types action). Required for create."),
      settingsJson: z.string().optional().describe("The policy settings as a JSON-encoded object. Required for create and update."),
      isEnabled: z.boolean().optional().default(true).describe("Whether the policy is enabled. Used for create and update. Defaults to true."),
      isBlocking: z.boolean().optional().default(true).describe("Whether the policy blocks completion when not satisfied. Used for create and update. Defaults to true."),
    },
    async ({ action, project, configurationId, policyTypeId, settingsJson, isEnabled, isBlocking }) => {
      try {
        const connection = await connectionProvider();
        const policyApi = await connection.getPolicyApi();

        if (action === "create") {
          if (!policyTypeId) return { content: [{ type: "text", text: "policyTypeId is required for create" }], isError: true };
          if (!settingsJson) return { content: [{ type: "text", text: "settingsJson is required for create" }], isError: true };

          const { settings, error } = parseSettings(settingsJson);
          if (error) return { content: [{ type: "text", text: error }], isError: true };

          const configuration: PolicyConfiguration = { type: { id: policyTypeId }, isEnabled, isBlocking, settings };
          const created = await policyApi.createPolicyConfiguration(configuration, project);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (configurationId === undefined) return { content: [{ type: "text", text: "configurationId is required for update" }], isError: true };

          const existing = await policyApi.getPolicyConfiguration(project, configurationId);

          let settings = existing.settings;
          if (settingsJson !== undefined) {
            const parsed = parseSettings(settingsJson);
            if (parsed.error) return { content: [{ type: "text", text: parsed.error }], isError: true };
            settings = parsed.settings;
          }

          const configuration: PolicyConfiguration = { ...existing, isEnabled, isBlocking, settings };
          const updated = await policyApi.updatePolicyConfiguration(configuration, project, configurationId);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (configurationId === undefined) return { content: [{ type: "text", text: "configurationId is required for delete" }], isError: true };

          await policyApi.deletePolicyConfiguration(project, configurationId);
          return { content: [{ type: "text", text: `Policy configuration ${configurationId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with policy write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { POLICY_TOOLS, configurePolicyTools };
