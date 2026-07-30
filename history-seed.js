'use strict';

(() => {
  const VERSION = '1.3.11';
  const HISTORY_SEED = {
    A: {
      date: '2026-07-29',
      data: [
        { kg: 35, s1: '24', s2: '20', s3: '14', done: true },
        { kg: 45, s1: '16', s2: '11', s3: '10', done: true },
        { kg: 12, s1: '23', s2: '18', s3: '16', done: true },
        { kg: 50, s1: '20', s2: '17', s3: '13', done: true },
        { kg: 12, s1: '10', s2: '8', s3: '7', done: true },
        { kg: 20, s1: '16', s2: '12', s3: '11', done: true }
      ]
    },
    B: {
      date: '2026-07-27',
      data: [
        { kg: 25, s1: '20', s2: '14', s3: '12', done: true },
        { kg: 60, s1: '16', s2: '15', s3: '12', done: true },
        { kg: 5, s1: '12', s2: '13', s3: '12', done: true },
        { kg: 15, s1: '10', s2: '10', s3: '10', done: true },
        { kg: 20, s1: '20', s2: '15', s3: '12', done: true },
        { kg: 110, s1: 'X', s2: '20', s3: '20', done: true },
        { kg: 60, s1: 'X', s2: '20', s3: '17', done: true }
      ]
    },
    C: {
      date: '2026-07-28',
      data: [
        { kg: 35, s1: '14', s2: '12', s3: '10', done: true },
        { kg: 40, s1: '15', s2: '10', s3: '8', done: true },
        { kg: 35, s1: '15', s2: '10', s3: '10', done: true },
        { kg: 45, s1: '20', s2: '16', s3: '16', done: true },
        { kg: 5, s1: '8', s2: '6', s3: '5', done: true },
        { kg: 5, s1: '10', s2: '7', s3: '7', done: true },
        { kg: 10, s1: '12', s2: '8', s3: '9', done: true },
        { kg: 12.5, s1: '10', s2: '10', s3: '12', done: true },
        { kg: 40, s1: 'X', s2: '', s3: '', done: false, note: 'Nu a mai rămas timp.' },
        { kg: 40, s1: 'X', s2: '', s3: '', done: false }
      ]
    }
  };

  function readStored(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function hasRecordedReps(day, data) {
    if (!Array.isArray(data) || !PROGRAM[day]) return false;
    return PROGRAM[day].some((exercise, index) => {
      const row = data[index] || {};
      return requiredFields(exercise).some(field => (parseInt(row[field], 10) || 0) > 0);
    });
  }

  let repaired = false;
  Object.entries(HISTORY_SEED).forEach(([day, session]) => {
    const key = `fit:${session.date}:${day}`;
    const existing = readStored(key);

    // Păstrăm istoricul real dacă are repetări. Reparăm doar cheile goale,
    // incomplete sau corupte create anterior pe telefon.
    if (hasRecordedReps(day, existing)) return;

    localStorage.setItem(key, JSON.stringify(session.data));
    repaired = true;
  });

  if (repaired && typeof render === 'function') render();

  document.addEventListener('DOMContentLoaded', () => {
    localStorage.setItem('fitAppVersion', VERSION);
    const version = document.querySelector('#version');
    if (version) version.textContent = `Versiunea ${VERSION}`;
  });
})();