# Common Tasks

## Adding a New VS Code Command

1. Define the command in `packages/vscode/package.json` under
   `contributes.commands`
2. Register the handler in the appropriate plugin's `activate()` function

```typescript
// In plugin activate()
commands.registerCommand('prisma.myNewCommand', async () => {
  // implementation
})
```

## Adding a New Code Action / Quick Fix

Code actions are handled in `packages/language-server/src/lib/code-actions/`:

1. Add logic to `index.ts` (`quickFix` function)
2. The `handleCodeActions` in `MessageHandler.ts` calls this

## Adding New Completions

Completions come from two sources:

1. `prisma-schema-wasm` (via `prismaSchemaWasmCompletions`)
2. Local TypeScript completions (`localCompletions`)

For local completions, see `packages/language-server/src/lib/completions/`.

## Adding AI Tools (for VS Code Copilot)

See `packages/vscode/src/plugins/ai-tools/index.ts` for examples.
Tools implement `LanguageModelTool<T>`:

```typescript
class MyTool implements LanguageModelTool<MyInput> {
  async invoke(options, cancelToken) {
    // Run your tool logic
    return new LanguageModelToolResult([new LanguageModelTextPart(result)])
  }
}

// Register in plugin activate()
context.subscriptions.push(lm.registerTool('prisma-my-tool', new MyTool()))
```
