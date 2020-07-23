import TelemetryReporter from 'vscode-extension-telemetry'
import { getSignature } from 'checkpoint-client'

export class Telemetry {
  private readonly insiderKey: string = 'fe968a4a-7cbf-4c43-bf6e-3e968f3c4519'
  private readonly stableKey: string = '91c49d99-7e49-4fcd-92b7-dda955c77fcb'
  public reporter: TelemetryReporter

  constructor(extensionId: string, extensionVersion: string) {
    this.reporter = new TelemetryReporter(
      extensionId,
      extensionVersion,
      extensionId === 'prisma.prisma' ? this.stableKey : this.insiderKey,
    )
  }

  public getSignature(): Promise<string> {
    return getSignature()
  }

  public sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    this.reporter.sendTelemetryEvent(eventName, properties, measurements)
  }

  public sendError(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
    errorProps?: string[],
  ): void {
    this.reporter.sendTelemetryErrorEvent(
      eventName,
      properties,
      measurements,
      errorProps,
    )
  }

  public sendException(
    error: Error,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    this.reporter.sendTelemetryException(error, properties, measurements)
  }
}

export interface TelemetryPayload {
  action: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: { [key: string]: any }
}

export interface ExceptionPayload {
  signature: string
  message: string
  stack: string
}
