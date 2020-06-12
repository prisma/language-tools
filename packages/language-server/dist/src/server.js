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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const MessageHandler = __importStar(require("./MessageHandler"));
const provider_1 = require("./provider");
const util = __importStar(require("./util"));
const lint_1 = __importDefault(require("./lint"));
const fs_1 = __importDefault(require("fs"));
const install_1 = __importDefault(require("./install"));
/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
function startServer(options) {
    let connection = options === null || options === void 0 ? void 0 : options.connection;
    if (!connection) {
        connection = process.argv.includes('--stdio')
            ? vscode_languageserver_1.createConnection(process.stdin, process.stdout)
            : vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
    }
    const documents = new vscode_languageserver_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
    connection.onInitialize(() => __awaiter(this, void 0, void 0, function* () {
        const binPathPrismaFmt = yield util.getBinPath();
        if (!fs_1.default.existsSync(binPathPrismaFmt)) {
            try {
                yield install_1.default(binPathPrismaFmt);
                connection.console.info('Prisma plugin prisma-fmt installation succeeded.');
            }
            catch (err) {
                connection.console.error('Cannot install prisma-fmt: ' + err);
            }
        }
        connection.console.info('Installed version of Prisma binary `prisma-fmt`: ' +
            (yield util.getVersion()));
        const pj = util.tryRequire('../../package.json');
        connection.console.info('Extension name ' + pj.name + ' with version ' + pj.version);
        const prismaCLIVersion = yield util.getCLIVersion();
        connection.console.info('Prisma CLI version: ' + prismaCLIVersion);
        return {
            capabilities: {
                definitionProvider: true,
                documentFormattingProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['@', '"'],
                },
                hoverProvider: true,
            },
        };
    }));
    documents.onDidChangeContent((change) => {
        validateTextDocument(change.document);
    });
    documents.onDidOpen((open) => {
        validateTextDocument(open.document);
    });
    connection.onDefinition((params) => MessageHandler.handleDefinitionRequest(documents, params));
    connection.onCompletion((params) => MessageHandler.handleCompletionRequest(params, documents));
    connection.onCompletionResolve((params) => MessageHandler.handleCompletionResolveRequest(params));
    connection.onHover((params) => MessageHandler.handleHoverRequest(documents, params));
    connection.onDocumentFormatting((params) => MessageHandler.handleDocumentFormatting(params, documents, (errorMessage) => {
        connection.window.showErrorMessage(errorMessage);
    }));
    function validateTextDocument(textDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            const text = textDocument.getText(provider_1.fullDocumentRange(textDocument));
            const binPath = yield util.getBinPath();
            const res = yield lint_1.default(binPath, text, (errorMessage) => {
                connection.window.showErrorMessage(errorMessage);
            });
            const diagnostics = [];
            if (res.some((err) => err.text === "Field declarations don't require a `:`." ||
                err.text ===
                    'Model declarations have to be indicated with the `model` keyword.')) {
                connection.window.showErrorMessage("You are currently viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma VSCode extension doesn't support this syntax. To get proper syntax highlighting for this file, please change the file extension to `.graphql` and download the [GraphQL VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.vscode-graphql). Learn more [here](https://pris.ly/prisma1-vscode).");
            }
            for (const error of res) {
                const diagnostic = {
                    severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                    range: {
                        start: textDocument.positionAt(error.start),
                        end: textDocument.positionAt(error.end),
                    },
                    message: error.text,
                    source: '',
                };
                diagnostics.push(diagnostic);
            }
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
        });
    }
    // Make the text document manager listen on the connection
    // for open, change and close text document events
    documents.listen(connection);
    connection.listen();
}
exports.startServer = startServer;
//# sourceMappingURL=server.js.map