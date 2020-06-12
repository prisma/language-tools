"use strict";
/**
 * Imports
 */
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
const util = __importStar(require("./util"));
const https_1 = __importDefault(require("https"));
const zlib_1 = __importDefault(require("zlib"));
const fs_1 = __importDefault(require("fs"));
/**
 * Install prisma format
 */
function install(fmtPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = yield util.getDownloadURL();
        const file = fs_1.default.createWriteStream(fmtPath);
        // Fetch fetch fetch.
        return new Promise(function (resolve, reject) {
            https_1.default.get(url, function (response) {
                // Did everything go well?
                if (response.statusCode !== 200) {
                    reject(response.statusMessage);
                }
                // If so, unzip and pipe into our file.
                const unzip = zlib_1.default.createGunzip();
                response.pipe(unzip).pipe(file);
                file.on('finish', function () {
                    fs_1.default.chmodSync(fmtPath, '755');
                    file.close();
                    resolve(fmtPath);
                });
            });
        });
    });
}
exports.default = install;
//# sourceMappingURL=install.js.map