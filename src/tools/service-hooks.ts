// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const SERVICE_HOOK_TOOLS = {
  service_hook: "service_hook",
  service_hook_write: "service_hook_write",
};

const serviceHooksApiVersion = "7.1-preview.1";

async function serviceHooksFetch(orgUrl: string, path: string, accessToken: string, userAgent: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(`${orgUrl}${path}`, {
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

function parseSubscriptionJson(subscriptionJson: string): { subscription?: Record<string, unknown>; error?: string } {
  try {
    return { subscription: JSON.parse(subscriptionJson) as Record<string, unknown> };
  } catch (error) {
    return { error: `subscriptionJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureServiceHookTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- service_hook ------------------------------------------------------------
  server.tool(
    SERVICE_HOOK_TOOLS.service_hook,
    "Retrieve service hook (webhook) publisher and subscription data. Use the action parameter to specify the operation. " +
      "Uses the Service Hooks REST API directly, as no SDK client is available for it.",
    {
      action: z
        .enum(["list_publishers", "list_event_types", "list_subscriptions", "get_subscription"])
        .describe(
          "The action to perform. Options: list_publishers (list available event publishers, e.g. 'tfs', 'build'), " +
            "list_event_types (list event types for a publisher), list_subscriptions (list webhook subscriptions), get_subscription (get one by ID)."
        ),
      publisherId: z.string().optional().describe("The publisher ID (e.g. 'tfs', 'build', 'rm'). Required for list_event_types. Filters list_subscriptions when provided."),
      subscriptionId: z.string().optional().describe("The subscription ID (GUID). Required for get_subscription."),
    },
    async ({ action, publisherId, subscriptionId }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "list_publishers") {
          const response = await serviceHooksFetch(connection.serverUrl, `/_apis/hooks/publishers?api-version=${serviceHooksApiVersion}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error listing publishers: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "list_event_types") {
          if (!publisherId) return { content: [{ type: "text", text: "publisherId is required for list_event_types" }], isError: true };

          const response = await serviceHooksFetch(
            connection.serverUrl,
            `/_apis/hooks/publishers/${encodeURIComponent(publisherId)}/eventTypes?api-version=${serviceHooksApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error listing event types: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "list_subscriptions") {
          const query = publisherId ? `&publisherId=${encodeURIComponent(publisherId)}` : "";
          const response = await serviceHooksFetch(connection.serverUrl, `/_apis/hooks/subscriptions?api-version=${serviceHooksApiVersion}${query}`, accessToken, userAgent);
          if (!response.ok) return { content: [{ type: "text", text: `Error listing subscriptions: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "get_subscription") {
          if (!subscriptionId) return { content: [{ type: "text", text: "subscriptionId is required for get_subscription" }], isError: true };

          const response = await serviceHooksFetch(
            connection.serverUrl,
            `/_apis/hooks/subscriptions/${encodeURIComponent(subscriptionId)}?api-version=${serviceHooksApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error getting subscription: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with service hook operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- service_hook_write -----------------------------------------------------------
  server.tool(
    SERVICE_HOOK_TOOLS.service_hook_write,
    "Create, update, or delete a service hook subscription. subscriptionJson is the full subscription object " +
      "(publisherId, eventType, resourceVersion, consumerId, consumerActionId, publisherInputs, consumerInputs) as " +
      "documented in the Azure DevOps REST API — the exact inputs vary by publisher/consumer. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      subscriptionId: z.string().optional().describe("The subscription ID (GUID). Required for update and delete."),
      subscriptionJson: z.string().optional().describe("The subscription as a JSON-encoded object. Required for create and update."),
    },
    async ({ action, subscriptionId, subscriptionJson }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "create") {
          if (!subscriptionJson) return { content: [{ type: "text", text: "subscriptionJson is required for create" }], isError: true };

          const { subscription, error } = parseSubscriptionJson(subscriptionJson);
          if (error || !subscription) return { content: [{ type: "text", text: error ?? "Invalid subscriptionJson" }], isError: true };

          const response = await serviceHooksFetch(connection.serverUrl, `/_apis/hooks/subscriptions?api-version=${serviceHooksApiVersion}`, accessToken, userAgent, {
            method: "POST",
            body: JSON.stringify(subscription),
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error creating subscription: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "update") {
          if (!subscriptionId) return { content: [{ type: "text", text: "subscriptionId is required for update" }], isError: true };
          if (!subscriptionJson) return { content: [{ type: "text", text: "subscriptionJson is required for update" }], isError: true };

          const { subscription, error } = parseSubscriptionJson(subscriptionJson);
          if (error || !subscription) return { content: [{ type: "text", text: error ?? "Invalid subscriptionJson" }], isError: true };

          const response = await serviceHooksFetch(
            connection.serverUrl,
            `/_apis/hooks/subscriptions/${encodeURIComponent(subscriptionId)}?api-version=${serviceHooksApiVersion}`,
            accessToken,
            userAgent,
            { method: "PUT", body: JSON.stringify(subscription) }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error updating subscription: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "delete") {
          if (!subscriptionId) return { content: [{ type: "text", text: "subscriptionId is required for delete" }], isError: true };

          const response = await serviceHooksFetch(
            connection.serverUrl,
            `/_apis/hooks/subscriptions/${encodeURIComponent(subscriptionId)}?api-version=${serviceHooksApiVersion}`,
            accessToken,
            userAgent,
            { method: "DELETE" }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error deleting subscription: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `Subscription '${subscriptionId}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with service hook write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { SERVICE_HOOK_TOOLS, configureServiceHookTools };
