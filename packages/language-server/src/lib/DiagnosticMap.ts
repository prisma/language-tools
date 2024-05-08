import { Diagnostic } from 'vscode-languageserver'

export class DiagnosticMap {
  private _map = new Map<string, Diagnostic[]>()

  constructor(uris: string[]) {
    for (const uri of uris) {
      this._map.set(uri, [])
    }
  }

  add(fileUri: string, diagnostic: Diagnostic) {
    const entry = this._map.get(fileUri) ?? []
    this._map.set(fileUri, entry)
    entry.push(diagnostic)
  }

  get(fileUri: string): Diagnostic[] {
    return this._map.get(fileUri) ?? []
  }

  entries(): IterableIterator<[string, Diagnostic[]]> {
    return this._map.entries()
  }
}
