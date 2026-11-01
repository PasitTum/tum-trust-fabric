/**
 * TUM National Trust Fabric — Corridor Event Publisher
 * Emits cross-fleet events when passengers/citizens clear border corridors
 */

export interface CorridorClearanceDispatchEvent {
  readonly eventId: string;
  readonly topic: 'TRUST_FABRIC_CITIZEN_CLEARED';
  readonly sourceRepo: 'tum-trust-fabric';
  readonly timestamp: string;
  readonly payload: {
    readonly passId: string;
    readonly travelerDid: string;
    readonly nationality: string;
    readonly corridorId: string;
    readonly clearanceStatus: 'CLEARED' | 'CHALLENGE_REQUIRED' | 'INTERCEPT_DETAIN';
    readonly biometricMatchScore: number;
    readonly isForeignNational: boolean;
  };
}

export class CorridorEventPublisher {
  private events: CorridorClearanceDispatchEvent[] = [];

  public createClearanceEvent(
    passId: string,
    travelerDid: string,
    nationality: string,
    corridorId: string,
    clearanceStatus: 'CLEARED' | 'CHALLENGE_REQUIRED' | 'INTERCEPT_DETAIN',
    biometricMatchScore: number
  ): CorridorClearanceDispatchEvent {
    const isForeignNational = !nationality.toUpperCase().includes('THA') && nationality !== 'TH';

    const event: CorridorClearanceDispatchEvent = {
      eventId: `FABRIC-EVT-${passId}`,
      topic: 'TRUST_FABRIC_CITIZEN_CLEARED',
      sourceRepo: 'tum-trust-fabric',
      timestamp: new Date().toISOString(),
      payload: {
        passId,
        travelerDid,
        nationality,
        corridorId,
        clearanceStatus,
        biometricMatchScore,
        isForeignNational
      }
    };

    this.events.push(event);
    return event;
  }

  public getEvents(): readonly CorridorClearanceDispatchEvent[] {
    return [...this.events];
  }
}
