'use strict';

module.exports = async function saveSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const webhookUrl = process.env.SALA_MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ ok: false, error: 'Webhook is not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }
  }

  body = body || {};
  const fileName = String(body.fileName || '').trim();
  const csv = String(body.csv || '');
  const day = String(body.day || '').trim();
  const date = String(body.date || '').trim();
  const volume = Number(body.volume) || 0;

  if (!/^SALA_\d{4}-\d{2}-\d{2}_[ABCDE](?:_(?:REV|REC)_\d{6})?\.csv$/.test(fileName)) {
    return res.status(400).json({ ok: false, error: 'Invalid file name' });
  }

  if (!csv || csv.length > 250000) {
    return res.status(400).json({ ok: false, error: 'Invalid CSV payload' });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        csv,
        day,
        date,
        volume,
        source: 'SALA FIT'
      })
    });

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: 'Make webhook rejected the session',
        details: upstreamText.slice(0, 300)
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('SALA FIT webhook relay failed:', error);
    return res.status(502).json({ ok: false, error: 'Could not reach Make webhook' });
  }
};
