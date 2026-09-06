// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const SERVICE_ENDPOINT_TOOLS = {
  service_endpoint: "service_endpoint",
  service_endpoint_write: "service_endpoint_write",
};

const serviceEndpointApiVersion = "7.1-preview.4";

async function serviceEndpointFetch(orgUrl: string, path: string, accessToken: string, userAgent: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
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

function parseEndpointJson(endpointJson: string): { endpoint?: Record<string, unknown>; error?: string } {
  try {
    return { endpoint: JSON.parse(endpointJson) as Record<string, unknown> };
  } catch (error) {
    return { error: `endpointJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureServiceEndpointTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- service_endpoint ----------------------------------------------------------
  server.tool(
    SERVICE_ENDPOINT_TOOLS.service_endpoint,
    "Retrieve service connection (service endpoint) data for a project. Use the action parameter to specify the operation. " +
      "Uses the Service Endpoint REST API directly, as no SDK client is available for it.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      endpointId: z.string().optional().describe("The service endpoint ID (GUID). Required for get."),
      type: z.string().optional().describe("Filter by endpoint type (e.g. 'github', 'azurerm', 'generic'). Used for list."),
    },
    async ({ action, project, endpointId, type }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "list") {
          const query = type ? `&type=${encodeURIComponent(type)}` : "";
          const response = await serviceEndpointFetch(
            connection.serverUrl,
            `/${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints?api-version=${serviceEndpointApiVersion}${query}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error listing service endpoints: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "get") {
          if (!endpointId) return { content: [{ type: "text", text: "endpointId is required for get" }], isError: true };

          const response = await serviceEndpointFetch(
            connection.serverUrl,
            `/${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints/${encodeURIComponent(endpointId)}?api-version=${serviceEndpointApiVersion}`,
            accessToken,
            userAgent
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error getting service endpoint: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with service endpoint operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- service_endpoint_write --------------------------------------------------------
  server.tool(
    SERVICE_ENDPOINT_TOOLS.service_endpoint_write,
    "Create, update, or delete a service connection. endpointJson is the full service endpoint object (name, type, url, " +
      "authorization scheme/parameters, serviceEndpointProjectReferences) as documented in the Azure DevOps REST API — " +
      "the exact shape varies by connection type (generic, github, azurerm, etc). Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      projectId: z.string().optional().describe("The project GUID. Required for delete (falls back to a lookup of 'project' if omitted)."),
      endpointId: z.string().optional().describe("The service endpoint ID (GUID). Required for update and delete."),
      endpointJson: z.string().optional().describe("The service endpoint as a JSON-encoded object. Required for create and update."),
    },
    async ({ action, project, projectId, endpointId, endpointJson }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "create") {
          if (!endpointJson) return { content: [{ type: "text", text: "endpointJson is required for create" }], isError: true };

          const { endpoint, error } = parseEndpointJson(endpointJson);
          if (error || !endpoint) return { content: [{ type: "text", text: error ?? "Invalid endpointJson" }], isError: true };

          const response = await serviceEndpointFetch(
            connection.serverUrl,
            `/${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints?api-version=${serviceEndpointApiVersion}`,
            accessToken,
            userAgent,
            { method: "POST", body: JSON.stringify(endpoint) }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error creating service endpoint: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "update") {
          if (!endpointId) return { content: [{ type: "text", text: "endpointId is required for update" }], isError: true };
          if (!endpointJson) return { content: [{ type: "text", text: "endpointJson is required for update" }], isError: true };

          const { endpoint, error } = parseEndpointJson(endpointJson);
          if (error || !endpoint) return { content: [{ type: "text", text: error ?? "Invalid endpointJson" }], isError: true };

          const response = await serviceEndpointFetch(
            connection.serverUrl,
            `/${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints/${encodeURIComponent(endpointId)}?api-version=${serviceEndpointApiVersion}`,
            accessToken,
            userAgent,
            { method: "PUT", body: JSON.stringify(endpoint) }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error updating service endpoint: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text }] };
        }

        if (action === "delete") {
          if (!endpointId) return { content: [{ type: "text", text: "endpointId is required for delete" }], isError: true };

          const resolvedProjectId = projectId ?? project;
          const response = await serviceEndpointFetch(
            connection.serverUrl,
            `/_apis/serviceendpoint/endpoints/${encodeURIComponent(endpointId)}?projectIds=${encodeURIComponent(resolvedProjectId)}&api-version=${serviceEndpointApiVersion}`,
            accessToken,
            userAgent,
            { method: "DELETE" }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error deleting service endpoint: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `Service endpoint '${endpointId}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with service endpoint write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { SERVICE_ENDPOINT_TOOLS, configureServiceEndpointTools };
