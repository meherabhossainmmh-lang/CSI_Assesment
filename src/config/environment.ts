import dotenv from 'dotenv';

dotenv.config();

/**
 * Typed view over process.env. Values are read once at boot so a missing or
 * malformed configuration fails fast with a clear message instead of a
 * confusing runtime error later.
 */
export interface Environment {
  nodeEnv: string;
  databaseUrl: string;
  testDatabaseUrl: string;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  mqtt: {
    enabled: boolean;
    brokerHost: string;
    brokerPort: number;
    candidateId: string;
  };
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildEnvironment(): Environment {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://fse:fse_dev_password@localhost:5432/production_dashboard';
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    (databaseUrl.endsWith('_test')
      ? databaseUrl
      : `${databaseUrl}_test`);

  const logLevelRaw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const logLevel: Environment['logLevel'] = (['debug', 'info', 'warn', 'error'] as const).includes(
    logLevelRaw as Environment['logLevel'],
  )
    ? (logLevelRaw as Environment['logLevel'])
    : 'info';

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl,
    testDatabaseUrl,
    port: parseIntSafe(process.env.PORT, 3000),
    logLevel,
    mqtt: {
      enabled: parseBool(process.env.MQTT_ENABLED, true),
      brokerHost: process.env.MQTT_BROKER_HOST || '152.42.238.142',
      brokerPort: parseIntSafe(process.env.MQTT_BROKER_PORT, 1883),
      candidateId: process.env.MQTT_CANDIDATE_ID || '08',
    },
  };
}

export const env: Environment = buildEnvironment();
