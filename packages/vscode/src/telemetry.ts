import TelemetryReporter from 'vscode-extension-telemetry'
import * as checkpoint from 'checkpoint-client'

export class Telemetry {
  private readonly key: string = 'fe968a4a-7cbf-4c43-bf6e-3e968f3c4519'
  public reporter: TelemetryReporter

  constructor(extensionId: string, extensionVersion: string) {
    this.reporter = new TelemetryReporter(
      extensionId,
      extensionVersion,
      this.key,
    )
  }

  public getSignature(): Promise<string> {
    return checkpoint.getSignature()
  }

  public sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ) {
    this.reporter.sendTelemetryEvent(eventName, properties, measurements)
  }

  public sendError(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
    errorProps?: string[],
  ) {
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
  ) {
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
