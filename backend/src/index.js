import { connectBroker } from './mqtt.js';
import { recordMeasurement, recordStatus } from './store.js';

const group = process.env.MQTT_GROUP;

connectBroker({
  onTelemetry: (device, data) => {
    const measurement = recordMeasurement(device, group, data);
    if (!measurement) return console.warn('[store] rejected', device, data);

    console.log(`[telemetry] ${device} t=${measurement.t} h=${measurement.h} ts=${measurement.ts}`);
  },

  onStatus: (device, status) => {
    const event = recordStatus(device, group, status);
    if (!event) return console.warn('[store] unknown status', device, status);

    console.log(`[status] ${device} ${event.status}`);
  },
});
