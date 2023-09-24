export * from './previewFeatures'
export * from './settings'

export const relationNamesRegexFilter = /^(model|enum|view)\s+(\w+)\s+{/gm

export const relationNamesMongoDBRegexFilter = /^(model|enum|view|type)\s+(\w+)\s+{/gm
