import { PrismaSchema } from '../Schema'

export function getAllRelationNames(schema: PrismaSchema, regexFilter: RegExp): string[] {
  const modelNames: string[] = []
  for (const [, , line] of schema.iterLines()) {
    const result = regexFilter.exec(line)
    if (result && result[2]) {
      modelNames.push(result[2])
    }
  }
  return modelNames
}
