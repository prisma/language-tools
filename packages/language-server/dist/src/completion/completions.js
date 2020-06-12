"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const MessageHandler_1 = require("../MessageHandler");
const completionUtil_1 = require("./completionUtil");
const klona_1 = __importDefault(require("klona"));
function toCompletionItems(allowedTypes, kind) {
    return allowedTypes.map((label) => ({ label, kind }));
}
/***
 * @param brackets expects either '()' or '[]'
 */
function isInsideAttribute(currentLineUntrimmed, position, brackets) {
    let numberOfOpenBrackets = 0;
    let numberOfClosedBrackets = 0;
    for (let i = 0; i < position.character; i++) {
        if (currentLineUntrimmed[i] === brackets[0]) {
            numberOfOpenBrackets++;
        }
        else if (currentLineUntrimmed[i] === brackets[1]) {
            numberOfClosedBrackets++;
        }
    }
    return numberOfOpenBrackets > numberOfClosedBrackets;
}
exports.isInsideAttribute = isInsideAttribute;
function getSymbolBeforePosition(document, position) {
    return document.getText({
        start: {
            line: position.line,
            character: position.character - 1,
        },
        end: { line: position.line, character: position.character },
    });
}
function positionIsAfterFieldAndType(currentLine, position, document) {
    const wordsBeforePosition = currentLine
        .slice(0, position.character - 1)
        .trim()
        .split(/\s+/);
    const symbolBeforePosition = getSymbolBeforePosition(document, position);
    const symbolBeforeIsWhiteSpace = symbolBeforePosition.search(/\s/);
    const hasAtRelation = wordsBeforePosition.length === 2 && symbolBeforePosition === '@';
    const hasWhiteSpaceBeforePosition = wordsBeforePosition.length === 2 && symbolBeforeIsWhiteSpace !== -1;
    return (wordsBeforePosition.length > 2 ||
        hasAtRelation ||
        hasWhiteSpaceBeforePosition);
}
exports.positionIsAfterFieldAndType = positionIsAfterFieldAndType;
/**
 * Removes all block attribute suggestions that are invalid in this context. E.g. `@@id()` when already used should not be in the suggestions.
 */
function removeInvalidAttributeSuggestions(supportedAttributes, block, lines) {
    let reachedStartLine = false;
    for (const [key, item] of lines.entries()) {
        if (key === block.start.line + 1) {
            reachedStartLine = true;
        }
        if (!reachedStartLine) {
            continue;
        }
        if (key === block.end.line) {
            break;
        }
        if (item.includes('@id')) {
            supportedAttributes = supportedAttributes.filter((attribute) => !attribute.label.includes('id'));
        }
        if (item.includes('@unique')) {
            supportedAttributes = supportedAttributes.filter((attribute) => !attribute.label.includes('unique'));
        }
    }
    return supportedAttributes;
}
function getSuggestionForBlockAttribute(block, document, lines, position) {
    if (block.type !== 'model') {
        return [];
    }
    // create deep copy
    let suggestions = klona_1.default(completionUtil_1.blockAttributes);
    suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines);
    return suggestions;
}
function getSuggestionForFieldAttribute(block, currentLine, lines, position) {
    if (block.type !== 'model' && block.type !== 'type_alias') {
        return;
    }
    // create deep copy
    let suggestions = klona_1.default(completionUtil_1.fieldAttributes);
    if (!(currentLine.includes('Int') || currentLine.includes('String'))) {
        // id not allowed
        suggestions = suggestions.filter((sugg) => sugg.label !== '@id');
    }
    suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines);
    return {
        items: suggestions,
        isIncomplete: false,
    };
}
exports.getSuggestionForFieldAttribute = getSuggestionForFieldAttribute;
function getAllRelationNames(lines) {
    const modelNames = [];
    for (const item of lines) {
        if ((item.includes('model') || item.includes('enum')) &&
            item.includes('{')) {
            // found a block
            const blockType = item.replace(/ .*/, '');
            const blockName = item.slice(blockType.length, item.length - 1).trim();
            modelNames.push(blockName);
            // block is at least 2 lines long
        }
    }
    return modelNames;
}
exports.getAllRelationNames = getAllRelationNames;
function getSuggestionsForTypes(foundBlock, lines, position, currentLineUntrimmed) {
    // create deep copy
    const suggestions = klona_1.default(completionUtil_1.corePrimitiveTypes);
    if (foundBlock instanceof MessageHandler_1.Block) {
        // get all model names
        const modelNames = getAllRelationNames(lines);
        suggestions.push(...toCompletionItems(modelNames, vscode_languageserver_1.CompletionItemKind.Reference));
    }
    const wordsBeforePosition = currentLineUntrimmed
        .slice(0, position.character)
        .split(' ');
    const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1];
    const completeSuggestions = suggestions.filter((s) => s.label.length === wordBeforePosition.length);
    if (completeSuggestions.length !== 0) {
        for (const sugg of completeSuggestions) {
            suggestions.push({
                label: sugg.label + '?',
                kind: sugg.kind,
                documentation: sugg.documentation,
            }, {
                label: sugg.label + '[]',
                kind: sugg.kind,
                documentation: sugg.documentation,
            });
        }
    }
    return {
        items: suggestions,
        isIncomplete: true,
    };
}
exports.getSuggestionsForTypes = getSuggestionsForTypes;
/**
 * Removes all field suggestion that are invalid in this context. E.g. fields that are used already in a block will not be suggested again.
 * This function removes all field suggestion that are invalid in a certain context. E.g. in a generator block `provider, output, platforms, pinnedPlatForm`
 * are possible fields. But those fields are only valid suggestions if they haven't been used in this block yet. So in case `provider` has already been used, only
 * `output, platforms, pinnedPlatform` will be suggested.
 */
function removeInvalidFieldSuggestions(supportedFields, block, lines, position) {
    let reachedStartLine = false;
    for (const [key, item] of lines.entries()) {
        if (key === block.start.line + 1) {
            reachedStartLine = true;
        }
        if (!reachedStartLine || key === position.line) {
            continue;
        }
        if (key === block.end.line) {
            break;
        }
        const fieldName = item.replace(/ .*/, '');
        if (supportedFields.includes(fieldName)) {
            supportedFields = supportedFields.filter((field) => field !== fieldName);
        }
    }
    return supportedFields;
}
function getSuggestionForDataSourceField(block, lines, position) {
    // create deep copy
    const suggestions = klona_1.default(completionUtil_1.supportedDataSourceFields);
    const labels = removeInvalidFieldSuggestions(suggestions.map((item) => item.label), block, lines, position);
    return suggestions.filter((item) => labels.includes(item.label));
}
function getSuggestionForGeneratorField(block, lines, position) {
    // create deep copy
    const suggestions = klona_1.default(completionUtil_1.supportedGeneratorFields);
    const labels = removeInvalidFieldSuggestions(suggestions.map((item) => item.label), block, lines, position);
    return suggestions.filter((item) => labels.includes(item.label));
}
/**
 * gets suggestions for block typ
 */
function getSuggestionForFirstInsideBlock(blockType, lines, position, block, document) {
    let suggestions = [];
    switch (blockType) {
        case 'datasource':
            suggestions = getSuggestionForDataSourceField(block, lines, position);
            break;
        case 'generator':
            suggestions = getSuggestionForGeneratorField(block, lines, position);
            break;
        case 'model':
        case 'type_alias':
            suggestions = getSuggestionForBlockAttribute(block, document, lines, position);
            break;
    }
    return {
        items: suggestions,
        isIncomplete: false,
    };
}
exports.getSuggestionForFirstInsideBlock = getSuggestionForFirstInsideBlock;
function getSuggestionForBlockTypes(lines) {
    // create deep copy
    const suggestions = klona_1.default(completionUtil_1.allowedBlockTypes);
    // enum is not supported in sqlite
    let foundDataSourceBlock = false;
    for (const item of lines) {
        if (item.includes('datasource')) {
            foundDataSourceBlock = true;
            continue;
        }
        if (foundDataSourceBlock) {
            if (item.includes('}')) {
                break;
            }
            if (item.startsWith('provider') && item.includes('sqlite')) {
                suggestions.pop();
            }
        }
        if (!suggestions.map((sugg) => sugg.label).includes('enum')) {
            break;
        }
    }
    return {
        items: suggestions,
        isIncomplete: false,
    };
}
exports.getSuggestionForBlockTypes = getSuggestionForBlockTypes;
function getSuggestionForSupportedFields(blockType, currentLine) {
    let suggestions = [];
    switch (blockType) {
        case 'generator':
            if (currentLine.startsWith('provider')) {
                suggestions = ['prisma-client-js']; // TODO add prisma-client-go when implemented!
            }
            break;
        case 'datasource':
            if (currentLine.startsWith('provider')) {
                suggestions = ['postgresql', 'mysql', 'sqlite'];
            }
            break;
    }
    return {
        items: toCompletionItems(suggestions, vscode_languageserver_1.CompletionItemKind.Field),
        isIncomplete: false,
    };
}
exports.getSuggestionForSupportedFields = getSuggestionForSupportedFields;
function getDefaultValues(currentLine) {
    const suggestions = [];
    if (currentLine.includes('Int') && currentLine.includes('id')) {
        suggestions.push({
            label: 'autoincrement()',
            kind: vscode_languageserver_1.CompletionItemKind.Function,
        });
    }
    else if (currentLine.includes('DateTime')) {
        suggestions.push({ label: 'now()', kind: vscode_languageserver_1.CompletionItemKind.Function });
    }
    else if (currentLine.includes('String')) {
        suggestions.push({ label: 'uuid()', kind: vscode_languageserver_1.CompletionItemKind.Function }, { label: 'cuid()', kind: vscode_languageserver_1.CompletionItemKind.Function });
    }
    else if (currentLine.includes('Boolean')) {
        suggestions.push({ label: 'true', kind: vscode_languageserver_1.CompletionItemKind.Value }, { label: 'false', kind: vscode_languageserver_1.CompletionItemKind.Value });
    }
    return suggestions;
}
// checks if e.g. inside 'fields' or 'references' attribute
function isInsideFieldsOrReferences(currentLineUntrimmed, wordsBeforePosition, attributeName, position) {
    if (!isInsideAttribute(currentLineUntrimmed, position, '[]')) {
        return false;
    }
    // check if in fields or references
    const indexOfFields = wordsBeforePosition.findIndex((word) => word.includes('fields'));
    const indexOfReferences = wordsBeforePosition.findIndex((word) => word.includes('references'));
    if (indexOfFields === -1 && indexOfReferences === -1) {
        return false;
    }
    if ((indexOfFields === -1 && attributeName === 'fields') ||
        (indexOfReferences === -1 && attributeName === 'references')) {
        return false;
    }
    if (attributeName === 'references') {
        return indexOfReferences > indexOfFields;
    }
    if (attributeName === 'fields') {
        return indexOfFields > indexOfReferences;
    }
    return false;
}
function getFieldsFromCurrentBlock(lines, block, position) {
    const suggestions = [];
    let reachedStartLine = false;
    for (const [key, item] of lines.entries()) {
        if (key === block.start.line + 1) {
            reachedStartLine = true;
        }
        if (!reachedStartLine) {
            continue;
        }
        if (key === block.end.line) {
            break;
        }
        if (!item.startsWith('@@') && (!position || key !== position.line)) {
            suggestions.push(item.replace(/ .*/, ''));
        }
    }
    return suggestions;
}
function getSuggestionsForRelationDirective(wordsBeforePosition, currentLineUntrimmed, lines, block, position) {
    const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1];
    const stringTilPosition = currentLineUntrimmed
        .slice(0, position.character)
        .trim();
    if (wordBeforePosition.includes('@relation')) {
        return {
            items: toCompletionItems(['references: []', 'fields: []', '""'], vscode_languageserver_1.CompletionItemKind.Property),
            isIncomplete: false,
        };
    }
    if (isInsideFieldsOrReferences(currentLineUntrimmed, wordsBeforePosition, 'fields', position)) {
        return {
            items: toCompletionItems(getFieldsFromCurrentBlock(lines, block, position), vscode_languageserver_1.CompletionItemKind.Field),
            isIncomplete: false,
        };
    }
    if (isInsideFieldsOrReferences(currentLineUntrimmed, wordsBeforePosition, 'references', position)) {
        const referencedModelName = wordsBeforePosition[1];
        const referencedBlock = MessageHandler_1.getModelOrEnumBlock(referencedModelName, lines);
        // referenced model does not exist
        if (!referencedBlock || referencedBlock.type !== 'model') {
            return;
        }
        return {
            items: toCompletionItems(getFieldsFromCurrentBlock(lines, referencedBlock), vscode_languageserver_1.CompletionItemKind.Field),
            isIncomplete: false,
        };
    }
    if (stringTilPosition.endsWith(',')) {
        const referencesExist = wordsBeforePosition.some((a) => a.includes('references'));
        const fieldsExist = wordsBeforePosition.some((a) => a.includes('fields'));
        if (referencesExist && fieldsExist) {
            return;
        }
        if (referencesExist) {
            return {
                items: toCompletionItems(['fields: []'], vscode_languageserver_1.CompletionItemKind.Property),
                isIncomplete: false,
            };
        }
        if (fieldsExist) {
            return {
                items: toCompletionItems(['references: []'], vscode_languageserver_1.CompletionItemKind.Property),
                isIncomplete: false,
            };
        }
    }
}
function getSuggestionsForInsideAttributes(untrimmedCurrentLine, lines, position, block) {
    let suggestions = [];
    const wordsBeforePosition = lines[position.line]
        .split(' ')
        .slice(0, position.character - 2);
    const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1];
    if (wordBeforePosition.includes('@default')) {
        return {
            items: getDefaultValues(lines[position.line]),
            isIncomplete: false,
        };
    }
    else if (wordBeforePosition.includes('@@unique') ||
        wordBeforePosition.includes('@@id') ||
        wordBeforePosition.includes('@@index')) {
        suggestions = getFieldsFromCurrentBlock(lines, block, position);
    }
    else if (wordsBeforePosition.some((a) => a.includes('@relation'))) {
        return getSuggestionsForRelationDirective(wordsBeforePosition, untrimmedCurrentLine, lines, block, position);
    }
    return {
        items: toCompletionItems(suggestions, vscode_languageserver_1.CompletionItemKind.Field),
        isIncomplete: false,
    };
}
exports.getSuggestionsForInsideAttributes = getSuggestionsForInsideAttributes;
//# sourceMappingURL=completions.js.map