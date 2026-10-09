import { EventEmitter } from 'node:events';

/**
 * Tiny in-process notification bus. Modules publish lifecycle facts
 * (EVENT_ACCEPTED, VOID_RESOLVED, EVENT_ACKNOWLEDGED, ...) only AFTER their
 * database transaction has committed, mirroring how a future message broker
 * would be introduced when a module is extracted into its own service.
 */
export type DomainEventType =
  | 'EVENT_ACCEPTED'
  | 'VOID_RESOLVED'
  | 'VOID_PENDING'
  | 'EVENT_REJECTED'
  | 'EVENT_DUPLICATE'
  | 'EVENT_CONFLICT'
  | 'EVENT_ACKNOWLEDGED'
  | 'MQTT_CHALLENGE_COMPLETED'
  | 'MQTT_CHALLENGE_FAILED';

export const domainEvents = new EventEmitter();
domainEvents.setMaxListeners(50);

export function emitDomainEvent(type: DomainEventType, payload: Record<string, unknown>): void {
  // Never let a listener failure break the request path.
  try {
    domainEvents.emit(type, payload);
  } catch {
    /* ignore */
  }
}
