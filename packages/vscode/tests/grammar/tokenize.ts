import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IGrammar, IOnigLib, IRawGrammar } from 'vscode-textmate'
import { INITIAL, Registry, parseRawGrammar } from 'vscode-textmate'
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma'
import { expect } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const grammarPaths: Record<string, string> = {
  'source.prisma': resolve(packageRoot, 'syntaxes/prisma.tmLanguage.json'),
  'source.sql': resolve(packageRoot, 'node_modules/tm-grammars/grammars/sql.json'),
  'source.json': resolve(packageRoot, 'node_modules/tm-grammars/grammars/json.json'),
}

function loadRawGrammar(scopeName: string): IRawGrammar | null {
  const grammarPath = grammarPaths[scopeName]
  if (!grammarPath) {
    return null
  }
  return parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath)
}

let onigLib: Promise<IOnigLib> | undefined

function getOnigLib(): Promise<IOnigLib> {
  if (!onigLib) {
    onigLib = (async () => {
      const wasmPath = resolve(packageRoot, 'node_modules/vscode-oniguruma/release/onig.wasm')
      await loadWASM(readFileSync(wasmPath).buffer)
      return {
        createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
        createOnigString: (text: string) => new OnigString(text),
      }
    })()
  }
  return onigLib
}

let prismaGrammar: Promise<IGrammar> | undefined

function getPrismaGrammar(): Promise<IGrammar> {
  if (!prismaGrammar) {
    prismaGrammar = (async () => {
      const registry = new Registry({
        onigLib: getOnigLib(),
        loadGrammar: (scopeName) => Promise.resolve(loadRawGrammar(scopeName)),
      })
      const grammar = await registry.loadGrammar('source.prisma')
      if (!grammar) {
        throw new Error('could not load the source.prisma grammar')
      }
      return grammar
    })()
  }
  return prismaGrammar
}

export interface Token {
  text: string
  scopes: string[]
}

export async function tokenizeSchema(schema: string): Promise<Token[][]> {
  const grammar = await getPrismaGrammar()
  let ruleStack = INITIAL
  const lines: Token[][] = []
  for (const line of schema.split('\n')) {
    const result = grammar.tokenizeLine(line, ruleStack)
    lines.push(
      result.tokens
        .filter((token) => token.endIndex > token.startIndex)
        .map((token) => ({
          text: line.slice(token.startIndex, token.endIndex),
          scopes: token.scopes,
        })),
    )
    ruleStack = result.ruleStack
  }
  return lines
}

export function findToken(tokens: Token[], text: string): Token | undefined {
  return tokens.find((token) => token.text === text)
}

export function hasScope(token: Token, scope: string): boolean {
  return token.scopes.includes(scope)
}

type EmbeddedLanguage = 'sql' | 'json'

function embeddedLanguageOf(token: Token): EmbeddedLanguage | null {
  if (token.scopes.includes('meta.embedded.block.sql')) {
    return 'sql'
  }
  if (token.scopes.includes('meta.embedded.block.json')) {
    return 'json'
  }
  return null
}

function renderHighlighting(lines: Token[][]): string {
  let rendered = ''
  let openLanguage: EmbeddedLanguage | null = null
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    for (const token of lines[lineIndex]) {
      const language = embeddedLanguageOf(token)
      if (language !== openLanguage) {
        if (openLanguage) {
          rendered += `</${openLanguage}>`
        }
        if (language) {
          rendered += `<${language}>`
        }
        openLanguage = language
      }
      rendered += token.text
    }
    if (lineIndex < lines.length - 1) {
      rendered += '\n'
    }
  }
  if (openLanguage) {
    rendered += `</${openLanguage}>`
  }
  return rendered
}

export async function expectHighlighting(annotated: string): Promise<void> {
  const source = annotated.replace(/<\/?(?:sql|json)>/g, '')
  const lines = await tokenizeSchema(source)
  expect(renderHighlighting(lines)).toBe(annotated)
}
