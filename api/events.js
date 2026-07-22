import { put } from '@vercel/blob';
import { allowCors, authorize, cleanDate, cleanId, json, readBody, requestId } from './_shared.js';

const ALLOWED_TYPES = new Set(['session', 'food', 'weight', 'bike', 'sleep', 'note']);

export default async function handler(req, res) {
  if (!allowCors(req, res)) return json(res, 403, { ok: false, error: 'Origine nepermisă.' });
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Metodă nepermisă.' });
  if (!authorize(req)) return json(res, 401, { ok: false, error: 'Cheie SALA FIT invalidă.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 503, { ok: false, queued: true, error: 'Stocarea cloud nu este configurată.' });
  }

  try {
    const body = await readBody(req);
    const type = String(body.type || '');
    if (!ALLOWED_TYPES.has(type)) return json(res, 400, { ok: false, error: 'Tip de eveniment invalid.' });

    const userId = cleanId(body.userId);
    const date = cleanDate(body.date || body.payload?.date);
    const eventId = cleanId(body.eventId || body.payload?.id || requestId(req), crypto.randomUUID());
    const record = {
      schemaVersion: 1,
      userId,
      type,
      date,
      eventId,
      receivedAt: new Date().toISOString(),
      payload: body.payload || {}
    };

    const pathname = `users/${userId}/${type}/${date}/${eventId}.json`;
    const blob = await put(pathname, JSON.stringify(record, null, 2), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return json(res, 200, {
      ok: true,
      stored: true,
      type,
      date,
      eventId,
      pathname: blob.pathname
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(res, status, { ok: false, error: status === 500 ? 'Eroare la salvarea în cloud.' : error.message });
  }
}
