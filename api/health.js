import { allowCors, authorize, json } from './_shared.js';

export default async function handler(req, res) {
  if (!allowCors(req, res)) return json(res, 403, { ok: false, error: 'Origine nepermisă.' });
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Metodă nepermisă.' });
  if (!authorize(req)) return json(res, 401, { ok: false, error: 'Cheie SALA FIT invalidă.' });

  return json(res, 200, {
    ok: true,
    service: 'sala-fit-api',
    version: '0.1.0',
    openai: Boolean(process.env.OPENAI_API_KEY),
    storage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    timestamp: new Date().toISOString()
  });
}
