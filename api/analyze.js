'use strict';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text.trim();
      }
    }
  }

  return '';
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Metodă neacceptată.' }, 405);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const configuredPin = process.env.SALA_AI_PIN;

    if (!apiKey) {
      return json({ error: 'Cheia OpenAI nu este configurată pe server.' }, 503);
    }

    if (!configuredPin) {
      return json({ error: 'PIN-ul SALA FIT AI nu este configurat pe server.' }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Cerere JSON invalidă.' }, 400);
    }

    if (String(body?.pin || '') !== String(configuredPin)) {
      return json({ error: 'PIN incorect.' }, 401);
    }

    const session = body?.session;
    if (!session || !Array.isArray(session.exercises) || session.exercises.length > 20) {
      return json({ error: 'Datele ședinței sunt invalide.' }, 400);
    }

    const sessionJson = JSON.stringify(session);
    if (sessionJson.length > 18000) {
      return json({ error: 'Datele ședinței sunt prea mari.' }, 413);
    }

    const instructions = [
      'Ești Motanul, antrenorul personal prudent al lui Adrian.',
      'Răspunde exclusiv în română, clar, cald și concret.',
      'Analizează doar datele primite; nu inventa rezultate sau istoric.',
      'Structură obligatorie: REZUMAT, CE A MERS BINE, CE AJUSTĂM, DATA VIITOARE, OPȚIONAL.',
      'Maximum 220 de cuvinte.',
      'Folosește valori exacte din ședință când sunt relevante.',
      'Nu pune diagnostic medical. Dacă durerea este 4 sau mai mare, recomandă să nu crească sarcina și să oprească exercițiul dacă durerea persistă sau se agravează.'
    ].join(' ');

    let upstream;
    try {
      upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          store: false,
          max_output_tokens: 700,
          instructions,
          input: `Analizează această ședință SALA FIT:\n${sessionJson}`
        })
      });
    } catch (error) {
      console.error('OpenAI network error', error);
      return json({ error: 'Serverul nu a putut contacta OpenAI.' }, 502);
    }

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error('OpenAI API error', upstream.status, payload);
      const message = payload?.error?.message || 'OpenAI a respins cererea.';
      return json({ error: message }, upstream.status >= 500 ? 502 : 400);
    }

    const analysis = extractOutputText(payload);
    if (!analysis) {
      return json({ error: 'OpenAI nu a returnat text pentru analiză.' }, 502);
    }

    return json({ analysis });
  }
};
