import { connectBroker } from './mqtt.js';

connectBroker({
  onTelemetry: (device, data) => console.log('[telemetry]', device, data),
  onStatus: (device, status) => console.log('[status]', device, status),
});
