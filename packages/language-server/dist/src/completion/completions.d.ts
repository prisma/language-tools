import { CompletionList, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Block } from '../MessageHandler';
/***
 * @param brackets expects either '()' or '[]'
 */
export declare function isInsideAttribute(currentLineUntrimmed: string, position: Position, brackets: string): boolean;
export declare function positionIsAfterFieldAndType(currentLine: string, position: Position, document: TextDocument): boolean;
export declare function getSuggestionForFieldAttribute(block: Block, currentLine: string, lines: string[], position: Position): CompletionList | undefined;
export declare function getAllRelationNames(lines: Array<string>): Array<string>;
export declare function getSuggestionsForTypes(foundBlock: Block, lines: Array<string>, position: Position, currentLineUntrimmed: string): CompletionList;
/**
 * gets suggestions for block typ
 */
export declare function getSuggestionForFirstInsideBlock(blockType: string, lines: Array<string>, position: Position, block: Block, document: TextDocument): CompletionList;
export declare function getSuggestionForBlockTypes(lines: Array<string>): CompletionList;
export declare function getSuggestionForSupportedFields(blockType: string, currentLine: string): CompletionList | undefined;
export declare function getSuggestionsForInsideAttributes(untrimmedCurrentLine: string, lines: Array<string>, position: Position, block: Block): CompletionList | undefined;
