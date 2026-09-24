import express from 'express';

import {
  deviceExists,
  getMeasurements,
  getThresholds,
  listDevices,
  nowSeconds,
  saveThresholds,
} from './store.js';

/** `from` absent means the last ten minutes. */
const DefaultWindowSeconds = 600;

const badRequest = (res, message) => res.status(400).json({ error: message });
const notFound = (res) => res.status(404).json({ error: 'unknown device' });

/** `undefined` when absent, `null` when present but not an integer. */
function readInteger(value) {
  if (value === undefined) return undefined;
  return /^-?\d+$/.test(value) ? Number.parseInt(value, 10) : null;
}

/** A threshold bound is a number, or null when that bound is not watched. */
const isBound = (value) => value === null || Number.isFinite(value);

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get('/devices', (_req, res) => res.json(listDevices()));

  app.get('/devices/:id/measurements', (req, res) => {
    const device = req.params.id;
    if (!deviceExists(device)) return notFound(res);

    const from = readInteger(req.query.from);
    const to = readInteger(req.query.to);
    const step = readInteger(req.query.step);

    if (from === null) return badRequest(res, '`from` must be an epoch in seconds');
    if (to === null) return badRequest(res, '`to` must be an epoch in seconds');
    if (step !== undefined && (step === null || step <= 0)) {
      return badRequest(res, '`step` must be a positive integer');
    }

    const end = to ?? nowSeconds();
    const start = from ?? end - DefaultWindowSeconds;
    if (start > end) return badRequest(res, '`from` must not be after `to`');

    res.json(getMeasurements({ device, from: start, to: end, step }));
  });

  app.get('/devices/:id/thresholds', (req, res) => {
    if (!deviceExists(req.params.id)) return notFound(res);
    res.json(getThresholds(req.params.id));
  });

  app.put('/devices/:id/thresholds', (req, res) => {
    if (!deviceExists(req.params.id)) return notFound(res);

    const { tMin = null, tMax = null, hMin = null, hMax = null, holdMinutes } = req.body ?? {};

    if (![tMin, tMax, hMin, hMax].every(isBound)) {
      return badRequest(res, 'bounds must be numbers or null');
    }
    if (!Number.isInteger(holdMinutes) || holdMinutes < 0) {
      return badRequest(res, '`holdMinutes` must be a positive integer');
    }
    // A min above its max can never be satisfied: the box would alert forever.
    if (tMin !== null && tMax !== null && tMin > tMax) {
      return badRequest(res, '`tMin` must not be above `tMax`');
    }
    if (hMin !== null && hMax !== null && hMin > hMax) {
      return badRequest(res, '`hMin` must not be above `hMax`');
    }

    res.json(saveThresholds(req.params.id, { tMin, tMax, hMin, hMax, holdMinutes }));
  });

  return app;
}
