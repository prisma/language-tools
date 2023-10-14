import { Connection } from 'vscode-languageserver'

export type ConfigBlockType = 'generator' | 'datasource'

export type DatamodelBlockType = 'model' | 'view' | 'type' | 'enum'

export type BlockType = ConfigBlockType | DatamodelBlockType

export type PreviewFeatures =
  // value must be lowercase
  Lowercase<'fullTextIndex'> | Lowercase<'postgresqlExtensions'> | Lowercase<'multiSchema'> | Lowercase<'views'>

export interface LSOptions {
  /**
   * If you have a connection already that the ls should use, pass it in.
   * Else the connection will be created from `process`.
   */
  connection?: Connection
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LSSettings {}
