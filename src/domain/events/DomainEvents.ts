export type DomainEventName =
  | 'CitizenIdentityOnboarded'
  | 'BiometricLivenessVerified'
  | 'ZkProofEvaluated'
  | 'QualifiedSealIssued'
  | 'CorridorPassGranted'
  | 'CorridorPassDenied'
  | 'FederationCredentialExchanged'
  | 'IcaoPassportVerified'
  | 'IcaoPassportChallenged';

export interface IDomainEvent<T = unknown> {
  eventId: string;
  eventName: DomainEventName;
  aggregateId: string;
  occurredOn: string;
  payload: T;
}

export class DomainEventBus {
  private static handlers: Map<DomainEventName, Array<(event: IDomainEvent) => void | Promise<void>>> = new Map();

  public static subscribe<T>(eventName: DomainEventName, handler: (event: IDomainEvent<T>) => void | Promise<void>): void {
    const list = this.handlers.get(eventName) || [];
    list.push(handler as (event: IDomainEvent) => void | Promise<void>);
    this.handlers.set(eventName, list);
  }

  public static async publish<T>(event: IDomainEvent<T>): Promise<void> {
    const list = this.handlers.get(event.eventName) || [];
    for (const handler of list) {
      await handler(event);
    }
  }

  public static clear(): void {
    this.handlers.clear();
  }
}
