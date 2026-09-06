// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getVsspsBaseUrl } from "../utils.js";

const GRAPH_TOOLS = {
  graph_group: "graph_group",
  graph_group_write: "graph_group_write",
  graph_membership_write: "graph_membership_write",
};

const graphApiVersion = "7.1-preview.1";

async function graphFetch(vsspsBaseUrl: string, path: string, accessToken: string, userAgent: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(`${vsspsBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": userAgent,
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

function configureGraphTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- graph_group ---------------------------------------------------------------
  server.tool(
    GRAPH_TOOLS.graph_group,
    "Retrieve Microsoft Entra / Azure DevOps group data via the Graph API. Use the action parameter to specify the operation. " +
      "Requires the Graph API, which is available on Azure DevOps Server 2019+ and the hosted service.",
    {
      action: z
        .enum(["list", "get", "list_memberships", "resolve_project_descriptor"])
        .describe(
          "The action to perform. Options: list (list groups, optionally scoped to a project), get (get a group by descriptor), " +
            "list_memberships (list a subject's group memberships), resolve_project_descriptor (resolve a project ID to its Graph descriptor, needed to scope group creation)."
        ),
      groupDescriptor: z.string().optional().describe("The group's Graph descriptor. Required for get."),
      scopeDescriptor: z.string().optional().describe("A project's Graph descriptor to scope the group list to. Used for list. Omit to list organization-wide groups."),
      subjectDescriptor: z.string().optional().describe("A user or group's Graph descriptor. Required for list_memberships."),
      direction: z
        .enum(["up", "down"])
        .optional()
        .default("up")
        .describe("Membership direction for list_memberships: 'up' (groups this subject belongs to) or 'down' (members of this group). Defaults to 'up'."),
      projectId: z.string().optional().describe("The project ID (GUID). Required for resolve_project_descriptor."),
    },
    async ({ action, groupDescriptor, scopeDescriptor, subjectDescriptor, direction, projectId }) => {
      try {
        const connection = await connectionProvider();
        const vsspsBaseUrl = getVsspsBaseUrl(connection.serverUrl);
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "list") {
          const query = scopeDescriptor ? `&scopeDescriptor=${encodeURIComponent(scopeDescriptor)}` : "";
          const response = await graphFetch(vsspsBaseUrl, `/_apis/graph/groups?api-version=${graphApiVersion}${query}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error listing groups: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "get") {
          if (!groupDescriptor) return { content: [{ type: "text", text: "groupDescriptor is required for get" }], isError: true };

          const response = await graphFetch(vsspsBaseUrl, `/_apis/graph/groups/${encodeURIComponent(groupDescriptor)}?api-version=${graphApiVersion}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error getting group: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "list_memberships") {
          if (!subjectDescriptor) return { content: [{ type: "text", text: "subjectDescriptor is required for list_memberships" }], isError: true };

          const response = await graphFetch(
            vsspsBaseUrl,
            `/_apis/graph/memberships/${encodeURIComponent(subjectDescriptor)}?direction=${direction}&api-version=${graphApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error listing memberships: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "resolve_project_descriptor") {
          if (!projectId) return { content: [{ type: "text", text: "projectId is required for resolve_project_descriptor" }], isError: true };

          const response = await graphFetch(vsspsBaseUrl, `/_apis/graph/descriptors/${encodeURIComponent(projectId)}?api-version=${graphApiVersion}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error resolving descriptor: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with graph group operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- graph_group_write -----------------------------------------------------------
  server.tool(
    GRAPH_TOOLS.graph_group_write,
    "Create or delete a Graph group. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "delete"]).describe("The action to perform. Options: create, delete."),
      scopeDescriptor: z
        .string()
        .optional()
        .describe("A project's Graph descriptor to scope the new group to (see graph_group's resolve_project_descriptor action). Used for create. Omit to create an organization-wide group."),
      displayName: z.string().optional().describe("The group's display name. Required for create."),
      description: z.string().optional().describe("The group's description. Used for create."),
      groupDescriptor: z.string().optional().describe("The group's Graph descriptor. Required for delete."),
    },
    async ({ action, scopeDescriptor, displayName, description, groupDescriptor }) => {
      try {
        const connection = await connectionProvider();
        const vsspsBaseUrl = getVsspsBaseUrl(connection.serverUrl);
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "create") {
          if (!displayName) return { content: [{ type: "text", text: "displayName is required for create" }], isError: true };

          const query = scopeDescriptor ? `&scopeDescriptor=${encodeURIComponent(scopeDescriptor)}` : "";
          const response = await graphFetch(vsspsBaseUrl, `/_apis/graph/groups?api-version=${graphApiVersion}${query}`, accessToken, userAgent, {
            method: "POST",
            body: JSON.stringify({ displayName, description }),
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error creating group: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "delete") {
          if (!groupDescriptor) return { content: [{ type: "text", text: "groupDescriptor is required for delete" }], isError: true };

          const response = await graphFetch(vsspsBaseUrl, `/_apis/graph/groups/${encodeURIComponent(groupDescriptor)}?api-version=${graphApiVersion}`, accessToken, userAgent, {
            method: "DELETE",
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error deleting group: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `Group '${groupDescriptor}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with graph group write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- graph_membership_write --------------------------------------------------------
  server.tool(
    GRAPH_TOOLS.graph_membership_write,
    "Add or remove a user/group as a member of a group. Use the action parameter to specify the operation.",
    {
      action: z.enum(["add", "remove"]).describe("The action to perform. Options: add, remove."),
      subjectDescriptor: z.string().describe("The Graph descriptor of the user or group to add/remove."),
      containerDescriptor: z.string().describe("The Graph descriptor of the group to add/remove the subject from."),
    },
    async ({ action, subjectDescriptor, containerDescriptor }) => {
      try {
        const connection = await connectionProvider();
        const vsspsBaseUrl = getVsspsBaseUrl(connection.serverUrl);
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();
        const path = `/_apis/graph/memberships/${encodeURIComponent(subjectDescriptor)}/${encodeURIComponent(containerDescriptor)}?api-version=${graphApiVersion}`;

        if (action === "add") {
          const response = await graphFetch(vsspsBaseUrl, path, accessToken, userAgent, { method: "PUT" });
          if (!response.ok) return { content: [{ type: "text", text: `Error adding membership: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text || `'${subjectDescriptor}' added to '${containerDescriptor}'.` }] };
        }

        if (action === "remove") {
          const response = await graphFetch(vsspsBaseUrl, path, accessToken, userAgent, { method: "DELETE" });
          if (!response.ok) return { content: [{ type: "text", text: `Error removing membership: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `'${subjectDescriptor}' removed from '${containerDescriptor}'.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with membership write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { GRAPH_TOOLS, configureGraphTools };
