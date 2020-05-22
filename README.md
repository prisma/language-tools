# Prisma Language Support

Using the Language Server Protocol to improve Prisma's developer experience.
Server implementation can be found [here](server).

## How to use

### VS Code

- install stable version of [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) from the marketplace ([plugin source](clients/vscode))
- or install unstable version of [Prisma Dev](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-dev) from the marketplace ([plugin source](clients/vscode))

### Neovim (coming soon)


### IntelliJ/WebStorm (coming soon)

## Development

We include a `.vscode` directory that contains launch configurations for developers.
You can find three settings that will help you get started. The workflow will be
explained in the following items:

- Run `$ npm install` installs dependencies for the extension and the server.
- Run `$ npm run watch` to compile and re-compile the client and server in the background on each change.
- Open this folder in VS Code. In the Debug viewlet, run the 'Client + Server' task, this will open a new vscode instance and attach debuggers for the client and server code.
- Open your `.prisma` schema file
- Now you can add breakpoints to the client and the server.
- To reload, press the reload button in VSCode ( **Developer: Inspect TM Scopes** is helpful for debugging syntax issues )

## Structure

```
.
├── clients               // Language Clients
│   └── vscode
│       └── src 
|           └── extension.ts // Language Client entry point
├── server               // Language Server
│   └── src
│       └── index.ts    // Language Server entry point
└── package.json         // The extension manifest
```

## Testing

Instructions on manual testing can be found [here](TESTING.md).

End-to-End tests:

- Run `npm install` in this folder.
- Open VS Code on this folder.
- Switch to the debug viewlet.
- Select `Language Server E2E Test` from the drop down.
- Run the launch config.
- Open the debug console to view the test results.


