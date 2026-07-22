const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(res, status, body) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

export function allowCors(req, res) {
  const configured = (process.env.SALA_FIT_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  const allowed = configured.length === 0 || !origin || configured.includes(origin);
  if (origin && allowed) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,x-sala-fit-key,x-client-request-id');
  return allowed;
}

export function authorize(req) {
  const expected = process.env.SALA_FIT_CLIENT_KEY;
  if (!expected) return true;
  const provided = req.headers['x-sala-fit-key'];
  return typeof provided === 'string' && provided.length > 0 && safeEqual(provided, expected);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

export function readBody(req, maxBytes = 200_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Payload prea mare.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('JSON invalid.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function cleanId(value, fallback = 'adrian') {
  const clean = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return clean || fallback;
}

export function cleanDate(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

export function requestId(req) {
  const incoming = req.headers['x-client-request-id'];
  if (typeof incoming === 'string' && incoming.length <= 128) return incoming;
  return crypto.randomUUID();
}
