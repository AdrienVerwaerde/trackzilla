import { evaluate } from './alerts.js';
import { connectBroker } from './mqtt.js';
import { createServer } from './server.js';
import { recordMeasurement, recordStatus } from './store.js';

const group = process.env.MQTT_GROUP;
const port = Number(process.env.PORT ?? 3000);

const broker = connectBroker({
  onTelemetry: (device, data) => {
    const measurement = recordMeasurement(device, group, data);
    if (!measurement) return console.warn('[store] rejected', device, data);

    console.log(`[telemetry] ${device} t=${measurement.t} h=${measurement.h} ts=${measurement.ts}`);

    for (const event of evaluate(measurement)) {
      const detail = event.type === 'alert' ? ` ${event.value} vs ${event.threshold}` : '';
      console.log(`[${event.type}] ${device} ${event.kind}${detail}`);
    }
  },

  onStatus: (device, status, { retained }) => {
    const event = recordStatus(device, group, status, { retained });
    if (!event) return console.warn('[store] unknown status', device, status);

    if (event.changed) console.log(`[status] ${device} ${event.status}`);
  },
});

// 0.0.0.0, not localhost: the phone reaches the laptop over the shared network.
createServer({ publishCommand: broker.publishCommand }).listen(port, '0.0.0.0', () => {
  console.log(`[http] listening on http://0.0.0.0:${port}`);
});
