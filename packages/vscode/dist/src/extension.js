"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageclient_1 = require("vscode-languageclient");
const vscode_1 = require("vscode");
function createLanguageServer(serverOptions, clientOptions) {
    return new vscode_languageclient_1.LanguageClient('prisma', 'Prisma Language Server', serverOptions, clientOptions);
}
function activate(context) {
    const serverModule = require.resolve('@prisma/language-server/src/cli');
    // for debugging the server
    //const serverModule = context.asAbsolutePath(
    //  path.join('../../packages/language-server/dist/src/cli.js'),
    //)
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = {
        execArgv: ['--nolazy', '--inspect=6009'],
        env: { DEBUG: true },
    };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions,
        },
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for prisma documents
        documentSelector: [{ scheme: 'file', language: 'prisma' }],
    };
    // Create the language client
    let client = createLanguageServer(serverOptions, clientOptions);
    // Start the client. This will also launch the server
    context.subscriptions.push(client.start());
    context.subscriptions.push(vscode_1.commands.registerCommand('prisma.restartLanguageServer', () => __awaiter(this, void 0, void 0, function* () {
        yield client.stop();
        client = createLanguageServer(serverOptions, clientOptions);
        context.subscriptions.push(client.start());
        yield client.onReady();
        vscode_1.window.showInformationMessage('Prisma language server restarted.');
    })));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map