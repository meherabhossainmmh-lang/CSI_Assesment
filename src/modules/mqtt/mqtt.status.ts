import { env } from '../../config/environment';

/**
 * In-memory view of the MQTT worker's runtime health. The durable challenge
 * history lives in PostgreSQL (mqtt_challenges); this store only tracks
 * connection-level facts that vanish with the process. Exposed read-only via
 * GET /api/mqtt/status. Never contains credentials.
 */
export interface MqttRuntimeStatus {
  enabled: boolean;
  connected: boolean;
  broker_host: string;
  broker_port: number;
  candidate_id: string;
  client_id: string | null;
  protocol_version: string;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  last_heartbeat_at: string | null;
  last_challenge_id: string | null;
  last_challenge_status: string | null;
  last_response_at: string | null;
  reconnect_attempts: number;
}

const status: MqttRuntimeStatus = {
  enabled: env.mqtt.enabled,
  connected: false,
  broker_host: env.mqtt.brokerHost,
  broker_port: env.mqtt.brokerPort,
  candidate_id: env.mqtt.candidateId,
  client_id: null,
  protocol_version: 'MQTT 3.1.1',
  last_connected_at: null,
  last_disconnected_at: null,
  last_heartbeat_at: null,
  last_challenge_id: null,
  last_challenge_status: null,
  last_response_at: null,
  reconnect_attempts: 0,
};

export function getMqttRuntimeStatus(): MqttRuntimeStatus {
  return { ...status };
}

export function setMqttRuntimeStatus(patch: Partial<MqttRuntimeStatus>): void {
  Object.assign(status, patch);
}
