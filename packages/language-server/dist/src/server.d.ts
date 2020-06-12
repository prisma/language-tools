import { IConnection } from 'vscode-languageserver';
export interface LSOptions {
    /**
     * If you have a connection already that the ls should use, pass it in.
     * Else the connection will be created from `process`.
     */
    connection?: IConnection;
}
/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export declare function startServer(options?: LSOptions): void;
