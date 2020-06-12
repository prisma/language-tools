/**
 * Try requiring
 */
export declare function tryRequire(path: string): any;
/**
 * Lookup version
 */
export declare function getVersion(): Promise<string>;
/**
 * Get the exec path
 */
export declare function getBinPath(): Promise<string>;
/**
 * Gets the download URL for a platform
 */
export declare function getDownloadURL(): Promise<string>;
export declare function getCLIVersion(): Promise<string>;
