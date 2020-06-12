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
const path_1 = __importDefault(require("path"));
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
exports.sleep = sleep;
/**
 * Try requiring
 */
function tryRequire(path) {
    try {
        return require(path);
    }
    catch (err) {
        console.error(err);
        return;
    }
}
/**
 * Activates the vscode.prisma extension
 * @todo check readiness of the server instead of timeout
 */
function activate(docUri) {
    return __awaiter(this, void 0, void 0, function* () {
        // The extensionId is `publisher.name` from package.json
        const pj = tryRequire('../../package.json');
        if (!pj) {
            return;
        }
        const ext = vscode_1.default.extensions.getExtension(pj.publisher + '.' + pj.name);
        if (!ext) {
            console.error('Failed to get extension.');
            return;
        }
        yield ext.activate();
        try {
            exports.doc = yield vscode_1.default.workspace.openTextDocument(docUri);
            exports.editor = yield vscode_1.default.window.showTextDocument(exports.doc);
            yield sleep(2500); // Wait for server activation
        }
        catch (e) {
            console.error(e);
        }
    });
}
exports.activate = activate;
function toRange(sLine, sChar, eLine, eChar) {
    const start = new vscode_1.default.Position(sLine, sChar);
    const end = new vscode_1.default.Position(eLine, eChar);
    return new vscode_1.default.Range(start, end);
}
exports.toRange = toRange;
exports.getDocPath = (p) => {
    const t = path_1.default.join(__dirname, '../../../../testFixture', p);
    const tr = path_1.default.join(__dirname, '../../../testFixture', p);
    return path_1.default.join(__dirname, '../../../../testFixture', p);
};
exports.getDocUri = (p) => {
    return vscode_1.default.Uri.file(exports.getDocPath(p));
};
function setTestContent(content) {
    return __awaiter(this, void 0, void 0, function* () {
        const all = new vscode_1.default.Range(exports.doc.positionAt(0), exports.doc.positionAt(exports.doc.getText().length));
        return exports.editor.edit((eb) => eb.replace(all, content));
    });
}
exports.setTestContent = setTestContent;
//# sourceMappingURL=helper.js.map