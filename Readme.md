# Prisma Language Support Test

Using the Language Server Protocol to improve Prisma's developer experience.
Server implementation can be found [here](server).

## How to use

### VS Code

- install .. from the marketplace ([plugin source](clients/vscode))

### Vim (coming soon)

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
