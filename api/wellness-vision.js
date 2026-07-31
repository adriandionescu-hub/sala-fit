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

const scaleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    weight_kg: { type: ['number', 'null'], minimum: 0 },
    body_fat_pct: { type: ['number', 'null'], minimum: 0 },
    muscle_mass_kg: { type: ['number', 'null'], minimum: 0 },
    body_water_pct: { type: ['number', 'null'], minimum: 0 },
    visceral_fat: { type: ['number', 'null'], minimum: 0 },
    bmr_kcal: { type: ['number', 'null'], minimum: 0 },
    metabolic_age: { type: ['number', 'null'], minimum: 0 },
    confidence: { type: 'string', enum: ['ridicată', 'medie', 'scăzută'] },
    warning: { type: 'string' },
    details: { type: 'string' }
  },
  required: ['weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'body_water_pct', 'visceral_fat', 'bmr_kcal', 'metabolic_age', 'confidence', 'warning', 'details']
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

    const mode = body?.mode === 'scale' ? 'scale' : body?.mode === 'food' ? 'food' : '';
    const image = String(body?.image || '');
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    if (!mode) return json({ error: 'Tip de analiză invalid.' }, 400);
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) return json({ error: 'Imagine invalidă.' }, 400);
    if (image.length > 6_500_000) return json({ error: 'Imaginea este prea mare. Repetă fotografia mai aproape.' }, 413);

    const isFood = mode === 'food';
    const instructions = isFood
      ? [
          'Ești modulul de analiză alimentară SALA FIT.',
          'Analizează fotografia unei etichete, a unui produs sau a unei farfurii.',
          'Folosește valorile lizibile de pe etichetă când există și calculează pentru cantitatea declarată de utilizator.',
          'Când cantitatea ori compoziția nu este sigură, fă o estimare prudentă și marchează încrederea medie sau scăzută.',
          'Nu inventa precizie. Valorile sunt orientative și nu reprezintă recomandare medicală.',
          'Returnează exclusiv structura JSON cerută.'
        ].join(' ')
      : [
          'Ești modulul de citire a capturilor din aplicații de cântar pentru SALA FIT.',
          'Extrage numai valorile clar vizibile. Pentru orice valoare absentă sau ilizibilă returnează null.',
          'Nu deduce și nu inventa valori corporale.',
          'Returnează exclusiv structura JSON cerută.'
        ].join(' ');

    const userText = isFood
      ? `Tip fotografie declarat: ${String(context.source || 'nespecificat')}. Cantitate consumată declarată: ${String(context.quantity || 'nespecificată')}. Analizează alimentul pentru cantitatea consumată.`
      : 'Citește valorile corporale afișate în această captură a aplicației cântarului.';

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
          max_output_tokens: 900,
          instructions,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: userText },
              { type: 'input_image', image_url: image, detail: 'high' }
            ]
          }],
          text: {
            format: {
              type: 'json_schema',
              name: isFood ? 'sala_fit_food' : 'sala_fit_scale',
              strict: true,
              schema: isFood ? foodSchema : scaleSchema
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
      return json({ error: payload?.error?.message || 'OpenAI a respins fotografia.' }, upstream.status >= 500 ? 502 : 400);
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
      return json({ error: 'Rezultatul foto nu a putut fi interpretat.' }, 502);
    }

    return json({ result });
  }
};