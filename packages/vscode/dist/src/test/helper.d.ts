/// <reference types="node" />
import vscode from 'vscode';
export declare let doc: vscode.TextDocument;
export declare let editor: vscode.TextEditor;
export declare let documentEol: string;
export declare let platformEol: string;
export declare function sleep(ms: number): Promise<NodeJS.Timeout>;
/**
 * Activates the vscode.prisma extension
 * @todo check readiness of the server instead of timeout
 */
export declare function activate(docUri: vscode.Uri): Promise<void>;
export declare function toRange(sLine: number, sChar: number, eLine: number, eChar: number): vscode.Range;
export declare const getDocPath: (p: string) => string;
export declare const getDocUri: (p: string) => vscode.Uri;
export declare function setTestContent(content: string): Promise<boolean>;
