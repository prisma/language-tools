import { env, window } from "vscode";
import z from "zod";

const CopyLocalDatabaseUrlArgsSchema = z.object({
  url: z.string()
})

export type CopyLocalDatabaseUrlArgs = z.infer<typeof CopyLocalDatabaseUrlArgsSchema>

export async function copyLocalDatabaseUrl(args: unknown) {
  const item = CopyLocalDatabaseUrlArgsSchema.parse(args)

  if (item && typeof item === "object" && typeof item.url === "string") {
    await env.clipboard.writeText(item.url);
    window.showInformationMessage(`Ppg Dev URL copied to your clipboard!`);
  } else {
    window.showErrorMessage('Failed to copy item name.');
  }
}