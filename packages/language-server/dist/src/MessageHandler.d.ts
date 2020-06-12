import { TextDocuments, DocumentFormattingParams, TextEdit, Location, DeclarationParams, CompletionParams, CompletionList, CompletionItem, Position, HoverParams, Hover } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
export declare function getWordAtPosition(document: TextDocument, position: Position): string;
export declare class Block {
    type: string;
    start: Position;
    end: Position;
    name: string;
    constructor(type: string, start: Position, end: Position, name: string);
}
export declare function getModelOrEnumBlock(blockName: string, lines: string[]): Block | void;
/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export declare function handleDefinitionRequest(documents: TextDocuments<TextDocument>, params: DeclarationParams): Location | undefined;
/**
 * This handler provides the modification to the document to be formatted.
 */
export declare function handleDocumentFormatting(params: DocumentFormattingParams, documents: TextDocuments<TextDocument>, onError?: (errorMessage: string) => void): Promise<TextEdit[]>;
export declare function handleHoverRequest(documents: TextDocuments<TextDocument>, params: HoverParams): Hover | undefined;
/**
 *
 * This handler provides the initial list of the completion items.
 */
export declare function handleCompletionRequest(params: CompletionParams, documents: TextDocuments<TextDocument>): CompletionList | undefined;
/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
export declare function handleCompletionResolveRequest(item: CompletionItem): CompletionItem;
