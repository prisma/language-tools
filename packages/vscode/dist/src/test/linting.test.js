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
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const assert = __importStar(require("assert"));
const helper_1 = require("./helper");
function testDiagnostics(docUri, expectedDiagnostics) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helper_1.activate(docUri);
        const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
        assert.equal(actualDiagnostics.length, expectedDiagnostics.length);
        expectedDiagnostics.forEach((expectedDiagnostic, i) => {
            const actualDiagnostic = actualDiagnostics[i];
            assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
            assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
            assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
        });
    });
}
suite('Should get linting', () => {
    const docUri = helper_1.getDocUri('linting/missingArgument.prisma');
    const docUri2 = helper_1.getDocUri('linting/wrongType.prisma');
    const docUri3 = helper_1.getDocUri('linting/requiredField.prisma');
    test('Diagnoses missing argument', () => __awaiter(void 0, void 0, void 0, function* () {
        yield testDiagnostics(docUri, [
            {
                message: 'Argument "provider" is missing in data source block "db".',
                range: helper_1.toRange(0, 0, 2, 1),
                severity: vscode.DiagnosticSeverity.Error,
                source: '',
            },
        ]);
    }));
    test('Diagnoses wrong type', () => __awaiter(void 0, void 0, void 0, function* () {
        yield testDiagnostics(docUri2, [
            {
                message: 'Type "Use" is neither a built-in type, nor refers to another model, custom type, or enum.',
                range: helper_1.toRange(14, 12, 14, 16),
                severity: vscode.DiagnosticSeverity.Error,
                source: '',
            },
        ]);
    }));
    test('Diagnoses required field', () => __awaiter(void 0, void 0, void 0, function* () {
        yield testDiagnostics(docUri3, [
            {
                message: 'Error validating: The relation field `author` uses the scalar fields authorId. At least one of those fields is required. Hence the relation field must be required as well.',
                range: helper_1.toRange(14, 2, 15, 0),
                severity: vscode.DiagnosticSeverity.Error,
                source: '',
            },
        ]);
    }));
});
//# sourceMappingURL=linting.test.js.map