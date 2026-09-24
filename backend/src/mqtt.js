import mqtt from 'mqtt';

const { MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, MQTT_GROUP } = process.env;

/** Topics are `sentinelle/<group>/<device>/<channel>`. */
function parseTopic(topic) {
  const [, , device, channel] = topic.split('/');
  return { device, channel };
}

export function connectBroker({ onTelemetry, onStatus }) {
  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    // Two clients sharing an id kick each other off in a loop.
    clientId: `trackzilla-backend-${Math.random().toString(16).slice(2, 8)}`,
  });

  // Subscribing must wait for the connection: connect() returns before it is
  // established. on('connect') fires again after a drop, so the subscription
  // is restored on its own.
  client.on('connect', () => {
    const topics = [
      `sentinelle/${MQTT_GROUP}/+/telemetry`,
      `sentinelle/${MQTT_GROUP}/+/status`,
    ];

    client.subscribe(topics, (error) => {
      if (error) return console.error('[mqtt] subscribe failed', error);
      console.log(`[mqtt] connected, listening on ${topics.join(', ')}`);
    });
  });

  client.on('message', (topic, payload, packet) => {
    const { device, channel } = parseTopic(topic);
    const raw = payload.toString();

    // The broker replays its retained message to every new subscriber. For a
    // status that is the current known state, worth keeping; for a reading it
    // is an old one, and storing it again duplicates the row on each restart.
    if (channel === 'telemetry' && packet.retain) {
      return console.log(`[mqtt] ignoring retained reading for ${device}`);
    }

    if (channel === 'status') return onStatus(device, raw);

    // A malformed payload must never bring the server down.
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return console.warn(`[mqtt] unreadable payload on ${topic}: ${raw}`);
    }

    if (channel === 'telemetry') onTelemetry(device, data);
  });

  client.on('error', (error) => console.error('[mqtt]', error.message));
  client.on('reconnect', () => console.log('[mqtt] reconnecting...'));

  return client;
}
