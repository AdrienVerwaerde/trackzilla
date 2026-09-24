import { WebSocketServer } from 'ws';

import { listDevices } from './store.js';

/** How often silent devices are looked for. */
const SweepIntervalMs = 5000;

/**
 * Broadcasts backend events to every connected app, and watches for devices
 * that went quiet.
 *
 * It attaches to the HTTP server rather than opening a second one: the app
 * then needs a single host and port, and the firewall a single hole.
 */
export function createHub(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  const frameFor = (type, payload) => JSON.stringify({ type, ...payload });

  /** A WebSocket has no channels: the type travels inside the frame. */
  function broadcast(type, payload) {
    const frame = frameFor(type, payload);

    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(frame);
    }
  }

  wss.on('connection', (socket) => {
    console.log(`[ws] client connected (${wss.clients.size} total)`);

    // Statuses are only pushed when they change, and a change that happened
    // before this client arrived is a change it never saw. Without this
    // snapshot the app would sit blank until the next transition.
    for (const device of listDevices()) {
      socket.send(frameFor('device_status', { device: device.id, status: device.status }));
    }

    socket.on('close', () => console.log(`[ws] client gone (${wss.clients.size} left)`));
  });

  // `listDevices` already turns silence into `offline`. Comparing its verdict
  // to what was last announced turns a passive rule into a pushed event, which
  // is what makes the indicator flip on its own when the box is unplugged.
  const announced = new Map();

  const sweep = setInterval(() => {
    for (const device of listDevices()) {
      if (announced.get(device.id) === device.status) continue;

      announced.set(device.id, device.status);
      broadcast('device_status', { device: device.id, status: device.status });
      console.log(`[ws] ${device.id} is now ${device.status}`);
    }
  }, SweepIntervalMs);

  // Without this the timer keeps the process alive after the server closes.
  sweep.unref();

  return { broadcast };
}
