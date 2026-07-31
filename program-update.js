'use strict';

(() => {
  const VERSION = '1.3.13';
  const INTRODUCED = '2026-07-31';
  const BASE_EXERCISE = {
    name: 'Rotiri de trunchi la cablu',
    kg: 15,
    step: 5,
    sets: 2,
    min: 10,
    max: 12,
    rest: 60,
    video: 'standing cable torso rotation arms extended chest height proper form',
    introduced: INTRODUCED
  };

  PROGRAM.C[8] = { ...BASE_EXERCISE, side: 'STÂNGA' };
  PROGRAM.C[9] = { ...BASE_EXERCISE, side: 'DREAPTA' };

  const previousPrescription = prescription;

  prescription = function(day, index, exercise) {
    if (!exercise?.introduced) {
      return previousPrescription(day, index, exercise);
    }

    const sessions = historyFor(day).filter(session => session.date >= exercise.introduced);
    for (const session of sessions) {
      const row = session?.data?.[index];
      const values = completedReps(row, exercise);
      if (values === null) continue;

      const kg = parseFloat(row.kg ?? exercise.kg) || exercise.kg;
      const grow = values.every(value => value >= exercise.max);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;

      return {
        kg: grow ? kg + exercise.step : kg,
        last: row,
        medal: grow,
        lastAvg: average
      };
    }

    return { kg: exercise.kg, last: null, medal: false, lastAvg: null };
  };

  // Dacă ziua C a fost deschisă înainte de actualizare, înlocuim valoarea veche
  // a Pallof-ului doar cât timp nu au fost introduse repetări pentru exercițiul nou.
  const today = localDate();
  const data = loadSession('C', today);
  let changed = false;

  [8, 9].forEach(index => {
    const exercise = PROGRAM.C[index];
    const row = data[index] || {};
    const hasReps = requiredFields(exercise).some(field => (parseInt(row[field], 10) || 0) > 0);
    const oldDefault = Number(row.kg) === 40;

    if (!hasReps && (row.kg == null || oldDefault)) {
      data[index] = { ...row, kg: exercise.kg, done: false };
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem(sessionKey('C', today), JSON.stringify(data));
  }

  localStorage.setItem('fitAppVersion', VERSION);

  const showVersion = () => {
    const version = document.querySelector('#version');
    if (version) version.textContent = `Versiunea ${VERSION}`;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showVersion);
  } else {
    showVersion();
  }

  if (typeof render === 'function') render();
})();
