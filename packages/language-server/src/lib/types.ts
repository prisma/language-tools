import { Connection } from 'vscode-languageserver'

export type ConfigBlockType = 'generator' | 'datasource'

export type DatamodelBlockType = 'model' | 'view' | 'type' | 'enum'

export type BlockType = ConfigBlockType | DatamodelBlockType

export type PreviewFeatures =
  // value must be lowercase
  Lowercase<'fullTextIndex'> | Lowercase<'postgresqlExtensions'> | Lowercase<'views'> | Lowercase<'shardKeys'>

export interface LSOptions {
  /**
   * If you have a connection already that the ls should use, pass it in.
   * Else the connection will be created from `process`.
   */
  connection?: Connection
}

export interface LSSettings {
  /**
   * Whether to show diagnostics
   */
  enableDiagnostics?: boolean
  /**
   * Path to the Prisma schema file or directory containing schema files.
   * Can be:
   * - A path to a single .prisma file
   * - A path to a directory containing multiple .prisma files
   * - Relative to the workspace root or absolute
   *
   * If not provided, the language server will:
   * 1. Try to find prisma.config.ts and use its schema path
   * 2. Fall back to the currently opened document's directory
   */
  schemaPath?: string
}
