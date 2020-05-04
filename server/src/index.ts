import { createConnection, ProposedFeatures } from 'vscode-languageserver'
import { PLS } from './service'

const connection =
  process.argv.length <= 2
    ? createConnection(process.stdin, process.stdout)
    : createConnection(ProposedFeatures.all)

console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

PLS.start(connection)
