// Runs before every test file. Point the app's pool at the dedicated test
// database BEFORE any src module is imported (env is read at import time).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://fse:fse_dev_password@localhost:5432/production_dashboard_test';
process.env.MQTT_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';

export {};
