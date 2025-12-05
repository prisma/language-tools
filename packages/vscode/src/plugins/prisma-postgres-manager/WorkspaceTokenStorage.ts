import type { TokenStorage, Tokens } from '@prisma/management-api-sdk'
import type { CredentialsStore } from '@prisma/credentials-store'

/**
 * Implements the Management API SDK's TokenStorage interface for a specific workspace.
 * Wraps the CredentialsStore to persist tokens per workspace.
 */
export class WorkspaceTokenStorage implements TokenStorage {
  constructor(
    private readonly workspaceId: string,
    private readonly credentialsStore: CredentialsStore,
  ) {}

  async getTokens(): Promise<Tokens | null> {
    await this.credentialsStore.reloadCredentialsFromDisk()

    const credentials =
      (await this.credentialsStore.getCredentialsForWorkspace(this.workspaceId)) ||
      (await this.credentialsStore.getCredentialsForWorkspace(`wksp_${this.workspaceId}`))

    if (!credentials) return null

    return {
      accessToken: credentials.token,
      refreshToken: credentials.refreshToken,
    }
  }

  async setTokens(tokens: Tokens): Promise<void> {
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
 * A temporary token storage used during the auth flow before we know the workspace.
 * Stores tokens in memory, then they're moved to workspace-specific storage after login.
 */
export class PendingTokenStorage implements TokenStorage {
  private tokens: Tokens | null = null

  getTokens(): Promise<Tokens | null> {
    return Promise.resolve(this.tokens)
  }

  setTokens(tokens: Tokens): Promise<void> {
    this.tokens = tokens
    return Promise.resolve()
  }

  clearTokens(): Promise<void> {
    this.tokens = null
    return Promise.resolve()
  }

  /** Get the pending tokens and clear them */
  consumeTokens(): Tokens | null {
    const tokens = this.tokens
    this.tokens = null
    return tokens
  }
}
