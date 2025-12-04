# Gotchas and Tips

1. **Don't edit `prisma-schema-wasm` code directly** — it's an external npm
   package. If parsing/formatting behavior needs to change, that happens in
   the main Prisma repository.

2. **Multi-file schema handling** — Always use `PrismaSchema.load()` instead
   of assuming a single file. The schema might be split across multiple
   `.prisma` files.

3. **The `|` in tests is not a typo** — It marks cursor position for testing
   completions, hover, etc.

4. **Dependencies update automatically** — Don't manually bump `@prisma/*`
   packages. The CI handles this.

5. **Debug logging** — Set `"prisma.trace.server": "verbose"` in VS Code
   settings to see LSP communication.

6. **Extension variants** — There are two published extensions: `prisma`
   (stable) and `prisma-insider` (preview). The CI manages which gets
   published when.

7. **Worker processes** — Long-running tasks (like the local Prisma Postgres
   server) run in forked child processes to avoid blocking the extension host.
   See [Local Prisma Postgres](local-prisma-postgres-handling.md) for details.
