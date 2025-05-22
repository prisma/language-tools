import { ThemeIcon, window } from 'vscode'
import type { Region } from '../PrismaPostgresRepository'
import { CommandAbortError } from './handleCommandError'

export const pickRegion = async (regions: Region[]): Promise<Region> => {
  const items = regions.map((r) => ({ region: r, label: `${r.name} (${r.id})`, iconPath: new ThemeIcon('globe') }))
  const selectedItem = await window.showQuickPick(items, {
    placeHolder: 'Select the region for the database in this new project',
  })
  if (!selectedItem) throw new CommandAbortError('Region is required')
  return selectedItem.region
}
