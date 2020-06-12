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
function testJumpToDefinition(docUri, position, expectedLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        const actualLocation = (yield vscode_1.default.commands.executeCommand('vscode.executeDefinitionProvider', docUri, position));
        assert_1.default.ok(actualLocation.length === 1);
        assert_1.default.deepEqual(actualLocation[0].range, expectedLocation.range);
    });
}
suite('Should jump-to-definition', () => {
    const docUri = helper_1.getDocUri('correct.prisma');
    test('Diagnoses jump from attribute to model', () => __awaiter(void 0, void 0, void 0, function* () {
        yield helper_1.activate(docUri);
        yield testJumpToDefinition(docUri, new vscode_1.default.Position(22, 9), new vscode_1.default.Location(docUri, helper_1.toRange(9, 0, 16, 1)));
        yield testJumpToDefinition(docUri, new vscode_1.default.Position(14, 14), new vscode_1.default.Location(docUri, helper_1.toRange(18, 0, 24, 1)));
        yield testJumpToDefinition(docUri, new vscode_1.default.Position(11, 16), new vscode_1.default.Location(docUri, helper_1.toRange(26, 0, 31, 1)));
    }));
});
//# sourceMappingURL=jumpToDefinition.test.js.map