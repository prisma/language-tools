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
const path_1 = __importDefault(require("path"));
const vscode_test_1 = require("vscode-test");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // The folder containing the Extension Manifest package.json
            // Passed to `--extensionDevelopmentPath`
            const extensionDevelopmentPath = path_1.default.resolve(__dirname, '../../../');
            // The path to test runner
            // Passed to --extensionTestsPath
            const extensionTestsPath = path_1.default.resolve(__dirname, './index');
            // Download VS Code, unzip it and run the integration test
            yield vscode_test_1.runTests({
                extensionDevelopmentPath,
                extensionTestsPath,
                launchArgs: [
                    // This disables all extensions except the one being testing
                    '--disable-extensions',
                ],
            });
        }
        catch (err) {
            console.error('Failed to run tests');
            process.exit(1);
        }
    });
}
//# sourceMappingURL=runTest.js.map