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

  window.shareCsv = async function shareCsvDirect(day, data, date) {
    const fileName = `SALA_${date}_${day}.csv`;
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

      showToast('Salvat automat în OneDrive');
    } catch (error) {
      console.error('Salvarea automată în OneDrive a eșuat:', error);
      downloadBackup(fileName, csv);
      showToast('OneDrive indisponibil · CSV descărcat');
    }
  };

  localStorage.setItem('fitAppVersion', '1.3.4');
  document.addEventListener('DOMContentLoaded', () => {
    const version = document.querySelector('#version');
    if (version) version.textContent = 'Versiunea 1.3.4';
  });
})();
