'use strict';
(() => {
  const API_VERSION = '0.1.0';
  const USER_ID = 'adrian';
  const QUEUE_KEY = 'fitApiQueueV1';
  const BASE_KEY = 'fitApiBaseUrl';
  const CLIENT_KEY = 'fitApiClientKey';
  const isGitHubPages = location.hostname.endsWith('github.io');

  const $ = selector => document.querySelector(selector);
  const apiBase = () => {
    const configured = (localStorage.getItem(BASE_KEY) || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    return isGitHubPages ? '' : location.origin;
  };
  const headers = () => {
    const result = { 'content-type': 'application/json', 'x-client-request-id': crypto.randomUUID() };
    const key = localStorage.getItem(CLIENT_KEY);
    if (key) result['x-sala-fit-key'] = key;
    return result;
  };

  function createPanel() {
    const panel = document.createElement('section');
    panel.className = 'api-panel';
    panel.innerHTML = `
      <div class="api-head">
        <div><b>🐈‍⬛ Motan AI</b><small id="apiStatus">API neconfigurat</small></div>
        <button type="button" id="apiSettings">Setări</button>
      </div>
      <div class="api-settings" id="apiSettingsBox">
        <label>Adresa API<input id="apiBaseInput" inputmode="url" placeholder="https://sala-fit.vercel.app"></label>
        <label>Cheie SALA FIT<input id="apiKeyInput" type="password" autocomplete="off" placeholder="cheia aplicației, nu cheia OpenAI"></label>
        <div class="api-row"><button type="button" id="apiSave">Salvează</button><button type="button" id="apiTest">Testează</button></div>
      </div>
      <button type="button" class="coach-button" id="coachButton">Analizează ultima ședință</button>
      <div class="coach-output" id="coachOutput">După configurarea serverului, Motanul va analiza ședința direct aici.</div>`;
    const list = $('#list');
    list.parentNode.insertBefore(panel, list);

    $('#apiBaseInput').value = localStorage.getItem(BASE_KEY) || '';
    $('#apiKeyInput').value = localStorage.getItem(CLIENT_KEY) || '';
    $('#apiSettings').addEventListener('click', () => $('#apiSettingsBox').classList.toggle('on'));
    $('#apiSave').addEventListener('click', saveSettings);
    $('#apiTest').addEventListener('click', testApi);
    $('#coachButton').addEventListener('click', askCoach);
  }

  function saveSettings() {
    localStorage.setItem(BASE_KEY, $('#apiBaseInput').value.trim().replace(/\/$/, ''));
    localStorage.setItem(CLIENT_KEY, $('#apiKeyInput').value.trim());
    $('#apiSettingsBox').classList.remove('on');
    setStatus('Setări salvate', 'pending');
    testApi();
  }

  function setStatus(text, state = '') {
    const node = $('#apiStatus');
    if (!node) return;
    node.textContent = text;
    node.className = state;
  }

  async function testApi() {
    const base = apiBase();
    if (!base) return setStatus('API neconfigurat', 'error');
    setStatus('Verific...', 'pending');
    try {
      const response = await fetch(`${base}/api/health`, { headers: headers() });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'API indisponibil');
      setStatus(`online · AI ${data.openai ? 'DA' : 'NU'} · cloud ${data.storage ? 'DA' : 'NU'}`, data.openai ? 'ok' : 'pending');
      flushQueue();
    } catch (error) {
      setStatus(error.message || 'API offline', 'error');
    }
  }

  function queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  }
  function saveQueue(items) { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-100))); }
  function enqueue(event) {
    const items = queue();
    if (!items.some(item => item.eventId === event.eventId)) items.push(event);
    saveQueue(items);
    setStatus(`${items.length} în așteptare`, 'pending');
  }

  async function sendEvent(event) {
    const base = apiBase();
    if (!base) throw new Error('API neconfigurat');
    const response = await fetch(`${base}/api/events`, { method: 'POST', headers: headers(), body: JSON.stringify(event) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Salvare nereușită');
    return data;
  }

  async function flushQueue() {
    if (!navigator.onLine || !apiBase()) return;
    const pending = queue();
    if (!pending.length) return;
    const remaining = [];
    for (const event of pending) {
      try { await sendEvent(event); } catch { remaining.push(event); }
    }
    saveQueue(remaining);
    setStatus(remaining.length ? `${remaining.length} în așteptare` : 'sincronizat', remaining.length ? 'pending' : 'ok');
  }

  function sessionEvent(day, date, data) {
    const rows = PROGRAM[day].map((exercise, index) => {
      const row = data[index] || {};
      return {
        order: index + 1,
        exercise: exercise.name,
        side: exercise.side || 'Bilateral',
        kg: Number.parseFloat(row.kg ?? exercise.kg) || 0,
        sets: exercise.sets === 2 ? ['X', Number.parseInt(row.s2, 10) || null, Number.parseInt(row.s3, 10) || null] : [Number.parseInt(row.s1, 10) || null, Number.parseInt(row.s2, 10) || null, Number.parseInt(row.s3, 10) || null],
        rir: Number.parseInt(row.rir ?? 2, 10),
        pain: Number.parseInt(row.pain ?? 0, 10),
        done: Boolean(row.done || isComplete(row, exercise)),
        note: row.note || ''
      };
    });
    return {
      type: 'session',
      userId: USER_ID,
      date,
      eventId: `session-${date}-${day}`,
      payload: { id: `${date}_${day}`, date, day, completedAt: new Date().toISOString(), rows }
    };
  }

  function recentSessions(limit = 6) {
    return Object.keys(localStorage)
      .filter(key => /^fit:\d{4}-\d{2}-\d{2}:[ABC]$/.test(key))
      .sort()
      .slice(-limit)
      .map(key => {
        const [, date, day] = key.split(':');
        let data = {};
        try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
        return sessionEvent(day, date, data).payload;
      });
  }

  function lastSession() {
    let last = null;
    try { last = JSON.parse(localStorage.getItem('fitLastFinished') || 'null'); } catch {}
    if (!last?.day || !last?.date) return null;
    let data = {};
    try { data = JSON.parse(localStorage.getItem(`fit:${last.date}:${last.day}`) || '{}'); } catch {}
    return sessionEvent(last.day, last.date, data);
  }

  async function syncLastSession() {
    const event = lastSession();
    if (!event) return;
    enqueue(event);
    await flushQueue();
  }

  function coachHtml(coach) {
    const actions = (coach.actions || []).map(item => `<li><b>${escapeHtml(item.exercise)}</b>: ${escapeHtml(item.action)} — ${escapeHtml(item.detail)}</li>`).join('');
    return `<b>${escapeHtml(coach.summary)}</b>
      <p><b>Urmează:</b> ${escapeHtml(coach.nextSession)} · <b>Efort:</b> ${escapeHtml(coach.effort)}</p>
      <p><b>Recuperare:</b> ${escapeHtml(coach.recovery)}</p>
      <p><b>Alimentație:</b> ${escapeHtml(coach.nutrition)}</p>
      ${coach.warning ? `<p class="coach-warning"><b>Atenție:</b> ${escapeHtml(coach.warning)}</p>` : ''}
      ${actions ? `<ul>${actions}</ul>` : ''}`;
  }

  async function askCoach() {
    const base = apiBase();
    const output = $('#coachOutput');
    const button = $('#coachButton');
    const event = lastSession();
    if (!base) { $('#apiSettingsBox').classList.add('on'); output.textContent = 'Introdu mai întâi adresa serverului API.'; return; }
    if (!event) { output.textContent = 'Nu am găsit o ședință finalizată pe telefon.'; return; }
    button.disabled = true;
    output.textContent = 'Motanul analizează...';
    try {
      const response = await fetch(`${base}/api/coach`, {
        method: 'POST', headers: headers(), body: JSON.stringify({
          profile: { userId: USER_ID, heightCm: 178, maxSessionMinutes: 60, targetRir: 2, maxPain: 2 },
          session: event.payload,
          recentSessions: recentSessions(),
          message: 'Analizează ședința și recomandă clar ce fac la următoarea apariție a acestei zile.'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Analiza a eșuat');
      output.innerHTML = coachHtml(data.coach);
      localStorage.setItem(`fitCoach:${event.date}:${event.payload.day}`, JSON.stringify(data));
      setStatus('Motan AI online', 'ok');
    } catch (error) {
      output.textContent = error.message || 'Motanul nu a putut răspunde.';
      setStatus('API indisponibil', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
  }

  createPanel();
  $('#finish').addEventListener('click', () => setTimeout(syncLastSession, 500));
  window.addEventListener('online', flushQueue);
  window.addEventListener('load', testApi);
  setTimeout(testApi, 800);
  console.info(`SALA FIT API client ${API_VERSION}`);
})();
