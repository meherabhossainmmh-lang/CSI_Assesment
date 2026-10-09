import { createApp } from './app';
import { env } from './config/environment';
import { pool, closePool } from './config/database';
import { runMigrations } from './config/migrate';
import { startMqttClient, type MqttHandle } from './modules/mqtt/mqtt.client';
import { initAuditLogging } from './modules/audit/audit.service';

async function main() {
  initAuditLogging();

  // Ensure schema exists at boot so a fresh checkout just runs.
  const applied = await runMigrations(pool);
  if (applied.length > 0) console.log('[server] applied migrations:', applied.join(', '));

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[server] REST API listening on http://0.0.0.0:${env.port}`);
  });

  let mqtt: MqttHandle | null = null;
  if (env.mqtt.enabled) {
    mqtt = startMqttClient(pool);
  } else {
    console.log('[server] MQTT disabled via MQTT_ENABLED=false');
  }

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received; shutting down`);
    server.close(async () => {
      if (mqtt) await mqtt.stop();
      await closePool();
      process.exit(0);
    });
    // Hard-stop safety net.
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
