import * as crypto from 'crypto'
import { Uri, env } from 'vscode'

const CLIENT_ID = 'cmamnw2go00005812nlbzb4pi'
const LOGIN_URL = 'https://auth.prisma.io/authorize'
const TOKEN_URL = 'https://auth.prisma.io/token'

export type AuthResult = {
  token: string
  refreshToken: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class Auth {
  private latestVerifier?: string
  private latestState?: string

  constructor(private readonly extensionId: string) {}

  async login() {
    this.latestState = this.generateState()
    this.latestVerifier = this.generateVerifier()
    const challenge = this.generateChallenge(this.latestVerifier)

    const authUrl = new URL(LOGIN_URL)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri())
    authUrl.searchParams.set('scope', 'workspace:admin offline_access')
    authUrl.searchParams.set('state', this.latestState)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    await env.openExternal(Uri.parse(authUrl.toString()))
  }

  async handleCallback(uri: Uri): Promise<AuthResult | null> {
    console.log('handleCallback', uri)

    if (uri.path !== '/auth/callback') return null

    const params = new URLSearchParams(uri.query)

    const error = params.get('error')
    if (error) throw new AuthError(error)

    const code = params.get('code')
    const state = params.get('state')
    if (!code) throw new AuthError('No code found in callback')
    if (!this.latestVerifier) throw new AuthError('No verifier found')
    if (state !== this.latestState) throw new AuthError('Invalid state')

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: this.latestVerifier,
    })
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    })

    return this.parseTokenResponse(response)
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    })
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    })

    const result = await this.parseTokenResponse(response)

    return result
  }

  private async parseTokenResponse(response: Response): Promise<AuthResult> {
    const data = await response.json()

    if (response.status !== 200) throw new AuthError(`Failed to get token. Status code ${response.status}.`)
    if (
      !data ||
      typeof data !== 'object' ||
      !('access_token' in data) ||
      !data.access_token ||
      typeof data.access_token !== 'string'
    ) {
      throw new AuthError('No access token received in token endpoint response.')
    }
    if (!('refresh_token' in data) || !data.refresh_token || typeof data.refresh_token !== 'string') {
      throw new AuthError('No refresh token received in token endpoint response.')
    }

    return { token: data.access_token, refreshToken: data.refresh_token }
  }

  private getRedirectUri(): string {
    return `${env.uriScheme}://${this.extensionId.toLowerCase()}/auth/callback`
  }

  private base64urlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  private generateState(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  private generateVerifier(): string {
    return this.base64urlEncode(crypto.randomBytes(32))
  }

  private generateChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return this.base64urlEncode(hash)
  }
}
