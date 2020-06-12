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
/**
 * Imports
 */
const get_platform_1 = require("@prisma/get-platform");
const pkg_dir_1 = __importDefault(require("pkg-dir"));
const path_1 = __importDefault(require("path"));
/**
 * Lookup Cache
 */
let platform;
let version;
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
exports.tryRequire = tryRequire;
/**
 * Lookup version
 */
function getVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        const pkgPath = yield pkg_dir_1.default(__dirname);
        if (!pkgPath) {
            return 'latest';
        }
        const pkg = tryRequire(path_1.default.join(pkgPath, 'package.json'));
        if (!pkg['prisma'] || !pkg['prisma']['version']) {
            return 'latest';
        }
        return pkg['prisma']['version'];
    });
}
exports.getVersion = getVersion;
/**
 * Get the exec path
 */
function getBinPath() {
    return __awaiter(this, void 0, void 0, function* () {
        platform = platform || (yield get_platform_1.getPlatform());
        version = version || (yield getVersion());
        const extension = platform === 'windows' ? '.exe' : '';
        return path_1.default.join(__dirname, `prisma-fmt.${version}${extension}`);
    });
}
exports.getBinPath = getBinPath;
/**
 * Gets the download URL for a platform
 */
function getDownloadURL() {
    return __awaiter(this, void 0, void 0, function* () {
        platform = platform || (yield get_platform_1.getPlatform());
        version = version || (yield getVersion());
        const extension = platform === 'windows' ? '.exe.gz' : '.gz';
        return `https://binaries.prisma.sh/master/${version}/${platform}/prisma-fmt${extension}`;
    });
}
exports.getDownloadURL = getDownloadURL;
function getCLIVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        const pkgPath = yield pkg_dir_1.default(__dirname);
        if (!pkgPath) {
            return '';
        }
        const pkg = tryRequire(path_1.default.join(pkgPath, 'package.json'));
        return pkg['dependencies']['@prisma/get-platform'];
    });
}
exports.getCLIVersion = getCLIVersion;
//# sourceMappingURL=util.js.map