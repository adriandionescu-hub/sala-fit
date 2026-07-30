'use strict';

(() => {
  function downloadBackup(fileName, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportKey(day, date) {
    return `fitExported:${date}:${day}`;
  }

  function revisionStamp() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(value => String(value).padStart(2, '0'))
      .join('');
  }

  window.shareCsv = async function shareCsvDirect(day, data, date) {
    const key = exportKey(day, date);
    let previousExport = null;
    try {
      previousExport = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      previousExport = null;
    }

    const suffix = previousExport ? `_REV_${revisionStamp()}` : '';
    const fileName = `SALA_${date}_${day}${suffix}.csv`;
    const csv = createCsv(day, data, date);
    const volume = calculateVolume(day, data);

    try {
      const response = await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, csv, day, date, volume })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      localStorage.setItem(key, JSON.stringify({
        fileName,
        savedAt: new Date().toISOString(),
        volume
      }));

      showToast(previousExport
        ? 'Copie REV salvată · originalul a rămas intact'
        : 'Salvat automat în OneDrive');
    } catch (error) {
      console.error('Salvarea automată în OneDrive a eșuat:', error);
      downloadBackup(fileName, csv);
      showToast('OneDrive indisponibil · CSV descărcat');
    }
  };

  localStorage.setItem('fitAppVersion', '1.3.6');
  document.addEventListener('DOMContentLoaded', () => {
    const version = document.querySelector('#version');
    if (version) version.textContent = 'Versiunea 1.3.6';
  });
})();