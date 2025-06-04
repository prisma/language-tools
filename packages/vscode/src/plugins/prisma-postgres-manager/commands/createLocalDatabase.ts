import { window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function createLocalDatabase(ppgRepository: PrismaPostgresRepository) {
  const name = await window.showInputBox({
    prompt: 'Enter your local database name',
    placeHolder: 'e.g., MyAwesomeProject',
    value: 'default',
  })

  await ppgRepository.createLocalDatabase({ name: name ?? 'default' })
}
