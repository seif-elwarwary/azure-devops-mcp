// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  GitAnnotatedTag,
  GitBaseVersionDescriptor,
  GitChange,
  GitPush,
  GitRefUpdate,
  GitTargetVersionDescriptor,
  GitVersionType,
  ItemContentType,
  VersionControlChangeType,
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getEnumKeys } from "../utils.js";
import { createExternalContentResponse } from "../shared/content-safety.js";

const GIT_ADMIN_TOOLS = {
  repo_repository_write: "repo_repository_write",
  repo_recycle_bin: "repo_recycle_bin",
  repo_tag: "repo_tag",
  repo_tag_write: "repo_tag_write",
  repo_commit_diff: "repo_commit_diff",
  repo_file_diff: "repo_file_diff",
  repo_push: "repo_push",
};

const ZERO_OBJECT_ID = "0000000000000000000000000000000000000000";
const versionTypeStrings = getEnumKeys(GitVersionType);
const changeTypeStrings = getEnumKeys(VersionControlChangeType).filter((key) => key !== "None" && key !== "All");

function trimTagRef(ref: { name?: string; objectId?: string }, annotatedTag?: GitAnnotatedTag | null) {
  return {
    name: ref.name?.replace("refs/tags/", ""),
    objectId: ref.objectId,
    ...(annotatedTag ? { message: annotatedTag.message, taggedBy: annotatedTag.taggedBy, taggedObjectId: annotatedTag.taggedObject?.objectId } : {}),
  };
}

async function resolveCommitId(gitApi: Awaited<ReturnType<WebApi["getGitApi"]>>, repositoryId: string, project: string | undefined, branchName: string): Promise<string | undefined> {
  const refs = await gitApi.getRefs(repositoryId, project, "heads/", false, false, undefined, false, undefined, branchName);
  const branch = refs.find((r) => r.name === `refs/heads/${branchName}`);
  return branch?.objectId;
}

function configureGitAdminTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // --- repo_repository_write ---------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_repository_write,
    "Create, rename, disable, delete, or restore a Git repository. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["create", "update", "delete", "restore"])
        .describe(
          "The action to perform. Options: create (create a new repository), update (rename or (de)activate a repository), delete (soft-delete a repository to the recycle bin), restore (restore a soft-deleted repository from the recycle bin)."
        ),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repositoryId: z.string().optional().describe("The ID (or name for update/delete/restore) of the repository. Required for update, delete, and restore."),
      name: z.string().optional().describe("The name of the repository. Required for create. New name for update (rename)."),
      isDisabled: z.boolean().optional().describe("Whether the repository should be disabled (read-only). Used for update."),
    },
    async ({ action, project, repositoryId, name, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "create") {
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const repository = await gitApi.createRepository({ name }, project);
          return { content: [{ type: "text", text: JSON.stringify(repository, null, 2) }] };
        }

        if (action === "update") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for update" }], isError: true };
          if (name === undefined && isDisabled === undefined) {
            return { content: [{ type: "text", text: "At least one of name or isDisabled must be provided for update." }], isError: true };
          }

          const existing = await gitApi.getRepository(repositoryId, project);
          const updated = await gitApi.updateRepository({ ...existing, ...(name !== undefined ? { name } : {}), ...(isDisabled !== undefined ? { isDisabled } : {}) }, repositoryId, project);
          return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
        }

        if (action === "delete") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for delete" }], isError: true };

          await gitApi.deleteRepository(repositoryId, project);
          return { content: [{ type: "text", text: `Repository '${repositoryId}' moved to the recycle bin.` }] };
        }

        if (action === "restore") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for restore" }], isError: true };

          const repository = await gitApi.restoreRepositoryFromRecycleBin({ deleted: false }, project, repositoryId);
          return { content: [{ type: "text", text: JSON.stringify(repository, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with repository write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_recycle_bin ----------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_recycle_bin,
    "List soft-deleted Git repositories in a project's recycle bin. Restore or permanently delete them with repo_repository_write / repo_recycle_bin (delete action).",
    {
      action: z
        .enum(["list", "delete"])
        .default("list")
        .describe("The action to perform. Options: list (list soft-deleted repositories), delete (permanently delete a repository from the recycle bin)."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repositoryId: z.string().optional().describe("The ID of the repository to permanently delete. Required for delete."),
    },
    async ({ action, project, repositoryId }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "list") {
          const deletedRepositories = await gitApi.getRecycleBinRepositories(project);
          return { content: [{ type: "text", text: JSON.stringify(deletedRepositories, null, 2) }] };
        }

        if (action === "delete") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for delete" }], isError: true };

          await gitApi.deleteRepositoryFromRecycleBin(project, repositoryId);
          return { content: [{ type: "text", text: `Repository '${repositoryId}' permanently deleted from the recycle bin.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with recycle bin operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_tag --------------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_tag,
    "Retrieve Git tag data for a repository. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get"]).describe("The action to perform. Options: list (list tags in a repository), get (get a single tag by name)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      tagName: z.string().optional().describe("The name of the tag (without the 'refs/tags/' prefix). Required for get."),
      top: z.coerce.number().default(100).describe("The maximum number of tags to return. Used for list. Defaults to 100."),
      filterContains: z.string().optional().describe("Filter tags containing this string. Used for list."),
    },
    async ({ action, repositoryId, project, tagName, top, filterContains }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "list") {
          const refs = await gitApi.getRefs(repositoryId, project, "tags/", undefined, undefined, undefined, undefined, undefined, filterContains);
          const tags = refs
            .filter((ref) => ref.name?.startsWith("refs/tags/"))
            .map((ref) => trimTagRef(ref))
            .slice(0, top);
          return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
        }

        if (action === "get") {
          if (!tagName) return { content: [{ type: "text", text: "tagName is required for get" }], isError: true };

          const refs = await gitApi.getRefs(repositoryId, project, "tags/", false, false, undefined, false, undefined, tagName);
          const ref = refs.find((r) => r.name === `refs/tags/${tagName}`);
          if (!ref || !ref.objectId) {
            return { content: [{ type: "text", text: `Tag '${tagName}' not found in repository ${repositoryId}` }], isError: true };
          }

          // Lightweight tags point directly at a commit; annotated tags point at a tag
          // object. Try to resolve the annotated tag details and fall back silently.
          const annotatedTag = await gitApi.getAnnotatedTag(project ?? "", repositoryId, ref.objectId).catch(() => null);
          return { content: [{ type: "text", text: JSON.stringify(trimTagRef(ref, annotatedTag), null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with tag operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_tag_write ----------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_tag_write,
    "Create or delete a Git tag. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "delete"]).describe("The action to perform. Options: create (create a lightweight or annotated tag), delete (delete a tag)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      tagName: z.string().describe("The name of the tag (without the 'refs/tags/' prefix)."),
      sourceBranchName: z.string().optional().default("main").describe("The branch to tag. Used for create when sourceCommitId is not given. Defaults to 'main'."),
      sourceCommitId: z.string().optional().describe("The commit ID to tag. Used for create. If omitted, uses the latest commit of sourceBranchName."),
      message: z.string().optional().describe("Annotation message. Used for create; when provided the tag is annotated, otherwise it is lightweight."),
    },
    async ({ action, repositoryId, project, tagName, sourceBranchName, sourceCommitId, message }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const tagRefName = `refs/tags/${tagName}`;

        if (action === "create") {
          let commitId = sourceCommitId;
          if (!commitId) {
            commitId = await resolveCommitId(gitApi, repositoryId, project, sourceBranchName);
            if (!commitId) return { content: [{ type: "text", text: `Source branch '${sourceBranchName}' not found in repository ${repositoryId}` }], isError: true };
          }

          let newObjectId = commitId;
          let annotatedTag: GitAnnotatedTag | undefined;
          if (message) {
            annotatedTag = await gitApi.createAnnotatedTag({ name: tagName, message, taggedObject: { objectId: commitId } }, project ?? "", repositoryId);
            if (!annotatedTag.objectId) return { content: [{ type: "text", text: "Error: annotated tag object was created but returned no objectId." }], isError: true };
            newObjectId = annotatedTag.objectId;
          }

          const refUpdate: GitRefUpdate = { name: tagRefName, newObjectId, oldObjectId: ZERO_OBJECT_ID };
          const result = await gitApi.updateRefs([refUpdate], repositoryId, project);

          if (!result?.length || !result[0].success) {
            const errorMessage = result?.[0]?.customMessage ?? "Unknown error occurred while creating the tag ref";
            return { content: [{ type: "text", text: `Error creating tag '${tagName}': ${errorMessage}` }], isError: true };
          }

          return { content: [{ type: "text", text: JSON.stringify(trimTagRef({ name: tagRefName, objectId: commitId }, annotatedTag), null, 2) }] };
        }

        if (action === "delete") {
          const refs = await gitApi.getRefs(repositoryId, project, "tags/", false, false, undefined, false, undefined, tagName);
          const ref = refs.find((r) => r.name === tagRefName);
          if (!ref?.objectId) return { content: [{ type: "text", text: `Tag '${tagName}' not found in repository ${repositoryId}` }], isError: true };

          const refUpdate: GitRefUpdate = { name: tagRefName, newObjectId: ZERO_OBJECT_ID, oldObjectId: ref.objectId };
          const result = await gitApi.updateRefs([refUpdate], repositoryId, project);

          if (!result?.length || !result[0].success) {
            const errorMessage = result?.[0]?.customMessage ?? "Unknown error occurred while deleting the tag ref";
            return { content: [{ type: "text", text: `Error deleting tag '${tagName}': ${errorMessage}` }], isError: true };
          }

          return { content: [{ type: "text", text: `Tag '${tagName}' deleted.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with tag write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_commit_diff --------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_commit_diff,
    "Compare two branches, tags, or commits and return the list of changed files between them (ahead/behind counts and change entries).",
    {
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      baseVersion: z.string().describe("Version string identifier for the base: branch name, tag name, or commit SHA."),
      baseVersionType: z
        .enum(versionTypeStrings as [string, ...string[]])
        .optional()
        .default("Branch")
        .describe("How to interpret baseVersion. Defaults to 'Branch'."),
      targetVersion: z.string().describe("Version string identifier for the target: branch name, tag name, or commit SHA."),
      targetVersionType: z
        .enum(versionTypeStrings as [string, ...string[]])
        .optional()
        .default("Branch")
        .describe("How to interpret targetVersion. Defaults to 'Branch'."),
      top: z.coerce.number().default(100).describe("The maximum number of changes to return. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of changes to skip. Defaults to 0."),
    },
    async ({ repositoryId, project, baseVersion, baseVersionType, targetVersion, targetVersionType, top, skip }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const baseVersionDescriptor: GitBaseVersionDescriptor = { baseVersion, baseVersionType: GitVersionType[baseVersionType as keyof typeof GitVersionType] };
        const targetVersionDescriptor: GitTargetVersionDescriptor = { targetVersion, targetVersionType: GitVersionType[targetVersionType as keyof typeof GitVersionType] };

        const diffs = await gitApi.getCommitDiffs(repositoryId, project, undefined, top, skip, baseVersionDescriptor, targetVersionDescriptor);
        return createExternalContentResponse(diffs, "commit diff");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error getting commit diff: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_file_diff ----------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_file_diff,
    "Get line-level diffs for specific files between two commits.",
    {
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      baseVersionCommit: z.string().describe("Commit ID of the base version."),
      targetVersionCommit: z.string().describe("Commit ID of the target version."),
      filePaths: z.array(z.string()).min(1).describe("Repository-relative paths of the files to diff."),
    },
    async ({ repositoryId, project, baseVersionCommit, targetVersionCommit, filePaths }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const fileDiffs = await gitApi.getFileDiffs({ baseVersionCommit, targetVersionCommit, fileDiffParams: filePaths.map((path) => ({ path })) }, project ?? "", repositoryId);
        return createExternalContentResponse(fileDiffs, "file diff");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error getting file diff: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_push ---------------------------------------------------------------
  server.tool(
    GIT_ADMIN_TOOLS.repo_push,
    "Commit one or more file changes (add, edit, delete, or rename) directly to a branch, without cloning the repository locally.",
    {
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      branchName: z.string().describe("The branch to push to, e.g. 'main'. Must already exist; use repo_create_branch to create it first."),
      comment: z.string().describe("The commit message."),
      changes: z
        .array(
          z.object({
            changeType: z.enum(changeTypeStrings as [string, ...string[]]).describe("The type of change: Add, Edit, Delete, or Rename."),
            path: z.string().describe("Repository-relative path of the file, e.g. '/src/index.ts'."),
            content: z.string().optional().describe("The new file content. Required for Add and Edit."),
            contentType: z.enum(["RawText", "Base64Encoded"]).optional().default("RawText").describe("How to interpret content. Defaults to 'RawText'."),
            originalPath: z.string().optional().describe("The file's previous path. Required for Rename."),
          })
        )
        .min(1)
        .describe("The file changes to include in this push."),
      baseCommitId: z.string().optional().describe("The commit to push on top of. If omitted, uses the current tip of branchName; provide it to avoid a race with concurrent pushes."),
    },
    async ({ repositoryId, project, branchName, comment, changes, baseCommitId }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const oldObjectId = baseCommitId ?? (await resolveCommitId(gitApi, repositoryId, project, branchName));
        if (!oldObjectId) return { content: [{ type: "text", text: `Branch '${branchName}' not found in repository ${repositoryId}` }], isError: true };

        for (const change of changes) {
          if (change.changeType === "Rename" && !change.originalPath) {
            return { content: [{ type: "text", text: `originalPath is required for a Rename change on '${change.path}'` }], isError: true };
          }
          if ((change.changeType === "Add" || change.changeType === "Edit") && change.content === undefined) {
            return { content: [{ type: "text", text: `content is required for a ${change.changeType} change on '${change.path}'` }], isError: true };
          }
        }

        const gitChanges: GitChange[] = changes.map((change) => ({
          changeType: VersionControlChangeType[change.changeType as keyof typeof VersionControlChangeType],
          item: { path: change.path },
          originalPath: change.originalPath,
          newContent: change.content !== undefined ? { content: change.content, contentType: ItemContentType[change.contentType as keyof typeof ItemContentType] } : undefined,
        }));

        const push: GitPush = {
          refUpdates: [{ name: `refs/heads/${branchName}`, oldObjectId }],
          commits: [{ comment, changes: gitChanges }],
        };

        const result = await gitApi.createPush(push, repositoryId, project);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error pushing changes: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { GIT_ADMIN_TOOLS, configureGitAdminTools };
