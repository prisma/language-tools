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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const util = __importStar(require("./util"));
const provider_1 = require("./provider");
const format_1 = __importDefault(require("./format"));
const completions_1 = require("./completion/completions");
function getCurrentLine(document, line) {
    return document.getText({
        start: { line: line, character: 0 },
        end: { line: line, character: Number.MAX_SAFE_INTEGER },
    });
}
function convertDocumentTextToTrimmedLineArray(document) {
    return Array(document.lineCount)
        .fill(0)
        .map((_, i) => getCurrentLine(document, i).trim());
}
function isFirstInsideBlock(position, currentLine) {
    if (currentLine.trim().length === 0) {
        return true;
    }
    const stringTilPosition = currentLine.slice(0, position.character);
    const matchArray = /\w+/.exec(stringTilPosition);
    if (!matchArray) {
        return true;
    }
    return (matchArray.length === 1 &&
        matchArray.index !== undefined &&
        stringTilPosition.length - matchArray.index - matchArray[0].length === 0);
}
function getWordAtPosition(document, position) {
    const currentLine = getCurrentLine(document, position.line);
    // search for the word's beginning and end
    const beginning = currentLine
        .slice(0, position.character + 1)
        .search(/\S+$/);
    const end = currentLine.slice(position.character).search(/\W/);
    if (end < 0) {
        return '';
    }
    return currentLine.slice(beginning, end + position.character);
}
exports.getWordAtPosition = getWordAtPosition;
class Block {
    constructor(type, start, end, name) {
        this.type = type;
        this.start = start;
        this.end = end;
        this.name = name;
    }
}
exports.Block = Block;
function getBlockAtPosition(line, lines) {
    let blockType = '';
    let blockName = '';
    let blockStart = vscode_languageserver_1.Position.create(0, 0);
    let blockEnd = vscode_languageserver_1.Position.create(0, 0);
    // get block beginning
    let reachedLine = false;
    for (const [key, item] of lines.reverse().entries()) {
        const actualIndex = lines.length - 1 - key;
        if (actualIndex === line) {
            reachedLine = true;
        }
        if (!reachedLine) {
            continue;
        }
        if (item.includes('{')) {
            const index = item.search(/\s+/);
            blockType = ~index ? item.slice(0, index) : item;
            blockName = item.slice(blockType.length, item.length - 2).trim();
            blockStart = vscode_languageserver_1.Position.create(actualIndex, 0);
            break;
        }
        // not inside a block
        if (item.includes('}')) {
            lines.reverse();
            return;
        }
    }
    reachedLine = false;
    // get block ending
    for (const [key, item] of lines.reverse().entries()) {
        if (key === line) {
            reachedLine = true;
        }
        if (!reachedLine) {
            continue;
        }
        if (item.includes('}')) {
            blockEnd = vscode_languageserver_1.Position.create(key, 1);
            return new Block(blockType, blockStart, blockEnd, blockName);
        }
    }
    return;
}
function getModelOrEnumBlock(blockName, lines) {
    // get start position of model type
    const results = lines
        .map((line, index) => {
        if ((line.includes('model') && line.includes(blockName)) ||
            (line.includes('enum') && line.includes(blockName))) {
            return index;
        }
    })
        .filter((index) => index !== undefined);
    if (results.length === 0) {
        return;
    }
    const foundBlocks = results
        .map((result) => {
        const block = getBlockAtPosition(result, lines);
        if (block && block.name === blockName) {
            return block;
        }
    })
        .filter((block) => block !== undefined);
    if (foundBlocks.length !== 1) {
        return;
    }
    if (!foundBlocks[0]) {
        return;
    }
    return foundBlocks[0];
}
exports.getModelOrEnumBlock = getModelOrEnumBlock;
/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
function handleDefinitionRequest(documents, params) {
    const textDocument = params.textDocument;
    const position = params.position;
    const document = documents.get(textDocument.uri);
    if (!document) {
        return;
    }
    const lines = convertDocumentTextToTrimmedLineArray(document);
    const word = getWordAtPosition(document, position);
    if (word === '') {
        return;
    }
    // get start position of model type
    const results = lines
        .map((line, index) => {
        if ((line.includes('model') && line.includes(word)) ||
            (line.includes('enum') && line.includes(word))) {
            return index;
        }
    })
        .filter((index) => index !== undefined);
    if (results.length === 0) {
        return;
    }
    const foundBlocks = results
        .map((result) => {
        const block = getBlockAtPosition(result, lines);
        if (block && block.name === word) {
            return block;
        }
    })
        .filter((block) => block !== undefined);
    if (foundBlocks.length !== 1) {
        return;
    }
    if (!foundBlocks[0]) {
        return;
    }
    const startPosition = {
        line: foundBlocks[0].start.line,
        character: foundBlocks[0].start.character,
    };
    const endPosition = {
        line: foundBlocks[0].end.line,
        character: foundBlocks[0].end.character,
    };
    return {
        uri: textDocument.uri,
        range: vscode_languageserver_1.Range.create(startPosition, endPosition),
    };
}
exports.handleDefinitionRequest = handleDefinitionRequest;
/**
 * This handler provides the modification to the document to be formatted.
 */
function handleDocumentFormatting(params, documents, onError) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = params.options;
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        const binPath = yield util.getBinPath();
        return format_1.default(binPath, options.tabSize, document.getText(), onError).then((formatted) => [
            vscode_languageserver_1.TextEdit.replace(provider_1.fullDocumentRange(document), formatted),
        ]);
    });
}
exports.handleDocumentFormatting = handleDocumentFormatting;
function handleHoverRequest(documents, params) {
    const textDocument = params.textDocument;
    const position = params.position;
    const document = documents.get(textDocument.uri);
    if (!document) {
        return;
    }
    const lines = convertDocumentTextToTrimmedLineArray(document);
    const word = getWordAtPosition(document, position);
    if (word === '') {
        return;
    }
    const foundBlock = getModelOrEnumBlock(word, lines);
    if (!foundBlock) {
        return;
    }
    const commentLine = foundBlock.start.line - 1;
    const docComments = document.getText({
        start: { line: commentLine, character: 0 },
        end: { line: commentLine, character: Number.MAX_SAFE_INTEGER },
    });
    if (docComments.startsWith('///')) {
        return {
            contents: docComments.slice(4).trim(),
        };
    }
    // TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
    /*if (docComments.startsWith('//')) {
      return {
        contents: docComments.slice(3).trim(),
      }
    } */
    return;
}
exports.handleHoverRequest = handleHoverRequest;
/**
 *
 * This handler provides the initial list of the completion items.
 */
function handleCompletionRequest(params, documents) {
    const context = params.context;
    const position = params.position;
    if (!context) {
        return;
    }
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return;
    }
    const lines = convertDocumentTextToTrimmedLineArray(document);
    const foundBlock = getBlockAtPosition(position.line, lines);
    if (!foundBlock) {
        return completions_1.getSuggestionForBlockTypes(lines);
    }
    if (isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
        return completions_1.getSuggestionForFirstInsideBlock(foundBlock.type, lines, position, foundBlock, document);
    }
    // Completion was triggered by a triggerCharacter
    if (context.triggerKind === 2) {
        switch (context.triggerCharacter) {
            case '@':
                if (!completions_1.positionIsAfterFieldAndType(lines[position.line], position, document)) {
                    return;
                }
                return completions_1.getSuggestionForFieldAttribute(foundBlock, getCurrentLine(document, position.line), lines, position);
            case '"':
                return completions_1.getSuggestionForSupportedFields(foundBlock.type, lines[position.line]);
        }
    }
    if (foundBlock.type === 'model') {
        const currentLine = lines[position.line];
        const currentLineUntrimmed = getCurrentLine(document, position.line);
        // check if inside attribute
        if (completions_1.isInsideAttribute(currentLineUntrimmed, position, '()')) {
            return completions_1.getSuggestionsForInsideAttributes(currentLineUntrimmed, lines, position, foundBlock);
        }
        // check if type
        if (!completions_1.positionIsAfterFieldAndType(currentLine, position, document)) {
            return completions_1.getSuggestionsForTypes(foundBlock, lines, position, currentLineUntrimmed);
        }
        return completions_1.getSuggestionForFieldAttribute(foundBlock, lines[position.line], lines, position);
    }
}
exports.handleCompletionRequest = handleCompletionRequest;
/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
function handleCompletionResolveRequest(item) {
    return item;
}
exports.handleCompletionResolveRequest = handleCompletionResolveRequest;
//# sourceMappingURL=MessageHandler.js.map