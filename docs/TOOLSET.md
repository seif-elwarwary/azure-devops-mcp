# Toolset

This page lists all available tools provided by the local Azure DevOps MCP server. Use it as a reference to understand what each tool does, what parameters it requires, and how tools are organized by functional area.

### Core

| Tool                                                                | Description                            |
| ------------------------------------------------------------------- | -------------------------------------- |
| [mcp_ado_core_list_projects](#mcp_ado_core_list_projects)           | List all projects in the organization  |
| [mcp_ado_core_list_project_teams](#mcp_ado_core_list_project_teams) | List teams within a project            |
| [mcp_ado_core_get_identity_ids](#mcp_ado_core_get_identity_ids)     | Retrieve identity IDs by search filter |

### Admin

| Tool                                      | Action   | Description                                |
| ----------------------------------------- | -------- | ------------------------------------------ |
| [core_project_write](#core_project_write) | `create` | Create a project (asynchronous)            |
| [core_project_write](#core_project_write) | `update` | Rename/redescribe a project (asynchronous) |
| [core_project_write](#core_project_write) | `delete` | Delete a project (asynchronous)            |
| [core_team_write](#core_team_write)       | `create` | Create a team                              |
| [core_team_write](#core_team_write)       | `update` | Rename/redescribe a team                   |
| [core_team_write](#core_team_write)       | `delete` | Delete a team                              |

### Work

> **Note:** The work tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work) tool structure.

| Tool                          | Action                     | Description                                                                             |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| [work](#work)                 | `list_iterations`          | List all iterations in a project                                                        |
| [work](#work)                 | `list_team_iterations`     | List iterations assigned to a team                                                      |
| [work](#work)                 | `get_team_settings`        | Get team settings including default iteration, backlog iteration, and default area path |
| [work](#work)                 | `get_team_capacity`        | Get team capacity for an iteration                                                      |
| [work](#work)                 | `get_iteration_capacities` | Get an iteration's capacity for all teams in the iteration and project                  |
| [work_iteration_write](#work) | `create`                   | Create iterations                                                                       |
| [work_iteration_write](#work) | `assign`                   | Assign iterations to a team                                                             |
| [work_capacity_write](#work)  | `update`                   | Update the team capacity of a team member for a specific iteration                      |

### Work Items

> **Note:** The work item tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work-items) tool structure.

| Tool                                                        | Action                 | Description                                                             |
| ----------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| [wit_work_item](#wit_work_item)                             | `get`                  | Get a single work item by ID                                            |
| [wit_work_item](#wit_work_item)                             | `get_batch`            | Retrieve multiple work items by IDs                                     |
| [wit_work_item](#wit_work_item)                             | `list_comments`        | List comments on a work item                                            |
| [wit_work_item](#wit_work_item)                             | `my`                   | List work items relevant to the authenticated user                      |
| [wit_work_item](#wit_work_item)                             | `list_revisions`       | Get revision history of a work item                                     |
| [wit_work_item](#wit_work_item)                             | `list_for_iteration`   | Get work items in a specific team iteration                             |
| [wit_work_item](#wit_work_item)                             | `get_type`             | Get metadata for a work item type                                       |
| [wit_work_item_write](#wit_work_item_write)                 | `create`               | Create a new work item                                                  |
| [wit_work_item_write](#wit_work_item_write)                 | `update`               | Update fields on a single work item; supports `test /rev` concurrency   |
| [wit_work_item_write](#wit_work_item_write)                 | `update_batch`         | Update multiple work items in one call                                  |
| [wit_work_item_write](#wit_work_item_write)                 | `add_child`            | Create child work items under a parent                                  |
| [wit_work_item_comment_write](#wit_work_item_comment_write) | `add`                  | Add a comment to a work item                                            |
| [wit_work_item_comment_write](#wit_work_item_comment_write) | `update`               | Update an existing comment on a work item                               |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `link`                 | Link two work items together                                            |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `unlink`               | Remove links from a work item                                           |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `link_to_pull_request` | Link a work item to a pull request                                      |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `add_artifact_link`    | Add a repository, branch, commit, or build artifact link to a work item |
| [wit_query](#wit_query)                                     | `get`                  | Get a work item query by ID or path                                     |
| [wit_query](#wit_query)                                     | `get_results`          | Execute a saved query and return results                                |
| [wit_query](#wit_query)                                     | `wiql`                 | Execute an ad-hoc WIQL query                                            |
| [wit_backlog](#wit_backlog)                                 | `list`                 | List backlog levels for a team                                          |
| [wit_backlog](#wit_backlog)                                 | `list_work_items`      | Get work items in a specific backlog level                              |
| [wit_backlog](#wit_backlog)                                 | `reorder`              | Reorder work items in a backlog or iteration                            |
| [wit_work_item_attachment](#wit_work_item_attachment)       |                        | Download a work item attachment; save locally or return as base64       |
| [wit_area](#wit_area)                                       |                        | Get the area path tree for a project                                    |
| [wit_area_write](#wit_area_write)                           | `create`               | Create an area path                                                     |
| [wit_area_write](#wit_area_write)                           | `update`               | Rename an area path                                                     |
| [wit_area_write](#wit_area_write)                           | `delete`               | Delete an area path                                                     |
| [wit_tag](#wit_tag)                                         | `list`                 | List tags in a project                                                  |
| [wit_tag](#wit_tag)                                         | `get`                  | Get a single tag by ID or name                                          |
| [wit_tag_write](#wit_tag_write)                             | `update`               | Rename a tag                                                            |
| [wit_tag_write](#wit_tag_write)                             | `delete`               | Delete a tag                                                            |
| [wit_query_write](#wit_query_write)                         | `create`               | Create a query or query folder                                          |
| [wit_query_write](#wit_query_write)                         | `update`               | Update a query or folder                                                |
| [wit_query_write](#wit_query_write)                         | `delete`               | Delete a query or folder                                                |
| [wit_attachment_write](#wit_attachment_write)               |                        | Upload a file as a work item attachment, optionally linking it          |
| [wit_recycle_bin](#wit_recycle_bin)                         |                        | List deleted work items in a project                                    |
| [wit_recycle_bin_write](#wit_recycle_bin_write)             | `restore`              | Restore a deleted work item                                             |
| [wit_recycle_bin_write](#wit_recycle_bin_write)             | `destroy`              | Permanently delete a work item                                          |

### Repositories

> **Note:** The repository tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#repos) tool structure.

| Tool                                                              | Action             | Description                                                         |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| [repo_repository](#repo_repository)                               | `get`              | Get a repository by name or ID                                      |
| [repo_repository](#repo_repository)                               | `list`             | List repositories in a project                                      |
| [repo_pull_request](#repo_pull_request)                           | `get`              | Get a pull request by ID                                            |
| [repo_pull_request](#repo_pull_request)                           | `list`             | List pull requests in a repository or project                       |
| [repo_pull_request](#repo_pull_request)                           | `list_by_commits`  | Find pull requests that contain specific commit IDs                 |
| [repo_pull_request_thread](#repo_pull_request_thread)             | `list`             | List comment threads on a pull request                              |
| [repo_pull_request_thread](#repo_pull_request_thread)             | `list_comments`    | List comments in a specific thread                                  |
| [repo_branch](#repo_branch)                                       | `get`              | Get a branch by name                                                |
| [repo_branch](#repo_branch)                                       | `list`             | List branches in a repository                                       |
| [repo_branch](#repo_branch)                                       | `list_mine`        | List branches the current user has pushed to                        |
| [repo_file](#repo_file)                                           | `get_content`      | Get the text content of a file at a specific branch, tag, or commit |
| [repo_file](#repo_file)                                           | `list_directory`   | List files and folders in a directory                               |
| [repo_search_commits](#repo_search_commits)                       |                    | Search commits with filtering by text, author, date range, and more |
| [repo_pull_request_write](#repo_pull_request_write)               | `create`           | Create a pull request                                               |
| [repo_pull_request_write](#repo_pull_request_write)               | `update`           | Update a pull request, including setting autocomplete               |
| [repo_pull_request_write](#repo_pull_request_write)               | `update_reviewers` | Add or remove pull request reviewers                                |
| [repo_pull_request_write](#repo_pull_request_write)               | `vote`             | Cast a vote on a pull request                                       |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `create`           | Create a new comment thread on a pull request                       |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `reply`            | Reply to a comment in a thread                                      |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `update`           | Update an existing comment in a thread                              |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `update_status`    | Update the status of a comment thread                               |
| [repo_create_branch](#repo_create_branch)                         |                    | Create a branch                                                     |
| [repo_repository_write](#repo_repository_write)                   | `create`           | Create a repository                                                 |
| [repo_repository_write](#repo_repository_write)                   | `update`           | Rename or (de)activate a repository                                 |
| [repo_repository_write](#repo_repository_write)                   | `delete`           | Soft-delete a repository to the recycle bin                         |
| [repo_repository_write](#repo_repository_write)                   | `restore`          | Restore a repository from the recycle bin                           |
| [repo_recycle_bin](#repo_recycle_bin)                             | `list`             | List soft-deleted repositories in a project                         |
| [repo_recycle_bin](#repo_recycle_bin)                             | `delete`           | Permanently delete a repository from the recycle bin                |
| [repo_tag](#repo_tag)                                             | `list`             | List tags in a repository                                           |
| [repo_tag](#repo_tag)                                             | `get`              | Get a single tag by name                                            |
| [repo_tag_write](#repo_tag_write)                                 | `create`           | Create a lightweight or annotated tag                               |
| [repo_tag_write](#repo_tag_write)                                 | `delete`           | Delete a tag                                                        |
| [repo_commit_diff](#repo_commit_diff)                             |                    | Compare two branches, tags, or commits                              |
| [repo_file_diff](#repo_file_diff)                                 |                    | Get line-level diffs for specific files between two commits         |
| [repo_push](#repo_push)                                           |                    | Commit file changes directly to a branch                            |
| [policy](#policy)                                                 | `list_types`       | List available branch/repository policy types                       |
| [policy](#policy)                                                 | `list`             | List policy configurations                                          |
| [policy](#policy)                                                 | `get`              | Get a single policy configuration                                   |
| [policy_write](#policy_write)                                     | `create`           | Create a policy configuration                                       |
| [policy_write](#policy_write)                                     | `update`           | Update a policy configuration                                       |
| [policy_write](#policy_write)                                     | `delete`           | Delete a policy configuration                                       |

### Pipelines

> **Note:** The pipeline tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#pipelines) tool structure.

| Tool                                          | Action               | Description                                         |
| --------------------------------------------- | -------------------- | --------------------------------------------------- |
| [pipelines_build](#pipelines_build)           | `list`               | List builds with optional filters                   |
| [pipelines_build](#pipelines_build)           | `get_status`         | Get status, issues, and report metadata for a build |
| [pipelines_build](#pipelines_build)           | `get_changes`        | Get commits and work items associated with a build  |
| [pipelines_build_log](#pipelines_build_log)   | `list`               | List available logs for a build                     |
| [pipelines_build_log](#pipelines_build_log)   | `get_content`        | Get the text content of a specific log by ID        |
| [pipelines_definition](#pipelines_definition) | `list`               | List pipeline definitions with optional filters     |
| [pipelines_definition](#pipelines_definition) | `list_revisions`     | List revision history for a pipeline definition     |
| [pipelines_run](#pipelines_run)               | `get`                | Get a single pipeline run                           |
| [pipelines_run](#pipelines_run)               | `list`               | List runs for a pipeline                            |
| [pipelines_artifact](#pipelines_artifact)     | `list`               | List artifacts for a build                          |
| [pipelines_artifact](#pipelines_artifact)     | `download`           | Download a named build artifact                     |
| [pipelines_write](#pipelines_write)           | `run_pipeline`       | Queue a new pipeline run                            |
| [pipelines_write](#pipelines_write)           | `create_pipeline`    | Create a new YAML pipeline definition               |
| [pipelines_write](#pipelines_write)           | `rename_pipeline`    | Rename an existing pipeline definition              |
| [pipelines_write](#pipelines_write)           | `update_build_stage` | Cancel, retry, or run a stage on an in-flight build |

### Release

| Tool                                                  | Action        | Description                                 |
| ----------------------------------------------------- | ------------- | ------------------------------------------- |
| [release_definition](#release_definition)             | `list`        | List classic Release definitions            |
| [release_definition](#release_definition)             | `get`         | Get a Release definition by ID              |
| [release_definition](#release_definition)             | `get_history` | Get a Release definition's revision history |
| [release_definition_write](#release_definition_write) | `create`      | Create a Release definition                 |
| [release_definition_write](#release_definition_write) | `update`      | Update a Release definition                 |
| [release_definition_write](#release_definition_write) | `delete`      | Delete a Release definition                 |
| [release_definition_write](#release_definition_write) | `undelete`    | Restore a deleted Release definition        |
| [release](#release)                                   | `list`        | List Releases                               |
| [release](#release)                                   | `get`         | Get a Release by ID                         |
| [release_write](#release_write)                       | `create`      | Deploy a new Release from a definition      |
| [release_write](#release_write)                       | `abandon`     | Abandon a Release                           |

### DistributedTask

| Tool                                              | Action   | Description                              |
| ------------------------------------------------- | -------- | ---------------------------------------- |
| [variable_group](#variable_group)                 | `list`   | List variable groups in a project        |
| [variable_group](#variable_group)                 | `get`    | Get a variable group by ID               |
| [variable_group_write](#variable_group_write)     | `create` | Create a variable group                  |
| [variable_group_write](#variable_group_write)     | `update` | Update a variable group                  |
| [variable_group_write](#variable_group_write)     | `delete` | Delete a variable group                  |
| [task_group](#task_group)                         | `list`   | List task groups in a project            |
| [task_group](#task_group)                         | `get`    | Get a task group by ID                   |
| [task_group_write](#task_group_write)             | `create` | Create a task group                      |
| [task_group_write](#task_group_write)             | `update` | Update a task group                      |
| [task_group_write](#task_group_write)             | `delete` | Delete a task group                      |
| [secure_file](#secure_file)                       | `list`   | List secure files in a project           |
| [secure_file](#secure_file)                       | `get`    | Get secure file metadata by ID           |
| [secure_file_write](#secure_file_write)           | `upload` | Upload a secure file                     |
| [secure_file_write](#secure_file_write)           | `delete` | Delete a secure file                     |
| [deployment_group](#deployment_group)             | `list`   | List deployment groups in a project      |
| [deployment_group](#deployment_group)             | `get`    | Get a deployment group by ID             |
| [deployment_group_write](#deployment_group_write) | `create` | Create a deployment group                |
| [deployment_group_write](#deployment_group_write) | `delete` | Delete a deployment group                |
| [agent_pool](#agent_pool)                         | `list`   | List organization-level agent pools      |
| [agent_pool](#agent_pool)                         | `get`    | Get an agent pool by ID                  |
| [agent_pool_write](#agent_pool_write)             | `create` | Create an agent pool                     |
| [agent_pool_write](#agent_pool_write)             | `delete` | Delete an agent pool                     |
| [agent_queue](#agent_queue)                       |          | List project-level agent queues          |
| [agent_queue_write](#agent_queue_write)           | `create` | Create an agent queue referencing a pool |
| [agent_queue_write](#agent_queue_write)           | `delete` | Delete an agent queue                    |

> **Note:** `service_endpoint` / `service_endpoint_write` use the REST API directly (no SDK client is available for service connections).

| Tool                                              | Action   | Description                           |
| ------------------------------------------------- | -------- | ------------------------------------- |
| [service_endpoint](#service_endpoint)             | `list`   | List service connections in a project |
| [service_endpoint](#service_endpoint)             | `get`    | Get a service connection by ID        |
| [service_endpoint_write](#service_endpoint_write) | `create` | Create a service connection           |
| [service_endpoint_write](#service_endpoint_write) | `update` | Update a service connection           |
| [service_endpoint_write](#service_endpoint_write) | `delete` | Delete a service connection           |

### Process

| Tool                                                          | Action                 | Description                                |
| ------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| [process](#process)                                           | `list_processes`       | List process templates in the organization |
| [process](#process)                                           | `get_process`          | Get a process template by ID               |
| [process](#process)                                           | `list_work_item_types` | List work item types in a process          |
| [process](#process)                                           | `get_work_item_type`   | Get a work item type by reference name     |
| [process](#process)                                           | `list_states`          | List workflow states for a work item type  |
| [process_work_item_type_write](#process_work_item_type_write) | `create`               | Create a work item type                    |
| [process_work_item_type_write](#process_work_item_type_write) | `update`               | Update a work item type                    |
| [process_work_item_type_write](#process_work_item_type_write) | `delete`               | Delete a work item type                    |
| [process_field_write](#process_field_write)                   | `add`                  | Add a field to a work item type            |
| [process_field_write](#process_field_write)                   | `update`               | Update a field on a work item type         |
| [process_state_write](#process_state_write)                   | `create`               | Create a workflow state                    |
| [process_state_write](#process_state_write)                   | `update`               | Update a workflow state                    |
| [process_state_write](#process_state_write)                   | `delete`               | Delete a workflow state                    |

### Test Plans

> **Note:** The test plan tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#test-plans) tool structure.

| Tool                                                                                  | Action           | Description                            |
| ------------------------------------------------------------------------------------- | ---------------- | -------------------------------------- |
| [testplan](#testplan)                                                                 | `list_plans`     | List test plans in a project           |
| [testplan](#testplan)                                                                 | `list_suites`    | List test suites under a test plan     |
| [testplan](#testplan)                                                                 | `list_cases`     | List test cases under a test suite     |
| [testplan_show_test_results_from_build_id](#testplan_show_test_results_from_build_id) |                  | Get test results for a specific build  |
| [testplan_test_plan_write](#testplan_test_plan_write)                                 | `create`         | Create a new test plan                 |
| [testplan_test_suite_write](#testplan_test_suite_write)                               | `create`         | Create a test suite within a test plan |
| [testplan_test_suite_write](#testplan_test_suite_write)                               | `add_test_cases` | Add test cases to a test suite         |
| [testplan_test_case_write](#testplan_test_case_write)                                 | `create`         | Create a new test case work item       |
| [testplan_test_case_write](#testplan_test_case_write)                                 | `update_steps`   | Update steps of an existing test case  |

### Wiki

> **Note:** The wiki tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#wiki) tool structure.

| Tool                      | Action             | Description                                  |
| ------------------------- | ------------------ | -------------------------------------------- |
| [wiki](#wiki)             | `list_wikis`       | List all wikis in an organization or project |
| [wiki](#wiki)             | `get_wiki`         | Get details of a specific wiki               |
| [wiki](#wiki)             | `list_pages`       | List pages in a wiki                         |
| [wiki](#wiki)             | `get_page`         | Get wiki page metadata (without content)     |
| [wiki](#wiki)             | `get_page_content` | Retrieve wiki page content                   |
| [wiki_upsert_page](#wiki) |                    | Create or update a wiki page                 |

### Graph

> **Note:** Uses the Graph REST API directly (no SDK client is available for it); requires Azure DevOps Server 2019+ or the hosted service.

| Tool                                              | Action                       | Description                                  |
| ------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| [graph_group](#graph_group)                       | `list`                       | List groups, optionally scoped to a project  |
| [graph_group](#graph_group)                       | `get`                        | Get a group by descriptor                    |
| [graph_group](#graph_group)                       | `list_memberships`           | List a subject's group memberships           |
| [graph_group](#graph_group)                       | `resolve_project_descriptor` | Resolve a project ID to its Graph descriptor |
| [graph_group_write](#graph_group_write)           | `create`                     | Create a group                               |
| [graph_group_write](#graph_group_write)           | `delete`                     | Delete a group                               |
| [graph_membership_write](#graph_membership_write) | `add`                        | Add a user/group as a member of a group      |
| [graph_membership_write](#graph_membership_write) | `remove`                     | Remove a user/group from a group             |

### Search

| Tool                                                | Description                           |
| --------------------------------------------------- | ------------------------------------- |
| [mcp_ado_search_code](#mcp_ado_search_code)         | Search for code across repositories   |
| [mcp_ado_search_wiki](#mcp_ado_search_wiki)         | Search wiki pages by keywords         |
| [mcp_ado_search_workitem](#mcp_ado_search_workitem) | Search work items by text and filters |

### Service Hooks

> **Note:** Uses the REST API directly (no SDK client is available for it).

| Tool                                      | Action               | Description                      |
| ----------------------------------------- | -------------------- | -------------------------------- |
| [service_hook](#service_hook)             | `list_publishers`    | List available event publishers  |
| [service_hook](#service_hook)             | `list_event_types`   | List event types for a publisher |
| [service_hook](#service_hook)             | `list_subscriptions` | List webhook subscriptions       |
| [service_hook](#service_hook)             | `get_subscription`   | Get a subscription by ID         |
| [service_hook_write](#service_hook_write) | `create`             | Create a subscription            |
| [service_hook_write](#service_hook_write) | `update`             | Update a subscription            |
| [service_hook_write](#service_hook_write) | `delete`             | Delete a subscription            |

### Feeds

> **Note:** Uses the Packaging REST API directly (no SDK client is available for it). Requires the Azure Artifacts extension, which is standard on Server 2019+.

| Tool                      | Action          | Description              |
| ------------------------- | --------------- | ------------------------ |
| [feed](#feed)             | `list`          | List feeds               |
| [feed](#feed)             | `get`           | Get a feed by ID or name |
| [feed](#feed)             | `list_packages` | List packages in a feed  |
| [feed](#feed)             | `get_package`   | Get a package by ID      |
| [feed_write](#feed_write) | `create`        | Create a feed            |
| [feed_write](#feed_write) | `update`        | Update a feed            |
| [feed_write](#feed_write) | `delete`        | Delete a feed            |

### Security

> **Note:** Uses the Security REST API directly (no SDK client is available for general ACLs). Permission bit values are namespace-specific; use `security_namespace` (list) to discover the namespace ID and its action bits for a resource type before calling the write or check tools.

| Tool                                        | Action   | Description                                                    |
| ------------------------------------------- | -------- | -------------------------------------------------------------- |
| [security_namespace](#security_namespace)   | `list`   | List security namespaces and their permission bits             |
| [security_namespace](#security_namespace)   | `get`    | Get a security namespace by ID                                 |
| [security_acl](#security_acl)               |          | Get the access control list for a token                        |
| [security_acl_write](#security_acl_write)   | `set`    | Set access control entries for a token                         |
| [security_acl_write](#security_acl_write)   | `remove` | Remove access control entries (or the whole ACL) for a token   |
| [security_permission](#security_permission) |          | Check whether the current user has given permissions on tokens |

### Advanced Security

| Tool                                                                  | Description                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| [mcp_ado_advsec_get_alerts](#mcp_ado_advsec_get_alerts)               | Retrieve Advanced Security alerts for a repository       |
| [mcp_ado_advsec_get_alert_details](#mcp_ado_advsec_get_alert_details) | Get detailed information about a specific security alert |
