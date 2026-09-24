import { evaluate } from './alerts.js';
import { createHub } from './hub.js';
import { connectBroker } from './mqtt.js';
import { createServer } from './server.js';
import { recordMeasurement, recordStatus } from './store.js';

const group = process.env.MQTT_GROUP;
const port = Number(process.env.PORT ?? 3000);

// The three pieces depend on each other in a circle: the HTTP server publishes
// through the broker, the broker pushes through the hub, and the hub rides on
// the HTTP server. The handlers below are function declarations, so they are
// hoisted and may name `hub` before this file finishes running — and no MQTT
// message can reach them until it does.
const broker = connectBroker({ onTelemetry, onStatus });

// 0.0.0.0, not localhost: the phone reaches the laptop over the shared network.
const httpServer = createServer({ publishCommand: broker.publishCommand }).listen(
  port,
  '0.0.0.0',
  () => console.log(`[http] listening on http://0.0.0.0:${port}`)
);

const hub = createHub(httpServer);

function onTelemetry(device, data) {
  const measurement = recordMeasurement(device, group, data);
  if (!measurement) return console.warn('[store] rejected', device, data);

  console.log(`[telemetry] ${device} t=${measurement.t} h=${measurement.h} ts=${measurement.ts}`);
  hub.broadcast('measurement', measurement);

  for (const { type, ...payload } of evaluate(measurement)) {
    hub.broadcast(type, payload);
    console.log(`[${type}] ${device} ${payload.kind}`);
  }
}

function onStatus(device, status, { retained }) {
  const event = recordStatus(device, group, status, { retained });
  if (!event) return console.warn('[store] unknown status', device, status);

  // The hub's sweep is what announces the change on the socket: routing every
  // status through one place keeps a declared state and an observed silence
  // from contradicting each other.
  if (event.changed) console.log(`[status] ${device} ${event.status}`);
}
