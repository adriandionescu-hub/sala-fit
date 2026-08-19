'use strict';

(() => {
  const RECOVERY_VERSION = '1.4.4';

  function stamp() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(value => String(value).padStart(2, '0'))
      .join('');
  }

  function readSession(date, day) {
    try {
      return JSON.parse(localStorage.getItem(`fit:${date}:${day}`) || 'null');
    } catch {
      return null;
    }
  }

  function hasRecordedReps(day, data) {
    if (!data || !PROGRAM[day]) return false;
    return PROGRAM[day].some((ex, index) => {
      const row = data[index] || {};
      return requiredFields(ex).some(field => (parseInt(row[field], 10) || 0) > 0);
    });
  }

  function findRecordedSessions() {
    const candidates = [];
    const seen = new Set();

    try {
      const last = JSON.parse(localStorage.getItem('fitLastFinished') || 'null');
      if (last?.date && PROGRAM[last.day]) {
        const data = readSession(last.date, last.day);
        if (hasRecordedReps(last.day, data)) {
          const key = `${last.date}:${last.day}`;
          seen.add(key);
          candidates.push({ date: last.date, day: last.day, data });
        }
      }
    } catch {
      // Continuăm cu scanarea completă.
    }

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const match = key?.match(/^fit:(\d{4}-\d{2}-\d{2}):([ABCDE])$/);
      if (!match) continue;
      const [, date, day] = match;
      const uniqueKey = `${date}:${day}`;
      if (seen.has(uniqueKey)) continue;
      const data = readSession(date, day);
      if (hasRecordedReps(day, data)) {
        seen.add(uniqueKey);
        candidates.push({ date, day, data });
      }
    }

    return candidates.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
      return calculateVolume(b.day, b.data) - calculateVolume(a.day, a.data);
    });
  }

  function downloadBackup(fileName, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function recoverSession(found, button) {
    const volume = calculateVolume(found.day, found.data);
    const fileName = `SALA_${found.date}_${found.day}_REC_${stamp()}.csv`;
    const csv = createCsv(found.day, found.data, found.date);
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'RECUPEREZ...';

    try {
      const response = await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          csv,
          day: found.day,
          date: found.date,
          volume
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      button.textContent = 'SALVAT ✓';
      showToast('Ședința recuperată în OneDrive');
    } catch (error) {
      console.error('Recuperarea ședinței a eșuat:', error);
      downloadBackup(fileName, csv);
      button.textContent = 'CSV DESCĂRCAT';
      alert('OneDrive nu a răspuns. Am descărcat pe telefon o copie CSV de siguranță.');
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 1800);
    }
  }

  function closeRecoveryPanel() {
    document.querySelector('#recoveryOverlay')?.remove();
  }

  function showAllSessions() {
    const sessions = findRecordedSessions();
    if (!sessions.length) {
      alert('Nu am găsit în memoria acestui telefon nicio ședință cu repetări înregistrate.');
      return;
    }

    closeRecoveryPanel();
    const overlay = document.createElement('div');
    overlay.id = 'recoveryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box';

    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(680px,100%);max-height:82vh;overflow:auto;background:#0b1729;border:1px solid #334155;border-radius:18px;padding:16px;box-sizing:border-box;color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.45)';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px"><div><b style="font-size:18px">📱 Ședințe salvate pe telefon</b><div style="font-size:12px;opacity:.72;margin-top:3px">Alege orice ședință și trimite-o separat în OneDrive.</div></div><button id="closeRecovery" type="button" style="border:0;border-radius:10px;padding:9px 12px;font-weight:800">ÎNCHIDE</button></div>';

    const list = document.createElement('div');
    list.style.cssText = 'display:grid;gap:9px;margin-top:12px';

    sessions.forEach(found => {
      const volume = calculateVolume(found.day, found.data);
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;background:#111f34;border:1px solid #26364c;border-radius:13px;padding:12px';
      const dateRo = found.date.split('-').reverse().join('.');
      row.innerHTML = `<div><b style="font-size:17px">${dateRo} · Ziua ${found.day}</b><div style="font-size:13px;opacity:.72;margin-top:3px">Volum: ${volume.toLocaleString('ro-RO')} kg</div></div>`;
      const recover = document.createElement('button');
      recover.type = 'button';
      recover.textContent = 'RECUPEREAZĂ';
      recover.style.cssText = 'border:0;border-radius:11px;padding:11px 12px;font-weight:900;background:#e2e8f0;color:#0f172a';
      recover.addEventListener('click', () => recoverSession(found, recover));
      row.appendChild(recover);
      list.appendChild(row);
    });

    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.querySelector('#closeRecovery')?.addEventListener('click', closeRecoveryPanel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeRecoveryPanel();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('#recoverLast');
    if (button && !button.dataset.recoveryBound) {
      button.dataset.recoveryBound = 'true';
      button.textContent = 'Ședințe salvate pe telefon';
      button.addEventListener('click', showAllSessions);
    }

    localStorage.setItem('fitAppVersion', RECOVERY_VERSION);
    const version = document.querySelector('#version');
    if (version) version.textContent = `Versiunea ${RECOVERY_VERSION}`;
  });
})();
