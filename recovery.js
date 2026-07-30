'use strict';

(() => {
  const RECOVERY_VERSION = '1.3.9';

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

  function findLastRecordedSession() {
    try {
      const last = JSON.parse(localStorage.getItem('fitLastFinished') || 'null');
      if (last?.date && PROGRAM[last.day]) {
        const data = readSession(last.date, last.day);
        if (hasRecordedReps(last.day, data)) {
          return { date: last.date, day: last.day, data };
        }
      }
    } catch {
      // Continuăm cu scanarea completă.
    }

    const candidates = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const match = key?.match(/^fit:(\d{4}-\d{2}-\d{2}):([ABC])$/);
      if (!match) continue;
      const [, date, day] = match;
      const data = readSession(date, day);
      if (hasRecordedReps(day, data)) candidates.push({ date, day, data });
    }

    return candidates.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
      return calculateVolume(b.day, b.data) - calculateVolume(a.day, a.data);
    })[0] || null;
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

  async function recoverLastSession(button) {
    const found = findLastRecordedSession();
    if (!found) {
      alert('Nu am găsit în memoria acestui telefon nicio ședință cu repetări înregistrate.');
      return;
    }

    const volume = calculateVolume(found.day, found.data);
    const approved = confirm(
      `Am găsit ședința ${found.day} din ${found.date}, cu volum ${volume.toLocaleString('ro-RO')} kg.\n\nO trimit separat în OneDrive, fără să suprascriu alte fișiere?`
    );
    if (!approved) return;

    const fileName = `SALA_${found.date}_${found.day}_REC_${stamp()}.csv`;
    const csv = createCsv(found.day, found.data, found.date);
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
      showToast('Ședința recuperată în OneDrive');
      alert(`Gata: ${fileName} a fost salvat separat în OneDrive.`);
    } catch (error) {
      console.error('Recuperarea ședinței a eșuat:', error);
      downloadBackup(fileName, csv);
      alert('OneDrive nu a răspuns. Am descărcat pe telefon o copie CSV de siguranță.');
    } finally {
      button.disabled = false;
      button.textContent = 'Recuperează ultima';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('#recoverLast');
    if (button && !button.dataset.recoveryBound) {
      button.dataset.recoveryBound = 'true';
      button.addEventListener('click', () => recoverLastSession(button));
    }

    localStorage.setItem('fitAppVersion', RECOVERY_VERSION);
    const version = document.querySelector('#version');
    if (version) version.textContent = `Versiunea ${RECOVERY_VERSION}`;
  });
})();
