import { env, window } from 'vscode'
import z from 'zod'

const CopyLocalDatabaseUrlArgsSchema = z.object({
  url: z.string(),
})

export type CopyLocalDatabaseUrlArgs = z.infer<typeof CopyLocalDatabaseUrlArgsSchema>

export async function copyLocalDatabaseUrl(args: unknown) {
  const item = CopyLocalDatabaseUrlArgsSchema.parse(args)

  await env.clipboard.writeText(item.url)

  void window.showInformationMessage(`PPg Dev URL copied to your clipboard!`)
}

export async function copyLocalDatabaseUrlSafely(args: CopyLocalDatabaseUrlArgs) {
  return copyLocalDatabaseUrl(args)
}
