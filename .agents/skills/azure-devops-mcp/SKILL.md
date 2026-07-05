```markdown
# azure-devops-mcp Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and conventions used in the `azure-devops-mcp` TypeScript codebase. It provides guidance on file naming, import/export styles, commit message practices, and testing patterns. While no specific automation workflows were detected, this guide includes suggested commands and step-by-step instructions for common development tasks.

## Coding Conventions

### File Naming
- **Style:** camelCase
- **Example:**  
  ```
  azurePipelineConfig.ts
  deploymentManager.ts
  ```

### Import Style
- **Mixed usage:** Both named and default imports may be used.
- **Examples:**
  ```typescript
  import { getConfig } from './configManager';
  import deploymentManager from './deploymentManager';
  ```

### Export Style
- **Named exports are preferred.**
- **Example:**
  ```typescript
  // deploymentManager.ts
  export function deployApp() { ... }
  export function rollbackApp() { ... }
  ```

### Commit Message Patterns
- **Type:** Freeform (no enforced prefixes)
- **Average Length:** ~53 characters
- **Examples:**
  ```
  Fix pipeline trigger for release branches
  Add support for multi-stage deployments
  ```

## Workflows

### Running Tests
**Trigger:** When you want to verify code changes.
**Command:** `/run-tests`

1. Ensure all dependencies are installed.
2. Run the test suite using your preferred test runner (e.g., `npm test` or `yarn test`).
3. Review the output for any failed tests.

### Adding a New Module
**Trigger:** When introducing new functionality.
**Command:** `/add-module`

1. Create a new `.ts` file using camelCase naming.
2. Use named exports for all public functions.
3. Import dependencies using mixed import styles as needed.
4. Write corresponding tests in a `.test.ts` file.

### Writing a Commit
**Trigger:** When committing code changes.
**Command:** `/commit`

1. Write a clear, concise commit message (~50 characters).
2. No strict prefix required; describe the change directly.
3. Example:  
   ```
   Update deployment script for new environment variables
   ```

## Testing Patterns

- **File Pattern:** Test files are named with the `.test.` infix, e.g., `deploymentManager.test.ts`.
- **Framework:** Not explicitly detected; use your team's preferred test runner.
- **Example:**
  ```typescript
  // deploymentManager.test.ts
  import { deployApp } from './deploymentManager';

  test('deployApp deploys successfully', () => {
    expect(deployApp()).toBe(true);
  });
  ```

## Commands
| Command      | Purpose                                  |
|--------------|------------------------------------------|
| /run-tests   | Run all test suites                      |
| /add-module  | Scaffold a new module with conventions   |
| /commit      | Guide for writing a commit message       |
```
