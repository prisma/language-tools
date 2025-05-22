import type { SecretStorage } from 'vscode'
import z from 'zod'

const WorkspaceIdSchema = z.string()
const ProjectIdSchema = z.string()
const DatabaseIdSchema = z.string()

// Storing connection strings in this JSON structure under a single key in the secret storage.
// This allows for easy deletion of multiple entries when a project is deleted or the user logs out from a workspace.
const StoredConnectionStringsSchema = z.object({
  workspaces: z.record(
    WorkspaceIdSchema,
    z.object({
      projects: z.record(
        ProjectIdSchema,
        z.object({
          databases: z.record(
            DatabaseIdSchema,
            z.object({
              connectionString: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
})

type StoredConnectionStrings = z.infer<typeof StoredConnectionStringsSchema>

const STORED_CREDENTIALS_KEY = 'prisma-postgres.connection-strings'

export class ConnectionStringStorage {
  constructor(private readonly vscodeSecretStorage: SecretStorage) {}

  async storeConnectionString({
    workspaceId,
    projectId,
    databaseId,
    connectionString,
  }: {
    workspaceId: string
    projectId: string
    databaseId: string
    connectionString: string
  }): Promise<void> {
    const storage = await this.getStoredConnectionStrings()

    const updatedStorage: StoredConnectionStrings = {
      ...storage,
      workspaces: {
        ...storage.workspaces,
        [workspaceId]: {
          ...storage.workspaces[workspaceId],
          projects: {
            ...storage.workspaces[workspaceId]?.projects,
            [projectId]: {
              ...storage.workspaces[workspaceId]?.projects[projectId],
              databases: {
                ...storage.workspaces[workspaceId]?.projects[projectId]?.databases,
                [databaseId]: {
                  connectionString,
                },
              },
            },
          },
        },
      },
    }

    await this.storeConnectionStrings(updatedStorage)
  }

  async getConnectionString({
    workspaceId,
    projectId,
    databaseId,
  }: {
    workspaceId: string
    projectId: string
    databaseId: string
  }): Promise<string | undefined> {
    const storage = await this.getStoredConnectionStrings()
    return storage.workspaces[workspaceId]?.projects[projectId]?.databases[databaseId]?.connectionString
  }

  async removeConnectionString({
    workspaceId,
    projectId,
    databaseId,
  }: {
    workspaceId: string
    projectId?: string
    databaseId?: string
  }): Promise<void> {
    const storage = await this.getStoredConnectionStrings()

    if (databaseId && projectId) {
      delete storage.workspaces[workspaceId].projects[projectId].databases[databaseId]
    } else if (databaseId && !projectId) {
      throw new Error('When databaseId is provided, projectId is required')
    } else if (projectId) {
      delete storage.workspaces[workspaceId].projects[projectId]
    } else {
      delete storage.workspaces[workspaceId]
    }

    await this.storeConnectionStrings(storage)
  }

  private async storeConnectionStrings(connectionStrings: StoredConnectionStrings): Promise<void> {
    await this.vscodeSecretStorage.store(STORED_CREDENTIALS_KEY, JSON.stringify(connectionStrings))
  }

  private async getStoredConnectionStrings(): Promise<StoredConnectionStrings> {
    try {
      const storedCredentials = await this.vscodeSecretStorage.get(STORED_CREDENTIALS_KEY)
      return StoredConnectionStringsSchema.parse(JSON.parse(storedCredentials || '{ "workspaces": {} }'))
    } catch (error) {
      console.error('Error getting stored connection strings', error)
      return { workspaces: {} }
    }
  }
}
