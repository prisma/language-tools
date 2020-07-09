import TelemetryReporter from 'vscode-extension-telemetry'

export class Telemetry {
  private readonly key: string = ''
  public reporter: TelemetryReporter

  constructor(extensionId: string, extensionVersion: string) {
    this.reporter = new TelemetryReporter(
      extensionId,
      extensionVersion,
      this.key,
    )
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
