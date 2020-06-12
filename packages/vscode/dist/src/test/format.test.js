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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = __importDefault(require("vscode"));
const assert_1 = __importDefault(require("assert"));
const helper_1 = require("./helper");
const fs_1 = __importDefault(require("fs"));
function testAutoFormat(docUri, expectedFormatted) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helper_1.activate(docUri);
        const actualFormatted = (yield vscode_1.default.commands.executeCommand('vscode.executeFormatDocumentProvider', docUri, { insertSpaces: true, tabSize: 2 }));
        const workEdits = new vscode_1.default.WorkspaceEdit();
        workEdits.set(docUri, actualFormatted);
        yield vscode_1.default.workspace.applyEdit(workEdits);
        const document = yield vscode_1.default.workspace.openTextDocument(docUri);
        const actualResult = document.getText();
        assert_1.default.equal(actualResult, expectedFormatted);
    });
}
suite('Should auto-format', () => {
    const docUri = helper_1.getDocUri('formatting/autoFormat.prisma');
    const docUriExpected = helper_1.getDocUri('correct.prisma');
    const textDocument = fs_1.default.readFileSync(docUriExpected.fsPath, 'utf8');
    test('Diagnoses auto-format', () => __awaiter(void 0, void 0, void 0, function* () {
        yield testAutoFormat(docUri, textDocument);
    }));
});
//# sourceMappingURL=format.test.js.map