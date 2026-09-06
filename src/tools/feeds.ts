// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { getFeedsBaseUrl } from "../utils.js";

const FEED_TOOLS = {
  feed: "feed",
  feed_write: "feed_write",
};

const feedsApiVersion = "7.1-preview.1";

async function feedsFetch(
  feedsBaseUrl: string,
  project: string | undefined,
  path: string,
  accessToken: string,
  userAgent: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; text: string }> {
  const projectSegment = project ? `/${encodeURIComponent(project)}` : "";
  const response = await fetch(`${feedsBaseUrl}${projectSegment}${path}`, {
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

function parseFeedJson(feedJson: string): { feed?: Record<string, unknown>; error?: string } {
  try {
    return { feed: JSON.parse(feedJson) as Record<string, unknown> };
  } catch (error) {
    return { error: `feedJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureFeedTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- feed ----------------------------------------------------------------------
  server.tool(
    FEED_TOOLS.feed,
    "Retrieve Azure Artifacts feed and package data. Use the action parameter to specify the operation. " + "Uses the Packaging REST API directly, as no SDK client is available for it.",
    {
      action: z.enum(["list", "get", "list_packages", "get_package"]).describe("The action to perform. Options: list, get (by ID/name), list_packages, get_package."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Omit for organization-scoped feeds."),
      feedId: z.string().optional().describe("The feed ID or name. Required for get, list_packages, and get_package."),
      packageId: z.string().optional().describe("The package ID. Required for get_package."),
      includeAllVersions: z.boolean().optional().default(false).describe("Whether to include all package versions. Used for list_packages and get_package. Defaults to false (latest only)."),
    },
    async ({ action, project, feedId, packageId, includeAllVersions }) => {
      try {
        const connection = await connectionProvider();
        const feedsBaseUrl = getFeedsBaseUrl(connection.serverUrl);
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "list") {
          const response = await feedsFetch(feedsBaseUrl, project, `/_apis/packaging/feeds?api-version=${feedsApiVersion}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error listing feeds: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "get") {
          if (!feedId) return { content: [{ type: "text", text: "feedId is required for get" }], isError: true };

          const response = await feedsFetch(feedsBaseUrl, project, `/_apis/packaging/feeds/${encodeURIComponent(feedId)}?api-version=${feedsApiVersion}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error getting feed: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "list_packages") {
          if (!feedId) return { content: [{ type: "text", text: "feedId is required for list_packages" }], isError: true };

          const response = await feedsFetch(
            feedsBaseUrl,
            project,
            `/_apis/packaging/feeds/${encodeURIComponent(feedId)}/packages?includeAllVersions=${includeAllVersions}&api-version=${feedsApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error listing packages: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "get_package") {
          if (!feedId) return { content: [{ type: "text", text: "feedId is required for get_package" }], isError: true };
          if (!packageId) return { content: [{ type: "text", text: "packageId is required for get_package" }], isError: true };

          const response = await feedsFetch(
            feedsBaseUrl,
            project,
            `/_apis/packaging/feeds/${encodeURIComponent(feedId)}/packages/${encodeURIComponent(packageId)}?includeAllVersions=${includeAllVersions}&api-version=${feedsApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error getting package: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with feed operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- feed_write ------------------------------------------------------------------
  server.tool(
    FEED_TOOLS.feed_write,
    "Create, update, or delete an Azure Artifacts feed. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Omit for an organization-scoped feed."),
      feedId: z.string().optional().describe("The feed ID or name. Required for update and delete."),
      name: z.string().optional().describe("The feed name. Required for create."),
      description: z.string().optional().describe("The feed description. Used for create and update."),
      feedJson: z
        .string()
        .optional()
        .describe('Additional feed settings as a JSON-encoded object (merged with name/description), e.g. { "hideDeletedPackageVersions": true }. Used for create and update.'),
    },
    async ({ action, project, feedId, name, description, feedJson }) => {
      try {
        const connection = await connectionProvider();
        const feedsBaseUrl = getFeedsBaseUrl(connection.serverUrl);
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const { feed, error } = feedJson ? parseFeedJson(feedJson) : { feed: {} };
          if (error) return { content: [{ type: "text", text: error }], isError: true };

          const response = await feedsFetch(feedsBaseUrl, project, `/_apis/packaging/feeds?api-version=${feedsApiVersion}`, accessToken, userAgent, {
            method: "POST",
            body: JSON.stringify({ ...feed, name, description }),
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error creating feed: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "update") {
          if (!feedId) return { content: [{ type: "text", text: "feedId is required for update" }], isError: true };

          const { feed, error } = feedJson ? parseFeedJson(feedJson) : { feed: {} };
          if (error) return { content: [{ type: "text", text: error }], isError: true };

          const response = await feedsFetch(feedsBaseUrl, project, `/_apis/packaging/feeds/${encodeURIComponent(feedId)}?api-version=${feedsApiVersion}`, accessToken, userAgent, {
            method: "PATCH",
            body: JSON.stringify({ ...feed, ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) }),
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error updating feed: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "delete") {
          if (!feedId) return { content: [{ type: "text", text: "feedId is required for delete" }], isError: true };

          const response = await feedsFetch(feedsBaseUrl, project, `/_apis/packaging/feeds/${encodeURIComponent(feedId)}?api-version=${feedsApiVersion}`, accessToken, userAgent, {
            method: "DELETE",
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error deleting feed: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `Feed '${feedId}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with feed write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { FEED_TOOLS, configureFeedTools };
