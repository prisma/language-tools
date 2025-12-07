import type { TokenStorage, Tokens } from '@prisma/management-api-sdk'
import type { CredentialsStore } from '@prisma/credentials-store'

/**
 * Implements the Management API SDK's TokenStorage interface.
 * Wraps the CredentialsStore to persist tokens per workspace.
 * The workspace ID is derived from the tokens themselves (extracted from the JWT by the SDK).
 */
export class WorkspaceTokenStorage implements TokenStorage {
  private workspaceId: string

  constructor(
    initialWorkspaceId: string,
    private readonly credentialsStore: CredentialsStore,
  ) {
    this.workspaceId = initialWorkspaceId
  }

  async getTokens(): Promise<Tokens | null> {
    await this.credentialsStore.reloadCredentialsFromDisk()

    const credentials =
      (await this.credentialsStore.getCredentialsForWorkspace(this.workspaceId)) ||
      (await this.credentialsStore.getCredentialsForWorkspace(`wksp_${this.workspaceId}`))

    if (!credentials) return null

    return {
      accessToken: credentials.token,
      refreshToken: credentials.refreshToken,
      workspaceId: this.workspaceId,
    }
  }

  async setTokens(tokens: Tokens): Promise<void> {
    // Use workspace ID from the token (source of truth from JWT)
    this.workspaceId = stripResourceIdentifierPrefix(tokens.workspaceId)

    await this.credentialsStore.storeCredentials({
      workspaceId: this.workspaceId,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  }

  async clearTokens(): Promise<void> {
    await this.credentialsStore.deleteCredentials(this.workspaceId)
    await this.credentialsStore.deleteCredentials(`wksp_${this.workspaceId}`)
  }
}

/**
 * Strips resource identifier prefixes (e.g., `wksp_`, `proj_`, `db_`) from IDs.
 * Management API returns resource identifiers with prefixes like `proj_<id>` for projects, `db_<id>` for databases, etc.
 * This normalizes them to plain IDs as used in the PDP Console URLs.
 */
export function stripResourceIdentifierPrefix(identifier: string): string {
  return identifier.includes('_') ? identifier.slice(identifier.indexOf('_') + 1) : identifier
}
