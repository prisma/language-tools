"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function fullDocumentRange(document) {
    const lastLineId = document.lineCount - 1;
    return {
        start: { line: 0, character: 0 },
        end: { line: lastLineId, character: Number.MAX_SAFE_INTEGER },
    };
}
exports.fullDocumentRange = fullDocumentRange;
//# sourceMappingURL=provider.js.map