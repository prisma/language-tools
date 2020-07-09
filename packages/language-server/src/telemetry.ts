import { IConnection } from 'vscode-languageserver'

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

let connection: IConnection

export const initializeTelemetry = (serverConnection: IConnection) => {
  connection = serverConnection
}

export const sendTelemetry = (payload: TelemetryPayload) => {
  if (connection) {
    connection.sendNotification('prisma/telemetry', payload)
  }
}

export const sendException = (
  signature: string,
  error: Error,
  message = '',
) => {
  if (connection) {
    connection.sendNotification('prisma/telemetryException', {
      signature: signature,
      message: `${message}: ${error.message}`,
      stack: error.stack,
    })
  }
}
