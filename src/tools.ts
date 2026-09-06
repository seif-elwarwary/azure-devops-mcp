// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WebApi } from "azure-devops-node-api";

import { isOnPremises } from "./index.js";
import { wrapExternalToolResponse } from "./shared/content-safety.js";
import { Domain } from "./shared/domains.js";
import { configureAdminTools } from "./tools/admin.js";
import { configureAdvSecTools } from "./tools/advanced-security.js";
import { configureMcpAppsTools } from "./tools/mcp-apps.js";
import { configurePipelineTools } from "./tools/pipelines.js";
import { configureReleaseTools } from "./tools/release.js";
import { configureDistributedTaskTools } from "./tools/distributedtask.js";
import { configureProcessTools } from "./tools/process.js";
import { configureGraphTools } from "./tools/graph.js";
import { configureCoreTools } from "./tools/core.js";
import { configureGitAdminTools } from "./tools/git-admin.js";
import { configurePolicyTools } from "./tools/policies.js";
import { configureRepoTools } from "./tools/repositories.js";
import { configureSearchTools } from "./tools/search.js";
import { configureTestPlanTools } from "./tools/test-plans.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/work-items.js";
import { configureWorkItemsAdminTools } from "./tools/work-items-admin.js";

function configureAllTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, enabledDomains: Set<string>) {
  const configureIfDomainEnabled = (domain: string, configureFn: () => void) => {
    if (enabledDomains.has(domain)) {
      configureToolsWithContentSafety(server, domain, configureFn);
    }
  };

  configureIfDomainEnabled(Domain.CORE, () => configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.ADMIN, () => configureAdminTools(server, tokenProvider, connectionProvider));
  // This is a local health-check response and contains no Azure DevOps content.
  if (enabledDomains.has(Domain.MCP_APPS)) configureMcpAppsTools(server);
  configureIfDomainEnabled(Domain.WORK, () => configureWorkTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.PIPELINES, () => configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.RELEASE, () => configureReleaseTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.DISTRIBUTED_TASK, () => configureDistributedTaskTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.PROCESS, () => configureProcessTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.GRAPH, () => configureGraphTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configureGitAdminTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configurePolicyTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WORK_ITEMS, () => configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK_ITEMS, () => configureWorkItemsAdminTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WIKI, () => configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.TEST_PLANS, () => configureTestPlanTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.SEARCH, () => configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider));
  // GitHub Advanced Security for Azure DevOps is a hosted-only feature; it does not exist on-premises.
  if (!isOnPremises) configureIfDomainEnabled(Domain.ADVANCED_SECURITY, () => configureAdvSecTools(server, tokenProvider, connectionProvider));
}

/**
 * Centralizes the untrusted-content boundary for tool responses. Tool registration
 * is synchronous, so the original method is restored before this function returns.
 */
function configureToolsWithContentSafety(server: McpServer, domain: string, configureFn: () => void): void {
  const originalTool = server.tool;
  const originalRegisterTool = server.registerTool;

  const wrapRegistrationMethod = <T extends (...args: never[]) => unknown>(registrationMethod: T): T =>
    new Proxy(registrationMethod, {
      apply(target, thisArg, argumentsList: unknown[]) {
        const callbackIndex = argumentsList.length - 1;
        const callback = argumentsList[callbackIndex];

        if (typeof callback === "function") {
          argumentsList[callbackIndex] = async (...callbackArgs: unknown[]) => {
            const response = (await Reflect.apply(callback, undefined, callbackArgs)) as CallToolResult;
            return wrapExternalToolResponse(response, `Azure DevOps ${domain}`);
          };
        }

        return Reflect.apply(target, thisArg, argumentsList);
      },
    });

  server.tool = wrapRegistrationMethod(originalTool);
  server.registerTool = wrapRegistrationMethod(originalRegisterTool);

  try {
    configureFn();
  } finally {
    server.tool = originalTool;
    server.registerTool = originalRegisterTool;
  }
}

export { configureAllTools };
