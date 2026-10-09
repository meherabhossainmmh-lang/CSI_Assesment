import { domainEvents, type DomainEventType } from '../../shared/domainEvents';

const ALL: DomainEventType[] = [
  'EVENT_ACCEPTED',
  'VOID_RESOLVED',
  'VOID_PENDING',
  'EVENT_REJECTED',
  'EVENT_DUPLICATE',
  'EVENT_CONFLICT',
  'EVENT_ACKNOWLEDGED',
  'MQTT_CHALLENGE_COMPLETED',
  'MQTT_CHALLENGE_FAILED',
];

/**
 * Durable history lives in submission_attempts / mqtt_challenges; this service
 * adds an observable audit stream (console) driven by post-commit domain
 * events, standing in for a future audit sink or broker consumer.
 */
export function initAuditLogging(): void {
  for (const type of ALL) {
    domainEvents.on(type, (payload) => {
      console.info(`[audit] ${type}`, JSON.stringify(payload));
    });
  }
}
