import db from './db.js';
import { nowSeconds } from './store.js';

const ExpoPushUrl = 'https://exp.host/--/api/v2/push/send';

/** Must match the channel the app creates, or Android drops the notification. */
const AndroidChannelId = 'alerts';

/** What Expo hands out: `ExponentPushToken[…]` (older SDKs: `ExpoPushToken[…]`). */
const TokenPattern = /^Expo(nent)?PushToken\[[\w-]+\]$/;

db.exec(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    token      TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`);

const statements = {
  // Registering twice is the normal case (every launch with alerts on): the
  // primary key turns it into a no-op instead of a duplicate notification.
  add: db.prepare(`INSERT OR IGNORE INTO push_tokens (token, created_at) VALUES (:token, :now)`),
  remove: db.prepare(`DELETE FROM push_tokens WHERE token = :token`),
  all: db.prepare(`SELECT token FROM push_tokens`),
};

export const isPushToken = (value) => typeof value === 'string' && TokenPattern.test(value);

export function addPushToken(token) {
  statements.add.run({ token, now: nowSeconds() });
}

export function removePushToken(token) {
  statements.remove.run({ token });
}

const Units = { tMin: '°C', tMax: '°C', hMin: '%', hMax: '%' };
const Labels = { tMin: 'Min-Temp', tMax: 'Max-Temp', hMin: 'Min-Hum', hMax: 'Max-Hum' };

/** Comma as the decimal separator, one decimal, like the app: "30,5". */
const format = (value) => value.toFixed(1).replace('.', ',');

/**
 * Sends one push per registered phone. Called on `alert` only: the backend
 * raises it once per breach, after `holdMinutes`, so this is never once per
 * reading. Never throws: a push failing must not stop readings being stored.
 */
export async function sendAlertPush({ device, kind, value, threshold }) {
  const tokens = statements.all.all().map((row) => row.token);
  if (tokens.length === 0) return;

  const unit = Units[kind];
  const messages = tokens.map((to) => ({
    to,
    title: `Alerte ${Labels[kind]} · ${device}`,
    body: `${format(value)} ${unit} (seuil ${format(threshold)} ${unit})`,
    channelId: AndroidChannelId,
    priority: 'high',
    sound: 'default',
    data: { device, kind },
  }));

  try {
    const response = await fetch(ExpoPushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const { data: tickets = [], errors } = await response.json();
    if (errors) return console.warn('[push] rejected', JSON.stringify(errors));

    // Tickets come back in the order the messages went out. A phone that
    // uninstalled the app answers DeviceNotRegistered: forget it, or every
    // alert keeps paying for a message nobody can receive.
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') return;
      console.warn(`[push] ${tokens[index]}: ${ticket.message}`);
      if (ticket.details?.error === 'DeviceNotRegistered') removePushToken(tokens[index]);
    });

    const accepted = tickets.filter((ticket) => ticket.status === 'ok').length;
    console.log(`[push] alert ${kind} accepted for ${accepted}/${tokens.length} phone(s)`);
  } catch (error) {
    console.warn('[push] could not reach Expo', error.message);
  }
}
