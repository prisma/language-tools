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
function testHover(docUri, position, expectedHover) {
    return __awaiter(this, void 0, void 0, function* () {
        const actualHover = (yield vscode_1.default.commands.executeCommand('vscode.executeHoverProvider', docUri, position));
        assert_1.default.ok(actualHover.length === 1);
        assert_1.default.ok(actualHover[0].contents.length === 1);
        const result = actualHover[0].contents[0];
        assert_1.default.deepStrictEqual(result.value, expectedHover);
    });
}
suite('Should show /// documentation comments for', () => {
    const docUri = helper_1.getDocUri('hover.prisma');
    test('model', () => __awaiter(void 0, void 0, void 0, function* () {
        yield helper_1.activate(docUri);
        yield testHover(docUri, new vscode_1.default.Position(23, 10), 'Post including an author and content.');
    }));
    test('enum', () => __awaiter(void 0, void 0, void 0, function* () {
        yield testHover(docUri, new vscode_1.default.Position(24, 17), 'This is an enum specifying the UserName.');
    }));
});
// TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
/*
suite('Should show // comments for', () => {
    const docUri = getDocUri('hover.prisma')

    test('model', async() => {
        await testHover(
            docUri,
            new vscode.Position(14, 15),
            'Documentation for this model.')
    })
    test('enum', async () => {
        await testHover(
            docUri,
            new vscode.Position(25, 9),
            'This is a test enum.'
        )
    })
}) */
//# sourceMappingURL=hover.test.js.map