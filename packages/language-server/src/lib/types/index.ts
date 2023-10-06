export * from './previewFeatures'
export * from './settings'

export type BlockType = 'generator' | 'datasource' | 'model' | 'type' | 'enum' | 'view'

export const relationNamesRegexFilter = /^(model|enum|view)\s+(\w+)\s+{/gm

export const relationNamesMongoDBRegexFilter = /^(model|enum|view|type)\s+(\w+)\s+{/gm

export const MAX_SAFE_VALUE_i32 = 2147483647
