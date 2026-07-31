'use strict';

(() => {
  const WELLNESS_VERSION = '1.4.0';
  const DEFAULT_TARGETS = { calories: 2200, protein: 150, carbs: 200, fat: 70, water: 2500 };
  let activeDate = todayKey();
  let activeTab = 'sleep';
  let pendingFoodImage = '';
  let pendingScaleImage = '';

  const byId = id => document.getElementById(id);
  const num = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round1 = value => Math.round(num(value) * 10) / 10;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function timeNow() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function dayKey(date = activeDate) {
    return `fitWellness:${date}`;
  }

  function emptyDay() {
    return {
      sleep: { bed: '', wake: '', quality: 3, awakenings: 0, minutes: 0 },
      waterMl: 0,
      measurements: {
        weightKg: '', bodyFatPct: '', muscleMassKg: '', bodyWaterPct: '',
        visceralFat: '', bmrKcal: '', metabolicAge: '', note: ''
      },
      meals: []
    };
  }

  function loadDay(date = activeDate) {
    const base = emptyDay();
    try {
      const stored = JSON.parse(localStorage.getItem(dayKey(date)) || '{}');
      return {
        ...base,
        ...stored,
        sleep: { ...base.sleep, ...(stored.sleep || {}) },
        measurements: { ...base.measurements, ...(stored.measurements || {}) },
        meals: Array.isArray(stored.meals) ? stored.meals : []
      };
    } catch {
      return base;
    }
  }

  function saveDay(data, message = 'Jurnal salvat') {
    localStorage.setItem(dayKey(), JSON.stringify(data));
    renderAll();
    if (typeof showToast === 'function') showToast(message);
  }

  function loadTargets() {
    try {
      return { ...DEFAULT_TARGETS, ...(JSON.parse(localStorage.getItem('fitWellnessTargets') || '{}')) };
    } catch {
      return { ...DEFAULT_TARGETS };
    }
  }

  function saveTargets() {
    const targets = {
      calories: Math.max(1, num(byId('targetCalories').value)),
      protein: Math.max(1, num(byId('targetProtein').value)),
      carbs: Math.max(1, num(byId('targetCarbs').value)),
      fat: Math.max(1, num(byId('targetFat').value)),
      water: Math.max(250, num(byId('targetWater').value))
    };
    localStorage.setItem('fitWellnessTargets', JSON.stringify(targets));
    renderAll();
    if (typeof showToast === 'function') showToast('Țintele au fost salvate');
  }

  function calculateSleepMinutes(bed, wake) {
    if (!/^\d{2}:\d{2}$/.test(bed) || !/^\d{2}:\d{2}$/.test(wake)) return 0;
    const [bedH, bedM] = bed.split(':').map(Number);
    const [wakeH, wakeM] = wake.split(':').map(Number);
    let start = bedH * 60 + bedM;
    let end = wakeH * 60 + wakeM;
    if (end <= start) end += 24 * 60;
    const minutes = end - start;
    return minutes > 18 * 60 ? 0 : minutes;
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Math.round(num(minutes)));
    return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, '0')}m`;
  }

  function totals(day) {
    return day.meals.reduce((sum, meal) => {
      sum.calories += num(meal.calories);
      sum.protein += num(meal.protein);
      sum.carbs += num(meal.carbs);
      sum.fat += num(meal.fat);
      return sum;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function progress(value, target) {
    return Math.min(100, Math.max(0, target ? value / target * 100 : 0));
  }

  function paretoNames(meals, field) {
    const sorted = meals
      .map(meal => ({ name: meal.name || 'Aliment', value: num(meal[field]) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, item) => sum + item.value, 0);
    if (!total) return 'Nu există încă date.';
    const picked = [];
    let cumulative = 0;
    for (const item of sorted) {
      picked.push(item.name);
      cumulative += item.value;
      if (cumulative >= total * 0.8) break;
    }
    return picked.join(', ');
  }

  function modalHtml() {
    return `
      <div class="wellness-modal" id="wellnessModal" hidden>
        <div class="wellness-dialog" role="dialog" aria-modal="true" aria-labelledby="wellnessTitle">
          <div class="wellness-head">
            <div class="wellness-title"><b id="wellnessTitle">JURNAL ZILNIC SALA FIT</b><span>Somn · apă · alimentație · măsurători</span></div>
            <button class="wellness-close" id="wellnessClose" type="button">ÎNCHIDE ×</button>
          </div>
          <div class="wellness-body">
            <div class="wellness-date-row">
              <div><label>DATA ZILEI</label><input type="date" id="wellnessDate"></div>
              <button type="button" id="wellnessToday">ASTĂZI</button>
            </div>

            <div class="wellness-summary">
              <div class="wellness-stat"><b id="sumSleep">0h</b><span>SOMN</span></div>
              <div class="wellness-stat"><b id="sumWater">0 ml</b><span>APĂ</span></div>
              <div class="wellness-stat"><b id="sumCalories">0 kcal</b><span>ENERGIE</span></div>
              <div class="wellness-stat"><b id="sumWeight">—</b><span>MASĂ</span></div>
            </div>

            <div class="wellness-tabs">
              <button class="wellness-tab" data-wellness-tab="sleep" type="button">🌙 SOMN</button>
              <button class="wellness-tab" data-wellness-tab="water" type="button">💧 APĂ</button>
              <button class="wellness-tab" data-wellness-tab="food" type="button">🍽️ ALIMENTE</button>
              <button class="wellness-tab" data-wellness-tab="body" type="button">⚖️ MĂSURĂTORI</button>
            </div>

            <section class="wellness-panel" data-wellness-panel="sleep">
              <div class="wellness-card">
                <h3>Somnul nopții</h3>
                <p>Înregistrarea aparține zilei în care te-ai trezit.</p>
                <div class="wellness-grid">
                  <div class="wellness-field"><label>ORA DE CULCARE</label><input type="time" id="sleepBed"></div>
                  <div class="wellness-field"><label>ORA DE TREZIRE</label><input type="time" id="sleepWake"></div>
                  <div class="wellness-field"><label>CALITATE 1–5</label><select id="sleepQuality"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
                  <div class="wellness-field"><label>TREZIRI ÎN NOAPTE</label><input type="number" min="0" max="20" inputmode="numeric" id="sleepAwakenings"></div>
                </div>
                <div class="sleep-result" id="sleepResult">Durată: 0h 00m</div>
                <button class="wellness-save" id="sleepSave" type="button">SALVEAZĂ SOMNUL</button>
              </div>
            </section>

            <section class="wellness-panel" data-wellness-panel="water" hidden>
              <div class="wellness-card">
                <h3>Hidratare</h3>
                <p>Adaugi rapid numai apa efectiv băută.</p>
                <div class="water-total"><b id="waterTotal">0 ml</b><span id="waterTargetText">din 2500 ml</span></div>
                <div class="water-quick">
                  <button type="button" data-water-add="250">+250 ml</button>
                  <button type="button" data-water-add="500">+500 ml</button>
                  <button type="button" data-water-add="750">+750 ml</button>
                </div>
                <div class="wellness-grid" style="margin-top:9px">
                  <div class="wellness-field"><label>ALTĂ CANTITATE ML</label><input type="number" min="0" inputmode="numeric" id="waterCustom"></div>
                  <div><button class="wellness-add" id="waterCustomAdd" type="button">ADAUGĂ</button></div>
                </div>
                <button class="danger-link" id="waterReset" type="button">RESETEAZĂ APA ZILEI</button>
              </div>
            </section>

            <section class="wellness-panel" data-wellness-panel="food" hidden>
              <div class="wellness-card">
                <h3>Situația alimentară până acum</h3>
                <div class="progress-list" id="nutritionProgress"></div>
              </div>

              <div class="wellness-card">
                <h3>Fotografiază alimentul</h3>
                <p>Eticheta oferă rezultatul cel mai precis. Pentru produs sau farfurie, rezultatul este o estimare care se confirmă înainte de salvare.</p>
                <div class="wellness-grid">
                  <div class="wellness-field"><label>TIP FOTOGRAFIE</label><select id="foodSource"><option value="etichetă">Etichetă</option><option value="produs">Produs</option><option value="farfurie">Farfurie</option></select></div>
                  <div class="wellness-field"><label>CANTITATE CONSUMATĂ</label><input id="foodQuantity" placeholder="Ex.: 125 g / un recipient"></div>
                </div>
                <div class="camera-row" style="margin-top:9px">
                  <label class="camera-file">📷 FĂ POZĂ SAU ALEGE IMAGINEA<input type="file" accept="image/*" capture="environment" id="foodPhoto"></label>
                  <img class="camera-preview" id="foodPreview" alt="Previzualizare aliment">
                </div>
                <button class="wellness-ai" id="foodAnalyze" type="button">🐾 ANALIZEAZĂ FOTOGRAFIA</button>
                <div class="ai-note" id="foodAiNote">Fotografia nu este păstrată în jurnalul aplicației.</div>
              </div>

              <div class="wellness-card">
                <h3>Confirmă alimentul</h3>
                <div class="wellness-grid">
                  <div class="wellness-field"><label>DENUMIRE</label><input id="foodName" placeholder="Aliment"></div>
                  <div class="wellness-field"><label>ORA</label><input type="time" id="foodTime"></div>
                  <div class="wellness-field"><label>KCAL</label><input type="number" step="0.1" inputmode="decimal" id="foodCalories"></div>
                  <div class="wellness-field"><label>PROTEINE G</label><input type="number" step="0.1" inputmode="decimal" id="foodProtein"></div>
                  <div class="wellness-field"><label>GLUCIDE G</label><input type="number" step="0.1" inputmode="decimal" id="foodCarbs"></div>
                  <div class="wellness-field"><label>LIPIDE G</label><input type="number" step="0.1" inputmode="decimal" id="foodFat"></div>
                </div>
                <div class="wellness-field" style="margin-top:9px"><label>OBSERVAȚIE / PRECIZIE</label><textarea id="foodNote" rows="2"></textarea></div>
                <button class="wellness-save" id="foodSave" type="button">SALVEAZĂ ALIMENTUL</button>
              </div>

              <div class="wellness-card">
                <h3>Pareto 80%</h3>
                <p>Alimentele care generează aproximativ 80% din fiecare macronutrient consumat.</p>
                <div class="pareto" id="paretoList"></div>
              </div>

              <div class="wellness-card">
                <h3>Alimentele zilei</h3>
                <div class="meal-list" id="mealList"></div>
              </div>
            </section>

            <section class="wellness-panel" data-wellness-panel="body" hidden>
              <div class="wellness-card">
                <h3>Măsurători corporale</h3>
                <p>Poți introduce masa rapid sau poți fotografia captura aplicației cântarului.</p>
                <div class="camera-row">
                  <label class="camera-file">📱 CAPTURĂ APLICAȚIE CÂNTAR<input type="file" accept="image/*" id="scalePhoto"></label>
                  <img class="camera-preview" id="scalePreview" alt="Previzualizare cântar">
                </div>
                <button class="wellness-ai" id="scaleAnalyze" type="button">🐾 CITEȘTE CAPTURA</button>
                <div class="body-result" id="scaleResult" hidden></div>
                <div class="wellness-grid" style="margin-top:10px">
                  <div class="wellness-field"><label>MASĂ KG</label><input type="number" step="0.1" inputmode="decimal" id="bodyWeight"></div>
                  <div class="wellness-field"><label>GRĂSIME %</label><input type="number" step="0.1" inputmode="decimal" id="bodyFat"></div>
                  <div class="wellness-field"><label>MASĂ MUSCULARĂ KG</label><input type="number" step="0.1" inputmode="decimal" id="bodyMuscle"></div>
                  <div class="wellness-field"><label>APĂ CORPORALĂ %</label><input type="number" step="0.1" inputmode="decimal" id="bodyWater"></div>
                  <div class="wellness-field"><label>GRĂSIME VISCERALĂ</label><input type="number" step="0.1" inputmode="decimal" id="bodyVisceral"></div>
                  <div class="wellness-field"><label>METABOLISM BAZAL KCAL</label><input type="number" inputmode="numeric" id="bodyBmr"></div>
                  <div class="wellness-field"><label>VÂRSTĂ METABOLICĂ</label><input type="number" inputmode="numeric" id="bodyMetAge"></div>
                  <div class="wellness-field"><label>OBSERVAȚII</label><input id="bodyNote"></div>
                </div>
                <button class="wellness-save" id="bodySave" type="button">SALVEAZĂ MĂSURĂTORILE</button>
              </div>

              <div class="wellness-card">
                <h3>Ținte zilnice</h3>
                <div class="wellness-grid">
                  <div class="wellness-field"><label>ENERGIE KCAL</label><input type="number" id="targetCalories"></div>
                  <div class="wellness-field"><label>PROTEINE G</label><input type="number" id="targetProtein"></div>
                  <div class="wellness-field"><label>GLUCIDE G</label><input type="number" id="targetCarbs"></div>
                  <div class="wellness-field"><label>LIPIDE G</label><input type="number" id="targetFat"></div>
                  <div class="wellness-field"><label>APĂ ML</label><input type="number" id="targetWater"></div>
                </div>
                <div class="targets-note">Țintele sunt editabile. Le ajustăm după evoluția masei, antrenamente și obiectiv, fără să schimbăm automat valorile fără confirmarea ta.</div>
                <button class="wellness-save" id="targetsSave" type="button">SALVEAZĂ ȚINTELE</button>
              </div>
            </section>
          </div>
        </div>
      </div>`;
  }

  function setTab(tab) {
    activeTab = ['sleep', 'water', 'food', 'body'].includes(tab) ? tab : 'sleep';
    document.querySelectorAll('[data-wellness-tab]').forEach(button => {
      button.classList.toggle('on', button.dataset.wellnessTab === activeTab);
    });
    document.querySelectorAll('[data-wellness-panel]').forEach(panel => {
      panel.hidden = panel.dataset.wellnessPanel !== activeTab;
    });
  }

  function openModal(tab) {
    activeDate = todayKey();
    byId('wellnessDate').value = activeDate;
    setTab(tab);
    renderAll();
    byId('wellnessModal').hidden = false;
    document.body.style.overflow = 'hidden';
    const menuPanel = byId('menuPanel');
    const menuToggle = byId('menuToggle');
    if (menuPanel) menuPanel.hidden = true;
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = 'MENU ☰';
    }
  }

  function closeModal() {
    byId('wellnessModal').hidden = true;
    document.body.style.overflow = '';
  }

  function renderAll() {
    const day = loadDay();
    const targets = loadTargets();
    const sums = totals(day);

    byId('wellnessDate').value = activeDate;
    byId('sumSleep').textContent = day.sleep.minutes ? formatDuration(day.sleep.minutes) : '—';
    byId('sumWater').textContent = `${Math.round(num(day.waterMl))} ml`;
    byId('sumCalories').textContent = `${Math.round(sums.calories)} kcal`;
    byId('sumWeight').textContent = num(day.measurements.weightKg) ? `${round1(day.measurements.weightKg)} kg` : '—';

    byId('sleepBed').value = day.sleep.bed || '';
    byId('sleepWake').value = day.sleep.wake || '';
    byId('sleepQuality').value = String(day.sleep.quality || 3);
    byId('sleepAwakenings').value = day.sleep.awakenings ?? 0;
    byId('sleepResult').textContent = `Durată: ${formatDuration(calculateSleepMinutes(byId('sleepBed').value, byId('sleepWake').value))}`;

    byId('waterTotal').textContent = `${Math.round(num(day.waterMl))} ml`;
    byId('waterTargetText').textContent = `din ${Math.round(targets.water)} ml`;

    const progressRows = [
      ['Energie', sums.calories, targets.calories, 'kcal'],
      ['Proteine', sums.protein, targets.protein, 'g'],
      ['Glucide', sums.carbs, targets.carbs, 'g'],
      ['Lipide', sums.fat, targets.fat, 'g']
    ];
    byId('nutritionProgress').innerHTML = progressRows.map(([label, value, target, unit]) => `
      <div class="progress-row"><span>${label}</span><div class="progress-track"><div class="progress-fill" style="width:${progress(value, target).toFixed(1)}%"></div></div><strong>${round1(value)} / ${round1(target)} ${unit}</strong></div>
    `).join('');

    byId('paretoList').innerHTML = `
      <div class="pareto-row"><b>Proteine:</b> ${esc(paretoNames(day.meals, 'protein'))}</div>
      <div class="pareto-row"><b>Glucide:</b> ${esc(paretoNames(day.meals, 'carbs'))}</div>
      <div class="pareto-row"><b>Lipide:</b> ${esc(paretoNames(day.meals, 'fat'))}</div>`;

    byId('mealList').innerHTML = day.meals.length ? day.meals
      .slice()
      .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
      .map(meal => `
        <div class="meal-item" data-meal-id="${esc(meal.id)}">
          <div><b>${esc(meal.time || '')} · ${esc(meal.name || 'Aliment')}</b><span>${round1(meal.calories)} kcal · P ${round1(meal.protein)} g · G ${round1(meal.carbs)} g · L ${round1(meal.fat)} g${meal.note ? ` · ${esc(meal.note)}` : ''}</span></div>
          <button class="meal-delete" type="button" data-delete-meal="${esc(meal.id)}">ȘTERGE</button>
        </div>`).join('')
      : '<div class="pareto-row">Nu ai salvat încă alimente pentru această zi.</div>';

    document.querySelectorAll('[data-delete-meal]').forEach(button => {
      button.addEventListener('click', () => {
        const current = loadDay();
        current.meals = current.meals.filter(meal => meal.id !== button.dataset.deleteMeal);
        saveDay(current, 'Aliment șters');
      });
    });

    const m = day.measurements;
    byId('bodyWeight').value = m.weightKg ?? '';
    byId('bodyFat').value = m.bodyFatPct ?? '';
    byId('bodyMuscle').value = m.muscleMassKg ?? '';
    byId('bodyWater').value = m.bodyWaterPct ?? '';
    byId('bodyVisceral').value = m.visceralFat ?? '';
    byId('bodyBmr').value = m.bmrKcal ?? '';
    byId('bodyMetAge').value = m.metabolicAge ?? '';
    byId('bodyNote').value = m.note ?? '';

    byId('targetCalories').value = targets.calories;
    byId('targetProtein').value = targets.protein;
    byId('targetCarbs').value = targets.carbs;
    byId('targetFat').value = targets.fat;
    byId('targetWater').value = targets.water;
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Alege o imagine validă.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Imaginea nu a putut fi citită.'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imaginea nu a putut fi deschisă.'));
      img.src = dataUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function getAiPin() {
    let pin = localStorage.getItem('salaAiPin') || '';
    if (!pin) {
      pin = (prompt('Introdu PIN-ul SALA FIT AI. Rămâne salvat numai pe acest dispozitiv.') || '').trim();
      if (pin) localStorage.setItem('salaAiPin', pin);
    }
    return pin;
  }

  async function analyzeImage(mode, image, context = {}) {
    const pin = getAiPin();
    if (!pin) throw new Error('Analiza a fost anulată.');
    const response = await fetch('/api/wellness-vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, mode, image, context })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) localStorage.removeItem('salaAiPin');
      throw new Error(payload.error || `Eroare server ${response.status}`);
    }
    return payload.result || {};
  }

  function nullableValue(value) {
    return value == null ? '' : round1(value);
  }

  function bindEvents() {
    document.querySelectorAll('[data-open-wellness]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        openModal(button.dataset.openWellness || 'sleep');
      });
    });
    document.querySelectorAll('[data-wellness-tab]').forEach(button => {
      button.addEventListener('click', () => setTab(button.dataset.wellnessTab));
    });

    byId('wellnessClose').addEventListener('click', closeModal);
    byId('wellnessModal').addEventListener('click', event => {
      if (event.target === byId('wellnessModal')) closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !byId('wellnessModal').hidden) closeModal();
    });
    byId('wellnessToday').addEventListener('click', () => {
      activeDate = todayKey();
      renderAll();
    });
    byId('wellnessDate').addEventListener('change', event => {
      activeDate = event.target.value || todayKey();
      renderAll();
    });

    ['sleepBed', 'sleepWake'].forEach(id => {
      byId(id).addEventListener('input', () => {
        byId('sleepResult').textContent = `Durată: ${formatDuration(calculateSleepMinutes(byId('sleepBed').value, byId('sleepWake').value))}`;
      });
    });
    byId('sleepSave').addEventListener('click', () => {
      const day = loadDay();
      const minutes = calculateSleepMinutes(byId('sleepBed').value, byId('sleepWake').value);
      if (!minutes) {
        alert('Completează ore valide de culcare și trezire.');
        return;
      }
      day.sleep = {
        bed: byId('sleepBed').value,
        wake: byId('sleepWake').value,
        quality: num(byId('sleepQuality').value),
        awakenings: Math.max(0, num(byId('sleepAwakenings').value)),
        minutes
      };
      saveDay(day, 'Somnul a fost salvat');
    });

    document.querySelectorAll('[data-water-add]').forEach(button => {
      button.addEventListener('click', () => {
        const day = loadDay();
        day.waterMl = Math.max(0, num(day.waterMl) + num(button.dataset.waterAdd));
        saveDay(day, `+${button.dataset.waterAdd} ml apă`);
      });
    });
    byId('waterCustomAdd').addEventListener('click', () => {
      const amount = Math.max(0, num(byId('waterCustom').value));
      if (!amount) return;
      const day = loadDay();
      day.waterMl = Math.max(0, num(day.waterMl) + amount);
      byId('waterCustom').value = '';
      saveDay(day, `+${Math.round(amount)} ml apă`);
    });
    byId('waterReset').addEventListener('click', () => {
      if (!confirm('Resetăm apa înregistrată pentru această zi?')) return;
      const day = loadDay();
      day.waterMl = 0;
      saveDay(day, 'Apa zilei a fost resetată');
    });

    byId('foodPhoto').addEventListener('change', async event => {
      try {
        pendingFoodImage = await compressImage(event.target.files?.[0]);
        byId('foodPreview').src = pendingFoodImage;
        byId('foodPreview').classList.add('on');
      } catch (error) {
        alert(error.message);
      }
    });
    byId('foodAnalyze').addEventListener('click', async () => {
      if (!pendingFoodImage) {
        alert('Fă mai întâi fotografia alimentului sau a etichetei.');
        return;
      }
      const button = byId('foodAnalyze');
      button.disabled = true;
      button.textContent = 'Motanul citește fotografia…';
      try {
        const result = await analyzeImage('food', pendingFoodImage, {
          source: byId('foodSource').value,
          quantity: byId('foodQuantity').value.trim()
        });
        byId('foodName').value = result.name || '';
        byId('foodTime').value = timeNow();
        byId('foodCalories').value = round1(result.calories_kcal);
        byId('foodProtein').value = round1(result.protein_g);
        byId('foodCarbs').value = round1(result.carbs_g);
        byId('foodFat').value = round1(result.fat_g);
        byId('foodNote').value = [
          result.serving_description,
          `Încredere ${result.confidence || 'nespecificată'}`,
          result.warning,
          result.details
        ].filter(Boolean).join(' · ');
        byId('foodAiNote').textContent = 'Analiza este completată. Verifică valorile și apasă SALVEAZĂ ALIMENTUL.';
      } catch (error) {
        byId('foodAiNote').textContent = `Analiza nu a reușit: ${error.message}`;
      } finally {
        button.disabled = false;
        button.textContent = '🐾 ANALIZEAZĂ FOTOGRAFIA';
      }
    });
    byId('foodSave').addEventListener('click', () => {
      const name = byId('foodName').value.trim();
      if (!name) {
        alert('Completează denumirea alimentului.');
        return;
      }
      const day = loadDay();
      day.meals.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: byId('foodTime').value || timeNow(),
        name,
        quantity: byId('foodQuantity').value.trim(),
        calories: round1(byId('foodCalories').value),
        protein: round1(byId('foodProtein').value),
        carbs: round1(byId('foodCarbs').value),
        fat: round1(byId('foodFat').value),
        note: byId('foodNote').value.trim(),
        source: byId('foodSource').value,
        createdAt: new Date().toISOString()
      });
      ['foodName', 'foodCalories', 'foodProtein', 'foodCarbs', 'foodFat', 'foodNote', 'foodQuantity'].forEach(id => { byId(id).value = ''; });
      byId('foodTime').value = timeNow();
      pendingFoodImage = '';
      byId('foodPreview').src = '';
      byId('foodPreview').classList.remove('on');
      byId('foodPhoto').value = '';
      byId('foodAiNote').textContent = 'Fotografia nu este păstrată în jurnalul aplicației.';
      saveDay(day, 'Alimentul a fost salvat');
    });

    byId('scalePhoto').addEventListener('change', async event => {
      try {
        pendingScaleImage = await compressImage(event.target.files?.[0]);
        byId('scalePreview').src = pendingScaleImage;
        byId('scalePreview').classList.add('on');
      } catch (error) {
        alert(error.message);
      }
    });
    byId('scaleAnalyze').addEventListener('click', async () => {
      if (!pendingScaleImage) {
        alert('Alege mai întâi captura aplicației cântarului.');
        return;
      }
      const button = byId('scaleAnalyze');
      button.disabled = true;
      button.textContent = 'Motanul citește captura…';
      try {
        const result = await analyzeImage('scale', pendingScaleImage);
        byId('bodyWeight').value = nullableValue(result.weight_kg);
        byId('bodyFat').value = nullableValue(result.body_fat_pct);
        byId('bodyMuscle').value = nullableValue(result.muscle_mass_kg);
        byId('bodyWater').value = nullableValue(result.body_water_pct);
        byId('bodyVisceral').value = nullableValue(result.visceral_fat);
        byId('bodyBmr').value = result.bmr_kcal == null ? '' : Math.round(result.bmr_kcal);
        byId('bodyMetAge').value = result.metabolic_age == null ? '' : Math.round(result.metabolic_age);
        const resultBox = byId('scaleResult');
        resultBox.hidden = false;
        resultBox.textContent = [
          `Încredere: ${result.confidence || 'nespecificată'}`,
          result.warning,
          result.details
        ].filter(Boolean).join(' · ');
      } catch (error) {
        const resultBox = byId('scaleResult');
        resultBox.hidden = false;
        resultBox.textContent = `Citirea nu a reușit: ${error.message}`;
      } finally {
        button.disabled = false;
        button.textContent = '🐾 CITEȘTE CAPTURA';
      }
    });
    byId('bodySave').addEventListener('click', () => {
      const day = loadDay();
      day.measurements = {
        weightKg: byId('bodyWeight').value,
        bodyFatPct: byId('bodyFat').value,
        muscleMassKg: byId('bodyMuscle').value,
        bodyWaterPct: byId('bodyWater').value,
        visceralFat: byId('bodyVisceral').value,
        bmrKcal: byId('bodyBmr').value,
        metabolicAge: byId('bodyMetAge').value,
        note: byId('bodyNote').value.trim()
      };
      saveDay(day, 'Măsurătorile au fost salvate');
    });
    byId('targetsSave').addEventListener('click', saveTargets);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', modalHtml());
    byId('foodTime').value = timeNow();
    bindEvents();
    renderAll();
    setTab(activeTab);
    const version = byId('version');
    if (version) version.textContent = `Versiunea ${WELLNESS_VERSION}`;
    localStorage.setItem('fitAppVersion', WELLNESS_VERSION);
  });
})();