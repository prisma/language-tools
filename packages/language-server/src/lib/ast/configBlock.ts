import type { Range, TextDocument } from 'vscode-languageserver-textdocument'

import type { PreviewFeatures } from '../types'
import { convertDocumentTextToTrimmedLineArray } from '.'
import { getCurrentLine } from './findAtPosition'
import { PrismaSchema } from '../Schema'

export function getFirstDatasourceName(schema: PrismaSchema): string | undefined {
  const datasourceBlockFirstLine = schema
    .linesAsArray()
    .find((line) => line.text.startsWith('datasource') && line.text.includes('{'))
  if (!datasourceBlockFirstLine) {
    return undefined
  }
  const indexOfBracket = datasourceBlockFirstLine.text.indexOf('{')
  return datasourceBlockFirstLine.text.slice('datasource'.length, indexOfBracket).trim()
}

export function getFirstDatasourceProvider(schema: PrismaSchema): string | undefined {
  // matches provider inside datasource in any position
  // thanks to https://regex101.com for the online scratchpad
  const result = schema.findWithRegex(/datasource.*\{(\n|\N)\s*(.*\n)?\n*\s*provider\s=\s(\"(.*)\")[^}]+}/)

  if (!result || !result.match[4]) {
    return undefined
  }

  const datasourceProvider = result.match[4]
  if (typeof datasourceProvider === 'string' && datasourceProvider.length >= 1) {
    return datasourceProvider
  }
}

export function getAllPreviewFeaturesFromGenerators(schema: PrismaSchema): PreviewFeatures[] | undefined {
  /**
   * ```prisma
   * generator client {
   *   provider        = "prisma-client-js"
   *   // previewFeatures = [] // This will be ignored
   *   previewFeatures  =  ["views"]
   * }
   * ```
   *
   * ? for more info: https://regex101.com/r/ezoTU2/2
   */
  const previewFeaturesRegex = /^\s*(?!\/\/\s)previewFeatures\s*=\s*(\[.*\])/m

  const result = schema.findWithRegex(previewFeaturesRegex)

  if (!result || !result.match[1]) {
    return undefined
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const previewFeatures = JSON.parse(result.match[1])
    if (Array.isArray(previewFeatures) && previewFeatures.length > 0) {
      return previewFeatures.map((it: string) => it.toLowerCase()) as PreviewFeatures[]
    }
  } catch (e) {}

  return undefined
}
