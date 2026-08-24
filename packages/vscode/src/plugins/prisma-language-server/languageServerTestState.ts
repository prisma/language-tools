import type { DocumentOwnershipTestEvent } from './documentOwnership'
import type { DocumentRoutingEvent } from './documentRouting'
import type { LocalPrismaNextClientTestState } from './localPrismaNextClientRegistry'

export const languageServerTestStateCommand = 'prisma.test.languageServerRoutingState'

export interface LanguageServerTestState {
  readonly workspaceTrusted: boolean
  readonly localClients: LocalPrismaNextClientTestState
  readonly ownershipEvents: readonly DocumentOwnershipTestEvent[]
  readonly routingEvents: readonly DocumentRoutingEvent[]
}

export class LanguageServerTestStateCollector {
  private readonly ownershipEvents: DocumentOwnershipTestEvent[] = []
  private readonly routingEvents: DocumentRoutingEvent[] = []

  readonly observeOwnership = (event: DocumentOwnershipTestEvent): void => {
    this.ownershipEvents.push(event)
  }

  readonly observeRouting = (event: DocumentRoutingEvent): void => {
    this.routingEvents.push(event)
  }

  snapshot(workspaceTrusted: boolean, localClients: LocalPrismaNextClientTestState): LanguageServerTestState {
    return {
      workspaceTrusted,
      localClients,
      ownershipEvents: [...this.ownershipEvents],
      routingEvents: [...this.routingEvents],
    }
  }
}
