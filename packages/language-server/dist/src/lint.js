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
const exec_1 = __importDefault(require("./exec"));
function lint(execPath, text, onError) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield exec_1.default(execPath, ['lint', '--no-env-errors'], text);
            return JSON.parse(result);
        }
        catch (errors) {
            const errorMessage = "prisma-fmt error'd during linting.\n";
            if (onError) {
                onError(errorMessage + errors);
            }
            console.error(errorMessage);
            console.error(errors);
            return [];
        }
    });
}
exports.default = lint;
//# sourceMappingURL=lint.js.map