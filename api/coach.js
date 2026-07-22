import { allowCors, authorize, json, readBody, requestId } from './_shared.js';

const COACH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    nextSession: { type: 'string', enum: ['A', 'B', 'C', 'PAUZĂ', 'NECLAR'] },
    effort: { type: 'string', enum: ['ușor', 'moderat', 'greu', 'foarte greu', 'neclar'] },
    recovery: { type: 'string' },
    nutrition: { type: 'string' },
    warning: { type: 'string' },
    actions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          exercise: { type: 'string' },
          action: { type: 'string', enum: ['menține', 'crește', 'scade', 'înlocuiește', 'urmărește'] },
          detail: { type: 'string' }
        },
        required: ['exercise', 'action', 'detail']
      }
    }
  },
  required: ['summary', 'nextSession', 'effort', 'recovery', 'nutrition', 'warning', 'actions']
};

function outputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (!allowCors(req, res)) return json(res, 403, { ok: false, error: 'Origine nepermisă.' });
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Metodă nepermisă.' });
  if (!authorize(req)) return json(res, 401, { ok: false, error: 'Cheie SALA FIT invalidă.' });
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { ok: false, error: 'OpenAI API nu este configurat.' });

  const clientRequestId = requestId(req);
  try {
    const body = await readBody(req);
    const prompt = {
      profile: body.profile || {},
      session: body.session || {},
      recentSessions: Array.isArray(body.recentSessions) ? body.recentSessions.slice(-8) : [],
      dailyState: body.dailyState || {},
      userMessage: String(body.message || '')
    };

    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
        'x-client-request-id': clientRequestId
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: process.env.OPENAI_STORE === 'true',
        input: [
          {
            role: 'developer',
            content: [{
              type: 'input_text',
              text: [
                'Ești Motanul SALA FIT, antrenor prudent și cald. Răspunzi în română.',
                'Obiectiv: progres sustenabil, maximum 60 de minute, RIR țintă 2 și durere acceptată maximum 2/10.',
                'Nu diagnostica. Pentru durere nouă, intensă, persistentă, amețeală, durere în piept sau lipsă de aer recomandă oprirea efortului și evaluare medicală.',
                'Nu recompensa sau pedepsi alimentele prin sport. Fii direct, fără rușinare.',
                'Bazează recomandările numai pe datele primite; spune neclar când lipsesc informații.'
              ].join('\n')
            }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(prompt) }]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'sala_fit_coach',
            strict: true,
            schema: COACH_SCHEMA
          }
        }
      })
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error('OpenAI API error', apiResponse.status, data);
      return json(res, 502, { ok: false, error: 'Motanul AI nu a putut răspunde.', requestId: clientRequestId });
    }

    const text = outputText(data);
    if (!text) return json(res, 502, { ok: false, error: 'Răspuns AI gol.', requestId: clientRequestId });
    const coach = JSON.parse(text);

    return json(res, 200, {
      ok: true,
      coach,
      model: data.model || process.env.OPENAI_MODEL || 'gpt-5-mini',
      requestId: clientRequestId
    });
  } catch (error) {
    console.error('Coach handler error', error);
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : 'Eroare internă Motan AI.',
      requestId: clientRequestId
    });
  }
}
