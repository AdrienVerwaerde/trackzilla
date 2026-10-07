import { evaluate } from './alerts.js';
import { createHub } from './hub.js';
import { connectBroker } from './mqtt.js';
import { createServer } from './server.js';
import { expireCommands, recordLedState, recordMeasurement, recordStatus } from './store.js';

const group = process.env.MQTT_GROUP;
const port = Number(process.env.PORT ?? 3000);

// The three pieces depend on each other in a circle: the HTTP server publishes
// through the broker, the broker pushes through the hub, and the hub rides on
// the HTTP server. The handlers below are function declarations, so they are
// hoisted and may name `hub` before this file finishes running — and no MQTT
// message can reach them until it does.
const broker = connectBroker({ onTelemetry, onStatus, onState });

// 0.0.0.0, not localhost: the phone reaches the laptop over the shared network.
const httpServer = createServer({ publishCommand: broker.publishCommand }).listen(
  port,
  '0.0.0.0',
  () => console.log(`[http] listening on http://0.0.0.0:${port}`)
);

const hub = createHub(httpServer);

/** How often unanswered commands are looked for. */
const CommandSweepMs = 5000;

// No box message ever says "I did not get it": only the clock can fail a
// command, so the app stops waiting on a LED that will never answer.
setInterval(() => {
  for (const failed of expireCommands()) {
    hub.broadcast('command_status', failed);
    console.log(`[cmd] ${failed.id} failed (no state from ${failed.device})`);
  }
}, CommandSweepMs);

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

/** The box reports what its LED really does: the only proof a command worked. */
function onState(device, data, { retained }) {
  if (typeof data?.led !== 'boolean') return console.warn('[store] bad state', device, data);

  const acked = recordLedState(device, data.led, { retained });
  console.log(`[state] ${device} led=${data.led}${retained ? ' (retained)' : ''}`);
  hub.broadcast('device_state', { device, led: data.led });

  if (acked) {
    hub.broadcast('command_status', acked);
    console.log(`[cmd] ${acked.id} acked`);
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
