// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const SECURITY_TOOLS = {
  security_namespace: "security_namespace",
  security_acl: "security_acl",
  security_acl_write: "security_acl_write",
  security_permission: "security_permission",
};

const securityApiVersion = "7.1-preview.1";

async function securityFetch(orgUrl: string, path: string, accessToken: string, userAgent: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
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

function parseAclJson(aclJson: string): { acl?: Record<string, unknown>; error?: string } {
  try {
    return { acl: JSON.parse(aclJson) as Record<string, unknown> };
  } catch (error) {
    return { error: `aclJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureSecurityTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- security_namespace -------------------------------------------------------
  server.tool(
    SECURITY_TOOLS.security_namespace,
    "Retrieve security namespace definitions. Each namespace defines the permission bits (e.g. 'Read' = 2, 'Contribute' = 4) " +
      "used by security_acl_write and security_permission for a given resource type (Git repositories, work item areas, etc). " +
      "Use the action parameter to specify the operation. Uses the Security REST API directly, as no SDK client is available for it.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list (all namespaces), get (by ID)."),
      securityNamespaceId: z.string().optional().describe("The security namespace ID (GUID). Required for get."),
    },
    async ({ action, securityNamespaceId }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        const path = action === "get" && securityNamespaceId ? `/_apis/securitynamespaces/${encodeURIComponent(securityNamespaceId)}` : "/_apis/securitynamespaces";

        if (action === "get" && !securityNamespaceId) {
          return { content: [{ type: "text", text: "securityNamespaceId is required for get" }], isError: true };
        }

        const response = await securityFetch(connection.serverUrl, `${path}?api-version=${securityApiVersion}`, accessToken, userAgent);
        if (!response.ok) return { content: [{ type: "text", text: `Error retrieving security namespaces: ${response.status} ${response.text}` }], isError: true };
        return { content: [{ type: "text", text: response.text }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with security namespace operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- security_acl --------------------------------------------------------------
  server.tool(
    SECURITY_TOOLS.security_acl,
    "Get the access control list (ACEs) for a security token within a namespace.",
    {
      securityNamespaceId: z.string().describe("The security namespace ID (GUID). See security_namespace (list) to discover IDs."),
      token: z.string().describe("The security token identifying the resource (e.g. a repository or area path token). Format is namespace-specific."),
      descriptors: z.array(z.string()).optional().describe("Filter to specific identity descriptors. Omit to return all ACEs for the token."),
      includeExtendedInfo: z.boolean().optional().default(false).describe("Whether to include extended permission info (effective/inherited permissions). Defaults to false."),
    },
    async ({ securityNamespaceId, token, descriptors, includeExtendedInfo }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        const descriptorsQuery = descriptors?.length ? `&descriptors=${encodeURIComponent(descriptors.join(","))}` : "";
        const response = await securityFetch(
          connection.serverUrl,
          `/_apis/accesscontrollists/${encodeURIComponent(securityNamespaceId)}?token=${encodeURIComponent(token)}&includeExtendedInfo=${includeExtendedInfo}${descriptorsQuery}&api-version=${securityApiVersion}`,
          accessToken,
          userAgent
        );
        if (!response.ok) return { content: [{ type: "text", text: `Error getting access control list: ${response.status} ${response.text}` }], isError: true };
        return { content: [{ type: "text", text: response.text }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error getting access control list: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- security_acl_write ------------------------------------------------------------
  server.tool(
    SECURITY_TOOLS.security_acl_write,
    "Set or remove access control entries (ACEs) for a security token within a namespace. Use the action parameter to specify the operation.",
    {
      action: z.enum(["set", "remove"]).describe("The action to perform. Options: set (add/update ACEs), remove (remove ACEs, or the whole ACL for a token if descriptors is omitted)."),
      securityNamespaceId: z.string().describe("The security namespace ID (GUID). See security_namespace (list) to discover IDs."),
      token: z.string().optional().describe("The security token identifying the resource. Required for remove."),
      descriptors: z.array(z.string()).optional().describe("Identity descriptors to remove. Used for remove; omit to remove the entire ACL for the token."),
      aclJson: z
        .string()
        .optional()
        .describe(
          'The access control list as a JSON-encoded object: { "value": [{ "token": "...", "merge": true, "accessControlEntries": [{ "descriptor": "...", "allow": <bitmask>, "deny": <bitmask> }] }] }. Required for set.'
        ),
    },
    async ({ action, securityNamespaceId, token, descriptors, aclJson }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        if (action === "set") {
          if (!aclJson) return { content: [{ type: "text", text: "aclJson is required for set" }], isError: true };

          const { acl, error } = parseAclJson(aclJson);
          if (error || !acl) return { content: [{ type: "text", text: error ?? "Invalid aclJson" }], isError: true };

          const response = await securityFetch(connection.serverUrl, `/_apis/accesscontrollists/${encodeURIComponent(securityNamespaceId)}?api-version=${securityApiVersion}`, accessToken, userAgent, {
            method: "POST",
            body: JSON.stringify(acl),
          });
          if (!response.ok) return { content: [{ type: "text", text: `Error setting access control entries: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: response.text || "Access control entries updated." }] };
        }

        if (action === "remove") {
          if (!token) return { content: [{ type: "text", text: "token is required for remove" }], isError: true };

          const descriptorsQuery = descriptors?.length ? `&descriptors=${encodeURIComponent(descriptors.join(","))}` : "";
          const response = await securityFetch(
            connection.serverUrl,
            `/_apis/accesscontrollists/${encodeURIComponent(securityNamespaceId)}?tokens=${encodeURIComponent(token)}${descriptorsQuery}&api-version=${securityApiVersion}`,
            accessToken,
            userAgent,
            { method: "DELETE" }
          );
          if (!response.ok) return { content: [{ type: "text", text: `Error removing access control entries: ${response.status} ${response.text}` }], isError: true };
          return { content: [{ type: "text", text: `Access control entries removed for token '${token}'.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with access control write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- security_permission -----------------------------------------------------------
  server.tool(
    SECURITY_TOOLS.security_permission,
    "Check whether the authenticated user has specific permissions on a token within a namespace. Returns one boolean per requested token.",
    {
      securityNamespaceId: z.string().describe("The security namespace ID (GUID). See security_namespace (list) to discover IDs and their permission bit values."),
      permissions: z.coerce.number().int().describe("The permission bitmask to check, combining one or more of the namespace's action bits (e.g. Read | Contribute)."),
      tokens: z.array(z.string()).min(1).describe("The security tokens to check, e.g. one per repository or area path."),
    },
    async ({ securityNamespaceId, permissions, tokens }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();
        const userAgent = userAgentProvider();

        const response = await securityFetch(
          connection.serverUrl,
          `/_apis/permissions/${encodeURIComponent(securityNamespaceId)}/${permissions}?tokens=${encodeURIComponent(tokens.join(","))}&api-version=${securityApiVersion}`,
          accessToken,
          userAgent
        );
        if (!response.ok) return { content: [{ type: "text", text: `Error checking permissions: ${response.status} ${response.text}` }], isError: true };
        return { content: [{ type: "text", text: response.text }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error checking permissions: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { SECURITY_TOOLS, configureSecurityTools };
