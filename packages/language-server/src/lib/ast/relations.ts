export function getAllRelationNames(lines: string[], regexFilter: RegExp): string[] {
  const modelNames: string[] = []
  for (const line of lines) {
    const result = regexFilter.exec(line)
    if (result && result[2]) {
      modelNames.push(result[2])
    }
  }
  return modelNames
}
