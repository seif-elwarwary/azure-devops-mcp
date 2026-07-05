#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { getAlmSearchBaseUrl } from "./utils.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe:
        "Azure DevOps organization name for the hosted service (e.g. 'contoso'), or the full collection URL for an on-premises Azure DevOps Server 2022+ / TFS instance (e.g. 'https://ado.contoso.com/DefaultCollection')",
      type: "string",
      demandOption: true,
    });
  })
  .option("domains", {
    alias: "d",
    describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar", "pat"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .help()
  .parseSync();

/**
 * Resolves the positional `organization` argument into a base URL and name.
 *
 * A bare organization name (e.g. `contoso`) targets the hosted Azure DevOps
 * service at `https://dev.azure.com/{organization}`. A full URL (e.g.
 * `https://ado.contoso.com/DefaultCollection`) targets an on-premises Azure
 * DevOps Server 2022+ / TFS collection and is used as-is.
 */
function resolveOrganization(organization: string): { orgName: string; orgUrl: string; isOnPremises: boolean } {
  if (/^https?:\/\//i.test(organization)) {
    const orgUrl = organization.replace(/\/+$/, "");
    let orgName = orgUrl;
    try {
      const segments = new URL(orgUrl).pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        orgName = segments[segments.length - 1];
      }
    } catch {
      // Leave orgName as the full URL when it cannot be parsed.
    }
    return { orgName, orgUrl, isOnPremises: true };
  }
  return { orgName: organization, orgUrl: `https://dev.azure.com/${organization}`, isOnPremises: false };
}

const resolvedOrg = resolveOrganization((argv.organization as string).trim());
export const orgName = resolvedOrg.orgName;
export const orgUrl = resolvedOrg.orgUrl;
export const isOnPremises = resolvedOrg.isOnPremises;
// Base URL for the Azure DevOps Search (almsearch) REST APIs. On the hosted
// service this is a dedicated host; on-premises it is the collection URL.
export const searchOrgUrl = getAlmSearchBaseUrl(orgUrl);

// Interactive and Azure CLI authentication acquire Entra ID tokens, which
// on-premises servers do not accept. Default on-prem to PAT authentication
// unless the user explicitly selected an authentication method.
const authExplicitlySet = hideBin(process.argv).some((arg) => arg === "-a" || arg === "--authentication" || arg.startsWith("-a=") || arg.startsWith("--authentication="));
const authenticationType = isOnPremises && !authExplicitlySet ? "pat" : (argv.authentication as string);

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, authType: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    // For pat, accessToken is base64("{email}:{token}"). Decode to extract the token part,
    // since getPersonalAccessTokenHandler prepends ":" internally and just needs the raw token.
    const authHandler = authType === "pat" ? getPersonalAccessTokenHandler(Buffer.from(accessToken, "base64").toString("utf8").split(":").slice(1).join(":")) : getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  logger.info("Starting Azure DevOps MCP Server", {
    organization: orgName,
    organizationUrl: orgUrl,
    isOnPremises: isOnPremises,
    authentication: authenticationType,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };
  // The tenant lookup queries the hosted Entra discovery endpoint, which does
  // not apply to on-premises servers — skip it and honor any explicit tenant.
  const tenantId = isOnPremises ? argv.tenant : ((await getOrgTenant(orgName)) ?? argv.tenant);
  const authenticator = createAuthenticator(authenticationType, tenantId);

  if (authenticationType === "pat") {
    const basicValue = await authenticator();
    // basicValue is already base64("{email}:{token}") — use it directly in the Authorization header
    const _originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.headers) {
        const headers = new Headers(init.headers as HeadersInit);
        if (headers.get("Authorization")?.startsWith("Bearer ")) {
          headers.set("Authorization", `Basic ${basicValue}`);
          init = { ...init, headers };
        }
      }
      return _originalFetch(input, init);
    };
    logger.debug("PAT mode: global fetch interceptor installed to rewrite Bearer -> Basic auth headers");
  }

  // removing prompts until further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer, authenticationType), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
