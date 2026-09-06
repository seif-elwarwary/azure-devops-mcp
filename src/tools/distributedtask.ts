// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TaskAgentPoolType, TaskAgentQueue, TaskGroupCreateParameter, TaskGroupUpdateParameter, VariableGroupParameters, VariableValue } from "azure-devops-node-api/interfaces/TaskAgentInterfaces.js";
import { z } from "zod";
import { Readable } from "stream";

const DISTRIBUTED_TASK_TOOLS = {
  variable_group: "variable_group",
  variable_group_write: "variable_group_write",
  task_group: "task_group",
  task_group_write: "task_group_write",
  secure_file: "secure_file",
  secure_file_write: "secure_file_write",
  deployment_group: "deployment_group",
  deployment_group_write: "deployment_group_write",
  agent_pool: "agent_pool",
  agent_pool_write: "agent_pool_write",
  agent_queue: "agent_queue",
  agent_queue_write: "agent_queue_write",
};

function parseVariables(variablesJson: string): { variables?: Record<string, VariableValue>; error?: string } {
  try {
    return { variables: JSON.parse(variablesJson) as Record<string, VariableValue> };
  } catch (error) {
    return { error: `variablesJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function parseTaskGroupJson<T>(taskGroupJson: string): { definition?: T; error?: string } {
  try {
    return { definition: JSON.parse(taskGroupJson) as T };
  } catch (error) {
    return { error: `taskGroupJson is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function configureDistributedTaskTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- variable_group ------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.variable_group,
    "Retrieve variable group data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      groupId: z.coerce.number().int().optional().describe("The variable group ID. Required for get."),
      groupName: z.string().optional().describe("Filter groups by name. Used for list."),
    },
    async ({ action, project, groupId, groupName }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "list") {
          const groups = await taskAgentApi.getVariableGroups(project, groupName);
          return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
        }

        if (action === "get") {
          if (groupId === undefined) return { content: [{ type: "text", text: "groupId is required for get" }], isError: true };

          const group = await taskAgentApi.getVariableGroup(project, groupId);
          return { content: [{ type: "text", text: JSON.stringify(group, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with variable group operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- variable_group_write --------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.variable_group_write,
    "Create, update, or delete a variable group. variablesJson is a JSON object mapping variable name to " + "{ value, isSecret? }. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      projectId: z.string().optional().describe("The project GUID to scope the group to. Required for create and delete (falls back to a lookup of 'project' if omitted)."),
      groupId: z.coerce.number().int().optional().describe("The variable group ID. Required for update and delete."),
      name: z.string().optional().describe("The variable group name. Required for create; new name for update."),
      description: z.string().optional().describe("The variable group description. Used for create and update."),
      variablesJson: z.string().optional().describe('Variables as a JSON object: { "VAR_NAME": { "value": "...", "isSecret": false } }. Required for create and update.'),
    },
    async ({ action, project, projectId, groupId, name, description, variablesJson }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };
          if (!variablesJson) return { content: [{ type: "text", text: "variablesJson is required for create" }], isError: true };

          const { variables, error } = parseVariables(variablesJson);
          if (error) return { content: [{ type: "text", text: error }], isError: true };

          const resolvedProjectId = projectId ?? project;
          const parameters: VariableGroupParameters = {
            name,
            description,
            type: "Vsts",
            variables,
            variableGroupProjectReferences: [{ name, description, projectReference: { id: resolvedProjectId } }],
          };

          const created = await taskAgentApi.addVariableGroup(parameters);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (groupId === undefined) return { content: [{ type: "text", text: "groupId is required for update" }], isError: true };

          const existing = await taskAgentApi.getVariableGroup(project, groupId);
          let variables = existing.variables;
          if (variablesJson !== undefined) {
            const parsed = parseVariables(variablesJson);
            if (parsed.error) return { content: [{ type: "text", text: parsed.error }], isError: true };
            variables = parsed.variables;
          }

          const parameters: VariableGroupParameters = {
            name: name ?? existing.name,
            description: description ?? existing.description,
            type: existing.type,
            variables,
            variableGroupProjectReferences: existing.variableGroupProjectReferences,
          };

          const updated = await taskAgentApi.updateVariableGroup(parameters, groupId);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (groupId === undefined) return { content: [{ type: "text", text: "groupId is required for delete" }], isError: true };

          const resolvedProjectId = projectId ?? project;
          await taskAgentApi.deleteVariableGroup(groupId, [resolvedProjectId]);
          return { content: [{ type: "text", text: `Variable group ${groupId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with variable group write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- task_group --------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.task_group,
    "Retrieve task group (custom pipeline task) data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      taskGroupId: z.string().optional().describe("The task group ID. Required for get."),
      versionSpec: z.string().optional().default("*").describe("Version spec to retrieve. Used for get. Defaults to '*' (latest)."),
    },
    async ({ action, project, taskGroupId, versionSpec }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "list") {
          const groups = await taskAgentApi.getTaskGroups(project);
          return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
        }

        if (action === "get") {
          if (!taskGroupId) return { content: [{ type: "text", text: "taskGroupId is required for get" }], isError: true };

          const group = await taskAgentApi.getTaskGroup(project, taskGroupId, versionSpec);
          return { content: [{ type: "text", text: JSON.stringify(group, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with task group operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- task_group_write ----------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.task_group_write,
    "Create, update, or delete a task group. taskGroupJson is the full task group definition (name, tasks, inputs, " +
      "runsOn) as documented in the Azure DevOps REST API. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update", "delete"]).describe("The action to perform. Options: create, update, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      taskGroupId: z.string().optional().describe("The task group ID. Required for delete; included in taskGroupJson for update."),
      taskGroupJson: z.string().optional().describe("The task group definition as a JSON-encoded object. Required for create and update."),
      comment: z.string().optional().describe("Comment for the deletion. Used for delete."),
    },
    async ({ action, project, taskGroupId, taskGroupJson, comment }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "create") {
          if (!taskGroupJson) return { content: [{ type: "text", text: "taskGroupJson is required for create" }], isError: true };

          const { definition, error } = parseTaskGroupJson<TaskGroupCreateParameter>(taskGroupJson);
          if (error || !definition) return { content: [{ type: "text", text: error ?? "Invalid taskGroupJson" }], isError: true };

          const created = await taskAgentApi.addTaskGroup(definition, project);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "update") {
          if (!taskGroupJson) return { content: [{ type: "text", text: "taskGroupJson is required for update" }], isError: true };

          const { definition, error } = parseTaskGroupJson<TaskGroupUpdateParameter>(taskGroupJson);
          if (error || !definition) return { content: [{ type: "text", text: error ?? "Invalid taskGroupJson" }], isError: true };

          const updated = await taskAgentApi.updateTaskGroup(definition, project, taskGroupId);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (!taskGroupId) return { content: [{ type: "text", text: "taskGroupId is required for delete" }], isError: true };

          await taskAgentApi.deleteTaskGroup(project, taskGroupId, comment);
          return { content: [{ type: "text", text: `Task group ${taskGroupId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with task group write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- secure_file ---------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.secure_file,
    "Retrieve secure file (pipeline library file) metadata for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      secureFileId: z.string().optional().describe("The secure file ID. Required for get."),
      namePattern: z.string().optional().describe("Filter files by name pattern. Used for list."),
    },
    async ({ action, project, secureFileId, namePattern }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "list") {
          const files = await taskAgentApi.getSecureFiles(project, namePattern);
          return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
        }

        if (action === "get") {
          if (!secureFileId) return { content: [{ type: "text", text: "secureFileId is required for get" }], isError: true };

          const file = await taskAgentApi.getSecureFile(project, secureFileId);
          return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with secure file operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- secure_file_write -----------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.secure_file_write,
    "Upload or delete a secure file (pipeline library file). Use the action parameter to specify the operation.",
    {
      action: z.enum(["upload", "delete"]).describe("The action to perform. Options: upload, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      name: z.string().optional().describe("The file name. Required for upload."),
      content: z.string().optional().describe("The file content, base64-encoded. Required for upload."),
      secureFileId: z.string().optional().describe("The secure file ID. Required for delete."),
    },
    async ({ action, project, name, content, secureFileId }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "upload") {
          if (!name) return { content: [{ type: "text", text: "name is required for upload" }], isError: true };
          if (!content) return { content: [{ type: "text", text: "content is required for upload" }], isError: true };

          const buffer = Buffer.from(content, "base64");
          const file = await taskAgentApi.uploadSecureFile(null, Readable.from(buffer), project, name);
          return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
        }

        if (action === "delete") {
          if (!secureFileId) return { content: [{ type: "text", text: "secureFileId is required for delete" }], isError: true };

          await taskAgentApi.deleteSecureFile(project, secureFileId);
          return { content: [{ type: "text", text: `Secure file ${secureFileId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with secure file write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- deployment_group ------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.deployment_group,
    "Retrieve deployment group data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      deploymentGroupId: z.coerce.number().int().optional().describe("The deployment group ID. Required for get."),
      name: z.string().optional().describe("Filter groups by name. Used for list."),
    },
    async ({ action, project, deploymentGroupId, name }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "list") {
          const groups = await taskAgentApi.getDeploymentGroups(project, name);
          return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
        }

        if (action === "get") {
          if (deploymentGroupId === undefined) return { content: [{ type: "text", text: "deploymentGroupId is required for get" }], isError: true };

          const group = await taskAgentApi.getDeploymentGroup(project, deploymentGroupId);
          return { content: [{ type: "text", text: JSON.stringify(group, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with deployment group operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- deployment_group_write --------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.deployment_group_write,
    "Create or delete a deployment group. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "delete"]).describe("The action to perform. Options: create, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      name: z.string().optional().describe("The deployment group name. Required for create."),
      description: z.string().optional().describe("The deployment group description. Used for create."),
      deploymentGroupId: z.coerce.number().int().optional().describe("The deployment group ID. Required for delete."),
    },
    async ({ action, project, name, description, deploymentGroupId }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const created = await taskAgentApi.addDeploymentGroup({ name, description }, project);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "delete") {
          if (deploymentGroupId === undefined) return { content: [{ type: "text", text: "deploymentGroupId is required for delete" }], isError: true };

          await taskAgentApi.deleteDeploymentGroup(project, deploymentGroupId);
          return { content: [{ type: "text", text: `Deployment group ${deploymentGroupId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with deployment group write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- agent_pool ------------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.agent_pool,
    "Retrieve agent pool data (organization-level). Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list, get (by ID)."),
      poolId: z.coerce.number().int().optional().describe("The agent pool ID. Required for get."),
      poolName: z.string().optional().describe("Filter pools by name. Used for list."),
    },
    async ({ action, poolId, poolName }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "list") {
          const pools = await taskAgentApi.getAgentPools(poolName);
          return { content: [{ type: "text", text: JSON.stringify(pools, null, 2) }] };
        }

        if (action === "get") {
          if (poolId === undefined) return { content: [{ type: "text", text: "poolId is required for get" }], isError: true };

          const pool = await taskAgentApi.getAgentPool(poolId);
          return { content: [{ type: "text", text: JSON.stringify(pool, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with agent pool operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- agent_pool_write ---------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.agent_pool_write,
    "Create or delete an organization-level agent pool. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "delete"]).describe("The action to perform. Options: create, delete."),
      name: z.string().optional().describe("The agent pool name. Required for create."),
      isHosted: z.boolean().optional().default(false).describe("Whether this is a hosted pool. Used for create. Defaults to false."),
      poolId: z.coerce.number().int().optional().describe("The agent pool ID. Required for delete."),
    },
    async ({ action, name, isHosted, poolId }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const created = await taskAgentApi.addAgentPool({ name, isHosted, poolType: TaskAgentPoolType.Automation });
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "delete") {
          if (poolId === undefined) return { content: [{ type: "text", text: "poolId is required for delete" }], isError: true };

          await taskAgentApi.deleteAgentPool(poolId);
          return { content: [{ type: "text", text: `Agent pool ${poolId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with agent pool write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- agent_queue -----------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.agent_queue,
    "List agent queues (project-level references to agent pools).",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      queueName: z.string().optional().describe("Filter queues by name."),
    },
    async ({ project, queueName }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        const queues = await taskAgentApi.getAgentQueues(project, queueName);
        return { content: [{ type: "text", text: JSON.stringify(queues, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing agent queues: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- agent_queue_write ---------------------------------------------------------------
  server.tool(
    DISTRIBUTED_TASK_TOOLS.agent_queue_write,
    "Create or delete a project-level agent queue that references an agent pool. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "delete"]).describe("The action to perform. Options: create, delete."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      name: z.string().optional().describe("The queue name. Required for create."),
      poolId: z.coerce.number().int().optional().describe("The agent pool ID to reference. Required for create."),
      queueId: z.coerce.number().int().optional().describe("The queue ID. Required for delete."),
    },
    async ({ action, project, name, poolId, queueId }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };
          if (poolId === undefined) return { content: [{ type: "text", text: "poolId is required for create" }], isError: true };

          const queue: TaskAgentQueue = { name, pool: { id: poolId } };
          const created = await taskAgentApi.addAgentQueue(queue, project);
          return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
        }

        if (action === "delete") {
          if (queueId === undefined) return { content: [{ type: "text", text: "queueId is required for delete" }], isError: true };

          await taskAgentApi.deleteAgentQueue(queueId, project);
          return { content: [{ type: "text", text: `Agent queue ${queueId} deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with agent queue write operation: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { DISTRIBUTED_TASK_TOOLS, configureDistributedTaskTools };
