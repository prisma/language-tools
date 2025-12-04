# VS Code Extension Plugin System

The extension uses a plugin architecture. Each plugin implements
`PrismaVSCodePlugin`:

```typescript
// packages/vscode/src/plugins/types.ts
interface PrismaVSCodePlugin {
  name: string
  enabled: () => Promise<boolean> | boolean
  activate?: (context: ExtensionContext) => Promise<void> | void
  deactivate?: () => Promise<void> | void
}
```

## Current Plugins

| Plugin                    | Location                          | Purpose                      |
| ------------------------- | --------------------------------- | ---------------------------- |
| `prisma-language-server`  | `plugins/prisma-language-server`  | LSP client for the LS        |
| `prisma-postgres-manager` | `plugins/prisma-postgres-manager` | Manage Prisma Postgres DBs   |
| `prisma-studio`           | `plugins/prisma-studio`           | Launch Prisma Studio         |
| `ai-tools`                | `plugins/ai-tools`                | VS Code LM tools for Copilot |

## Adding a New Plugin

1. Create a new directory under `packages/vscode/src/plugins/`
2. Export a `PrismaVSCodePlugin` object as default
3. Register it in `packages/vscode/src/plugins/index.ts`

```typescript
// plugins/my-plugin/index.ts
import { commands } from 'vscode'
import { PrismaVSCodePlugin } from '../types'

const plugin: PrismaVSCodePlugin = {
  name: 'my-plugin',
  enabled: () => true, // or check a condition
  activate: async (context) => {
    // Register commands, providers, etc.
    context.subscriptions.push(
      commands.registerCommand('prisma.myCommand', () => {
        /* ... */
      }),
    )
  },
  deactivate: () => {},
}

export default plugin
```
