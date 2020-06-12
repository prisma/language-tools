"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const completions = __importStar(require("./completions.json"));
/**
 * Converts a json object containing labels and documentations to CompletionItems.
 */
function convertToCompletionItems(completionItems, itemKind) {
    const result = [];
    for (const item of completionItems) {
        result.push({
            label: item.label,
            kind: itemKind,
            documentation: { kind: vscode_languageserver_1.MarkupKind.Markdown, value: item.documentation },
        });
    }
    return result;
}
/**
 * Converts a json object containing attributes including function signatures to CompletionItems.
 */
function convertAttributesToCompletionItems(completionItems, itemKind) {
    const result = [];
    for (const item of completionItems) {
        const docComment = [
            '```prisma',
            item.fullSignature,
            '```',
            '___',
            item.documentation,
        ];
        for (const param of item.params) {
            docComment.push('', '_@param_ ' + param.label + ' ' + param.documentation);
        }
        result.push({
            label: item.label,
            kind: itemKind,
            insertText: item.label.replace('[]', '[$0]'),
            insertTextFormat: 2,
            documentation: {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: docComment.join('\n'),
            },
        });
    }
    return result;
}
exports.corePrimitiveTypes = convertToCompletionItems(completions.primitiveTypes, vscode_languageserver_1.CompletionItemKind.TypeParameter);
exports.allowedBlockTypes = convertToCompletionItems(completions.blockTypes, vscode_languageserver_1.CompletionItemKind.Class);
exports.supportedDataSourceFields = convertToCompletionItems(completions.dataSourceFields, vscode_languageserver_1.CompletionItemKind.Field);
exports.supportedGeneratorFields = convertToCompletionItems(completions.generatorFields, vscode_languageserver_1.CompletionItemKind.Field);
exports.blockAttributes = convertAttributesToCompletionItems(completions.blockAttributes, vscode_languageserver_1.CompletionItemKind.Property);
exports.fieldAttributes = convertAttributesToCompletionItems(completions.fieldAttributes, vscode_languageserver_1.CompletionItemKind.Property);
//# sourceMappingURL=completionUtil.js.map