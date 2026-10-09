export interface Summary {
  net_total: number;
  processed_events: number;
  pending_ack: number;
  unresolved: number;
  duplicates: number;
  conflicts: number;
}

export type ItemStatus = 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT' | 'PENDING_REFERENCE' | 'REJECTED';

export interface EventResult {
  event_id: string | null;
  status: ItemStatus;
  message: string;
}

export interface PendingEvent {
  event_id: string;
  source_id: string;
  event_type: 'COUNT' | 'VOID';
  quantity: number | null;
  target_event_id: string | null;
  event_time: string;
  status: string;
  received_at: string;
}

export interface ExceptionRow {
  kind: 'event' | 'attempt';
  event_id: string;
  source_id: string;
  classification: string;
  reason: string;
  received_at: string;
}

export type AckStatus = 'ACKED' | 'ALREADY_ACKED' | 'NOT_READY' | 'NOT_FOUND';
export interface AckResult {
  event_id: string;
  status: AckStatus;
  message: string;
}

export interface ProductionLine {
  source_id: string;
  display_name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface ChallengeRow {
  challenge_id: string;
  status: string;
  error_code: string | null;
  events: number;
  received_at: string;
  processed_at: string | null;
  response_ms: number | null;
}

export interface MqttStatus {
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
  recent_challenges: ChallengeRow[];
}

export interface TrendPoint {
  hour: string;
  count_total: number;
  void_total: number;
  net_total: number;
}
export interface LineStat {
  source_id: string;
  net_total: number;
  processed_events: number;
}
export interface Analytics {
  hours: number;
  trend: TrendPoint[];
  by_line: LineStat[];
}

export interface HealthState {
  backendConnected: boolean;
  mqttEnabled: boolean;
  mqttConnected: boolean;
}
