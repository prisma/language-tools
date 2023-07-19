import { check } from 'checkpoint-client'
import { Disposable, workspace } from 'vscode'
import { getProjectHash } from './hashes'

export default class TelemetryReporter {
  private userOptIn = false
  private readonly configListener: Disposable

  private static TELEMETRY_CONFIG_ID = 'telemetry'
  // Deprecated since https://code.visualstudio.com/updates/v1_61#_telemetry-settings
  private static TELEMETRY_CONFIG_ENABLED_ID_DEPRECATED = 'enableTelemetry'
  // It is replaced by `telemetryLevel`
  // https://code.visualstudio.com/docs/getstarted/telemetry
  private static TELEMETRY_CONFIG_LEVEL_ID = 'telemetryLevel'

  constructor(
    private extensionId: string,
    private extensionVersion: string,
  ) {
    this.updateUserOptIn()
    this.configListener = workspace.onDidChangeConfiguration(() => this.updateUserOptIn())
  }

  public async sendTelemetryEvent(): Promise<void> {
    if (this.userOptIn) {
      await check({
        product: this.extensionId,
        version: this.extensionVersion,
        project_hash: await getProjectHash(),
      })
    }
  }

  private updateUserOptIn() {
    const telemetryConfig = workspace.getConfiguration(TelemetryReporter.TELEMETRY_CONFIG_ID)
    // Deprecated since https://code.visualstudio.com/updates/v1_61#_telemetry-settings
    const isTelemetryEnabled = telemetryConfig.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID_DEPRECATED)
    const telemetryLevel = telemetryConfig.get<string>(TelemetryReporter.TELEMETRY_CONFIG_LEVEL_ID)

    if (isTelemetryEnabled && telemetryLevel === 'all') {
      this.userOptIn = true
      console.info('Telemetry is enabled for Prisma extension')
    } else {
      this.userOptIn = false
      console.info('Telemetry is disabled for Prisma extension')
    }
  }

  public dispose(): void {
    this.configListener.dispose()
  }
}
