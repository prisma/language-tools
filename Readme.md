# Prisma Language Support Test

Using the Language Server Protocol to improve Prisma's developer experience.
Server implementation can be found [here](server).

## How to use

### VS Code

- install .. from the marketplace ([plugin source](clients/vscode))

### Neovim

- install [coc.nvim](https://github.com/neoclide/coc.nvim)
- [`npm i -g @prisma/language-server-test`](https://www.npmjs.com/package/@prisma/language-server-test)
- follow the [instructions](https://github.com/neoclide/coc.nvim/wiki/Language-servers#register-custom-language-servers) using `prisma-language-server-test` as the executable

### IntelliJ/WebStorm (coming soon)

- install [LSP Support](https://plugins.jetbrains.com/plugin/10209-lsp-support) from the marketplace
- [`npm i -g @prisma/language-server-test`](https://www.npmjs.com/package/@prisma/language-server-test)
- [update the server definitions](https://github.com/gtache/intellij-lsp#add-a-language-server) to include the `prisma-language-server-test` executable for the `.prisma` extension

## Development

We include a `.vscode` directory that contains launch configurations for developers.
You can find three settings that will help you get started. The workflow will be
explained in the following items:

- Run `$ npm install` installs dependencies for the extension and the server.
- Run `$ npm run watch` to compile and re-compile the client and server in the background on each change.
- Open this folder in VS Code. In the Debug viewlet, run the 'Client + Server' task, this will open a new vscode instance and attach debuggers for the client and server code.
- Open your `.prisma` schema file
- Now you can add breakpoints to the client and the server.
