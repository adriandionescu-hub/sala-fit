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
  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text.trim());
      }
    }
  }
  return parts.filter(Boolean).join('\n').trim();
}

function extractRefusal(response) {
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'refusal' && typeof content.refusal === 'string') {
        return content.refusal.trim();
      }
    }
  }
  return '';
}

const foodSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    serving_description: { type: 'string' },
    calories_kcal: { type: 'number', minimum: 0 },
    protein_g: { type: 'number', minimum: 0 },
    carbs_g: { type: 'number', minimum: 0 },
    fat_g: { type: 'number', minimum: 0 },
    confidence: { type: 'string', enum: ['ridicată', 'medie', 'scăzută'] },
    basis: { type: 'string', enum: ['etichetă', 'produs', 'farfurie', 'neclar'] },
    warning: { type: 'string' },
    details: { type: 'string' }
  },
  required: ['name', 'serving_description', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'basis', 'warning', 'details']
};

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Metodă neacceptată.' }, 405);

    const apiKey = process.env.OPENAI_API_KEY;
    const configuredPin = process.env.SALA_AI_PIN;
    if (!apiKey) return json({ error: 'Cheia OpenAI nu este configurată pe server.' }, 503);
    if (!configuredPin) return json({ error: 'PIN-ul SALA FIT AI nu este configurat pe server.' }, 503);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Cerere JSON invalidă.' }, 400);
    }

    if (String(body?.pin || '') !== String(configuredPin)) return json({ error: 'PIN incorect.' }, 401);

    const images = Array.isArray(body?.images) ? body.images.map(value => String(value || '')) : [];
    const context = body?.context && typeof body.context === 'object' ? body.context : {};
    if (!images.length || images.length > 5) return json({ error: 'Poți analiza între 1 și 5 fotografii.' }, 400);

    let totalLength = 0;
    for (const image of images) {
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
        return json({ error: 'Una dintre imagini este invalidă.' }, 400);
      }
      totalLength += image.length;
    }
    if (totalLength > 11_000_000) {
      return json({ error: 'Fotografiile sunt prea mari. Repetă-le mai aproape sau încarcă maximum 5.' }, 413);
    }

    const instructions = [
      'Ești modulul de analiză alimentară SALA FIT.',
      'Toate fotografiile primite reprezintă același produs sau aceeași masă și trebuie analizate împreună.',
      'Combină informațiile complementare din fața ambalajului, tabelul nutrițional, ingrediente, masa netă și indicațiile de porție.',
      'Când două fotografii se contrazic, folosește fotografia în care textul este cel mai clar și explică neconcordanța în warning.',
      'Folosește valorile lizibile de pe etichetă și calculează pentru cantitatea consumată declarată de utilizator.',
      'Nu confunda valorile per 100 g cu valorile per porție.',
      'Pentru produs sau farfurie fără valori lizibile, fă o estimare prudentă și marchează încrederea medie sau scăzută.',
      'Nu inventa precizie. Valorile sunt orientative și nu reprezintă recomandare medicală.',
      'Returnează exclusiv structura JSON cerută.'
    ].join(' ');

    const userText = [
      `Tip fotografie declarat: ${String(context.source || 'nespecificat')}.`,
      `Cantitate consumată declarată: ${String(context.quantity || 'nespecificată')}.`,
      `Număr fotografii ale aceluiași produs: ${images.length}.`,
      'Analizează toate fotografiile împreună și calculează valorile pentru cantitatea consumată.'
    ].join(' ');

    const content = [{ type: 'input_text', text: userText }];
    images.forEach(image => content.push({ type: 'input_image', image_url: image, detail: 'high' }));

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
          reasoning: { effort: 'minimal' },
          max_output_tokens: 1100,
          instructions,
          input: [{ role: 'user', content }],
          text: {
            format: {
              type: 'json_schema',
              name: 'sala_fit_food_multi',
              strict: true,
              schema: foodSchema
            }
          }
        })
      });
    } catch (error) {
      console.error('OpenAI network error', error);
      return json({ error: 'Serverul nu a putut contacta OpenAI.' }, 502);
    }

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('OpenAI API error', upstream.status, payload);
      return json({ error: payload?.error?.message || 'OpenAI a respins fotografiile.' }, upstream.status >= 500 ? 502 : 400);
    }

    const output = extractOutputText(payload);
    if (!output) {
      const refusal = extractRefusal(payload);
      return json({ error: refusal ? `Analiza a fost refuzată: ${refusal}` : 'OpenAI nu a returnat rezultate.' }, 502);
    }

    let result;
    try {
      result = JSON.parse(output);
    } catch {
      console.error('Invalid structured output', output);
      return json({ error: 'Rezultatul fotografiilor nu a putut fi interpretat.' }, 502);
    }

    return json({ result });
  }
};