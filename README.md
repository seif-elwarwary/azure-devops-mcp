# Azure DevOps MCP Server

> [!WARNING]
> We recently completed a full tool consolidation that includes renaming of existing tools. Please see the [Toolset documentation](docs/TOOLSET.md) for the complete list of new tool names.
>
> If this is a breaking change for your agents or skills, you can temporarily pin the version to `@azure-devops/mcp@2.8.1`

This project gives AI agents access to Azure DevOps through the Model Context Protocol (MCP). Use the hosted remote server for the simplest setup, or run the local server when you need a `stdio` connection.

## Table of Contents

> [!IMPORTANT]
> We recommend using the [Remote MCP Server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) instead of this local server. It requires no installation and gets new features first.
>
> [Learn more](#remote-mcp-server-recommended)

1. [Overview](#overview)
2. [Design](#design)
3. [Remote MCP Server (Recommended)](#remote-mcp-server-recommended)
4. [Supported Tools](#supported-tools)
5. [Local MCP Server Installation (Optional)](#local-mcp-server-installation-optional)
6. [On-Premises Azure DevOps Server (Local Server)](#on-premises-azure-devops-server-local-server)
7. [Using Domains (Local Server)](#using-domains-local-server)
8. [Project and Team Defaults (Local Server)](#project-and-team-defaults-local-server)
9. [Troubleshooting](#troubleshooting)
10. [Examples and Best Practices](#examples-and-best-practices)
11. [Frequently Asked Questions](#frequently-asked-questions)
12. [Contributing](#contributing)

## Overview

The Azure DevOps MCP Server brings Azure DevOps context to your agents. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"
- "List all wikis in the 'Contoso' project"
- "Create a wiki page '/Architecture/Overview' with content about system design"
- "Update the wiki page '/Getting Started' with new onboarding instructions"
- "Get the content of the wiki page '/API/Authentication' from the Documentation wiki"

## Design

Each tool handles a focused Azure DevOps task. The server provides a thin layer over the REST APIs, while the AI agent handles higher-level reasoning.

## Remote MCP Server (Recommended)

For complete instructions, see the [Remote MCP Server onboarding documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops).

The remote server will eventually replace the local server. The local server remains supported, but new development will focus on the remote server. Existing local server users should begin planning their migration.

If you encounter issues with tools, need support, or have a feature request, you can report an issue using the [Remote MCP Server issue template](https://github.com/microsoft/azure-devops-mcp/issues/new?template=remote-mcp-server-issue.md). During the preview period, we will track Remote MCP Server issues through this repository.

### Quick Start

Create `.vscode/mcp.json` in your project and add this configuration. Replace `{organization}` with your Azure DevOps organization name.

```json
{
  "servers": {
    "ado-remote-mcp": {
      "url": "https://mcp.dev.azure.com/{organization}",
      "type": "http"
    }
  },
  "inputs": []
}
```

See the [remote server configuration documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#mcpjson-configuration) for more options.

After saving `.vscode/mcp.json`, start the server from the MCP view in VS Code, then run a prompt like `List ADO projects`.

## Supported Tools

See the [Available Tools](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#available-tools) documentation for the complete list of available remote tools.

For the complete list of local tools, see [TOOLSET.md](./docs/TOOLSET.md).

## Local MCP Server Installation (Optional)

> [!IMPORTANT]
> Start with the Remote MCP Server first. Use the local MCP Server only if your scenario specifically requires a local `stdio` setup.

These steps use Visual Studio Code and GitHub Copilot. For other supported clients, including Visual Studio 2022, Codex, Claude Code, Cursor, OpenCode, and Kilo Code, see the [getting started guide](./docs/GETTINGSTARTED.md).

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders).
2. Install [Node.js 20 or later](https://nodejs.org/en/download).
3. Open your project in VS Code.

### Installation

#### Install from npm

1. Create `.vscode/mcp.json` in your project.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"]
    }
  }
}
```

3. Save the file, then start the `ado` server from the MCP view in VS Code.
4. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
5. Select the Azure DevOps tools, then try a prompt such as `List ADO projects`.
6. When prompted, sign in with a Microsoft account that has access to the selected Azure DevOps organization.

To use nightly builds, replace `@azure-devops/mcp` with `@azure-devops/mcp@next` in the configuration.

For better tool selection, add `.github/copilot-instructions.md` to your project with this instruction:

```text
This project uses Azure DevOps. Always check whether the Azure DevOps MCP server has a tool relevant to the user's request.
```

## On-Premises Azure DevOps Server (Local Server)

The local MCP Server can connect to an on-premises **Azure DevOps Server 2022 or later** in addition to the hosted `dev.azure.com` service. Instead of an organization name, pass the **full collection URL** of your server — for example `https://ado.contoso.com/DefaultCollection` (or `https://ado.contoso.com:8080/tfs/DefaultCollection` for a default IIS configuration).

When a full URL is supplied, the server:

- Uses that URL as-is instead of `https://dev.azure.com/<organization>`.
- Skips the Microsoft Entra tenant lookup, which only applies to the hosted service.
- Defaults authentication to **Personal Access Token (`pat`)**, because interactive and Azure CLI sign-in acquire Entra ID tokens that on-premises servers do not accept. You can still pass `--authentication` explicitly to override this.

> [!NOTE]
> `pat` and `envvar` are the supported authentication methods for on-premises servers. Create a token from your server's **User settings → Personal access tokens**.

### Install from the repository

Because on-premises support may run ahead of the published npm package, install and build the server directly from source:

```sh
# 1. Clone the repository
git clone https://github.com/microsoft/azure-devops-mcp.git
cd azure-devops-mcp

# 2. Install dependencies and build (produces dist/index.js)
npm install
npm run build
```

`npm install` builds the project automatically; re-run `npm run build` after pulling new changes.

### Configure `.vscode/mcp.json` for Azure DevOps Server 2022+

Point the client at your locally built `dist/index.js` and pass your collection URL. Replace `/absolute/path/to/azure-devops-mcp` with the folder you cloned into, and enter your collection URL when prompted:

```json
{
  "inputs": [
    {
      "id": "ado_collection_url",
      "type": "promptString",
      "description": "Azure DevOps Server collection URL (e.g. 'https://ado.contoso.com/DefaultCollection')"
    }
  ],
  "servers": {
    "ado-onprem": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "${input:ado_collection_url}", "--authentication", "pat"],
      "env": {
        "PERSONAL_ACCESS_TOKEN": "<base64encoded email:pat>"
      }
    }
  }
}
```

The `PERSONAL_ACCESS_TOKEN` value must be the base64 encoding of `<email>:<pat>`, where `<email>` is any non-empty string (only the token portion is used) and `<pat>` is the raw token you created on your server. For example:

```sh
# macOS / Linux
printf 'user@contoso.com:<your-pat>' | base64

# Windows PowerShell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('user@contoso.com:<your-pat>'))
```

> [!TIP]
> Prefer supplying `PERSONAL_ACCESS_TOKEN` from your environment or a secrets manager rather than committing it to `mcp.json`. See the [PAT authentication guide](./docs/GETTINGSTARTED.md#-personal-access-token-pat) for details.

Save the file, start the `ado-onprem` server from the MCP view in VS Code, then try a prompt like `List ADO projects`.

> [!NOTE]
> Some tools depend on optional server features. The code, wiki, work item, and commit search tools require the [Code Search extension](https://learn.microsoft.com/en-us/azure/devops/project/search/get-started-search) to be installed on your Azure DevOps Server; without it the `search_*` tools return an error.

## Using Domains (Local Server)

The local server includes many tools. Domains let you load only the tool groups you need, which keeps the tool list manageable and helps clients with tool limits. Available domains are `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, and `advanced-security`.

Add `-d` followed by the domains to the server arguments. For example, this configuration loads only work item-related tools:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado_with_filtered_domains": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "-d", "core", "work", "work-items"]
    }
  }
}
```

Always include `core` so the agent can retrieve project information.

> If you omit `-d`, the server loads all domains.

## Project and Team Defaults (Local Server)

Set default Azure DevOps project and team values in `.vscode/mcp.json` so tools can skip selection prompts.

### Example `.vscode/mcp.json`

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "myorg", "--authentication", "azcli"],
      "env": {
        "ado_mcp_project": "Contoso",
        "ado_mcp_team": "Fabrikam Team"
      }
    }
  }
}
```

## Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## Examples

See the [examples](./docs/EXAMPLES.md) for sample prompts.

## Frequently Asked Questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## Contributing

We welcome contributions. During preview, file issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

- Development setup
- Adding new tools
- Code style and testing
- Pull request process

Read the [Contributions Guide](./CONTRIBUTING.md) before creating a pull request.

## Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## Hall of Fame

Thanks to all contributors who make this project awesome! ❤️

[![Contributors](https://contrib.rocks/image?repo=microsoft/azure-devops-mcp)](https://github.com/microsoft/azure-devops-mcp/graphs/contributors)

> Generated with [contrib.rocks](https://contrib.rocks)

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
