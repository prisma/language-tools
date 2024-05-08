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
  // matches any `previewFeatures = [x]` in any position
  // thanks to https://regex101.com for the online scratchpad
  const previewFeaturesRegex = /previewFeatures\s=\s(\[.*\])/g

  // we could match against all the `previewFeatures = [x]` (could be that there is more than one?)
  // var matchAll = text.matchAll(regexp)
  // for (const match of matchAll) {
  //   console.log(match);
  // }
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
