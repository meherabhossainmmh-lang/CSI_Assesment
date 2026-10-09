import mqtt, { MqttClient } from 'mqtt';
import type { Pool } from 'pg';
import { env } from '../../config/environment';
import { handleChallenge } from './mqtt.service';
import { setMqttRuntimeStatus } from './mqtt.status';

export interface MqttHandle {
  stop: () => Promise<void>;
  client: MqttClient;
}

const HEARTBEAT_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 15_000;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Outbound MQTT worker. Subscribes to this candidate's challenge topic, runs
 * every challenge through the shared event service, and publishes matching
 * responses plus ONLINE/HEARTBEAT/OFFLINE status. Reconnects with exponential
 * backoff and resubscribes on every new connection.
 */
export function startMqttClient(pool: Pool): MqttHandle {
  const { brokerHost, brokerPort, candidateId } = env.mqtt;
  const clientId = `fse01-${candidateId}-${randomSuffix()}`;
  setMqttRuntimeStatus({ client_id: clientId, enabled: true });

  const challengeTopic = `fse-01/${candidateId}/challenge`;
  const responseTopic = `fse-01/${candidateId}/response`;
  const statusTopic = `fse-01/${candidateId}/status`;

  let attempt = 0;
  let heartbeat: NodeJS.Timeout | null = null;
  let stopped = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const client = mqtt.connect({
    host: brokerHost,
    port: brokerPort,
    protocol: 'mqtt',
    protocolVersion: 4, // MQTT 3.1.1
    clientId,
    reconnectPeriod: 0, // we drive reconnection with explicit backoff
    connectTimeout: 5_000,
    will: {
      topic: statusTopic,
      payload: JSON.stringify({ status: 'OFFLINE', candidate_id: candidateId, client_id: clientId, at: new Date().toISOString() }),
      qos: 1,
      retain: false,
    },
  });

  function publishStatus(status: string) {
    const payload = JSON.stringify({
      status,
      candidate_id: candidateId,
      client_id: clientId,
      at: new Date().toISOString(),
    });
    client.publish(statusTopic, payload, { qos: 1, retain: false }, (err) => {
      if (err) console.error('[mqtt] status publish failed:', err.message);
    });
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    setMqttRuntimeStatus({ reconnect_attempts: attempt });
    console.warn(`[mqtt] disconnected; reconnecting in ${delay}ms (attempt ${attempt})`);
    reconnectTimer = setTimeout(() => client.reconnect(), delay);
  }

  client.on('connect', () => {
    attempt = 0;
    setMqttRuntimeStatus({
      connected: true,
      last_connected_at: new Date().toISOString(),
      reconnect_attempts: 0,
    });
    console.log(`[mqtt] connected to ${brokerHost}:${brokerPort} as ${clientId}`);
    client.subscribe(challengeTopic, { qos: 1 }, (err) => {
      if (err) {
        console.error('[mqtt] subscribe failed:', err.message);
        return;
      }
      console.log(`[mqtt] subscribed to ${challengeTopic}`);
      publishStatus('ONLINE'); // after successful subscription
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(() => {
        publishStatus('HEARTBEAT');
        setMqttRuntimeStatus({ last_heartbeat_at: new Date().toISOString() });
      }, HEARTBEAT_MS);
    });
  });

  client.on('message', async (topic, payload) => {
    if (topic !== challengeTopic) return;
    let raw: unknown;
    try {
      raw = JSON.parse(payload.toString());
    } catch {
      raw = null;
    }
    try {
      const response = await handleChallenge(pool, raw, candidateId);
      setMqttRuntimeStatus({
        last_challenge_id: (response as any).challenge_id ?? null,
        last_challenge_status: (response as any).status ?? null,
        last_response_at: new Date().toISOString(),
      });
      client.publish(responseTopic, JSON.stringify(response), { qos: 1, retain: false }, (err) => {
        if (err) console.error('[mqtt] response publish failed:', err.message);
        else console.log(`[mqtt] published response for challenge`, (response as any).challenge_id);
      });
    } catch (err) {
      console.error('[mqtt] challenge handler error:', err);
    }
  });

  client.on('error', (err) => console.error('[mqtt] client error:', err.message));
  client.on('close', () => {
    setMqttRuntimeStatus({ connected: false, last_disconnected_at: new Date().toISOString() });
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    scheduleReconnect();
  });
  client.on('offline', () => console.warn('[mqtt] client offline'));

  return {
    client,
    stop: async () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeat) clearInterval(heartbeat);
      publishStatus('OFFLINE');
      await new Promise<void>((resolve) => client.end(false, {}, () => resolve()));
    },
  };
}
