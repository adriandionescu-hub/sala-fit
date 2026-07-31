'use strict';

(() => {
  const MULTI_PHOTO_VERSION = '1.4.1';
  const MAX_PHOTOS = 4;
  const MAX_TOTAL_DATA_LENGTH = 3_800_000;

  const byId = id => document.getElementById(id);
  const round1 = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Math.round((Number.isFinite(parsed) ? parsed : 0) * 10) / 10;
  };

  function timeNow() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Alege numai fotografii valide.');

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Fotografia nu a putut fi citită.'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Fotografia nu a putut fi deschisă.'));
      img.src = dataUrl;
    });

    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.70);
  }

  function getAiPin() {
    let pin = localStorage.getItem('salaAiPin') || '';
    if (!pin) {
      pin = (prompt('Introdu PIN-ul SALA FIT AI. Rămâne salvat numai pe acest dispozitiv.') || '').trim();
      if (pin) localStorage.setItem('salaAiPin', pin);
    }
    return pin;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const oldInput = byId('foodPhoto');
    const oldAnalyze = byId('foodAnalyze');
    const preview = byId('foodPreview');
    const saveButton = byId('foodSave');
    if (!oldInput || !oldAnalyze || !preview || !saveButton) return;

    let images = [];

    const input = oldInput.cloneNode(true);
    input.multiple = true;
    input.setAttribute('multiple', '');
    oldInput.replaceWith(input);

    const analyzeButton = oldAnalyze.cloneNode(true);
    oldAnalyze.replaceWith(analyzeButton);

    preview.hidden = true;
    preview.classList.remove('on');

    const gallery = document.createElement('div');
    gallery.id = 'foodPhotoGallery';
    gallery.className = 'multi-photo-gallery';
    preview.insertAdjacentElement('afterend', gallery);

    const helper = document.createElement('div');
    helper.className = 'multi-photo-help';
    helper.textContent = 'Poți adăuga până la 4 fotografii ale aceluiași produs: față, ingrediente și tabelele nutriționale.';
    gallery.insertAdjacentElement('afterend', helper);

    const style = document.createElement('style');
    style.textContent = `
      .multi-photo-gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;width:100%;margin-top:9px}
      .multi-photo-item{position:relative;aspect-ratio:1/1;border:1px solid #475569;border-radius:12px;overflow:hidden;background:#07101f}
      .multi-photo-item img{width:100%;height:100%;object-fit:cover;display:block}
      .multi-photo-remove{position:absolute;right:4px;top:4px;width:27px;height:27px;padding:0;border:0;border-radius:50%;background:#7f1d1d;color:#fff;font-weight:950;line-height:27px}
      .multi-photo-help{margin-top:8px;color:#cbd5e1;font-size:11px;line-height:1.35}
      @media(max-width:500px){.multi-photo-gallery{grid-template-columns:repeat(3,1fr)}}
    `;
    document.head.appendChild(style);

    function renderGallery() {
      gallery.innerHTML = images.map((image, index) => `
        <div class="multi-photo-item">
          <img src="${image}" alt="Etichetă ${index + 1}">
          <button class="multi-photo-remove" type="button" data-remove-photo="${index}" aria-label="Șterge fotografia ${index + 1}">×</button>
        </div>`).join('');

      gallery.querySelectorAll('[data-remove-photo]').forEach(button => {
        button.addEventListener('click', () => {
          images.splice(Number(button.dataset.removePhoto), 1);
          renderGallery();
          byId('foodAiNote').textContent = images.length
            ? `${images.length} fotografie${images.length === 1 ? '' : 'i'} pregătită${images.length === 1 ? '' : 'e'} pentru același produs.`
            : 'Fotografiile nu sunt păstrate în jurnalul aplicației.';
        });
      });
    }

    input.addEventListener('change', async event => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
      if (!files.length) return;

      if (images.length + files.length > MAX_PHOTOS) {
        alert(`Poți folosi maximum ${MAX_PHOTOS} fotografii pentru același produs.`);
        return;
      }

      const note = byId('foodAiNote');
      note.textContent = 'Pregătesc fotografiile…';
      try {
        for (const file of files) images.push(await compressImage(file));
        if (images.reduce((sum, image) => sum + image.length, 0) > MAX_TOTAL_DATA_LENGTH) {
          images = [];
          renderGallery();
          throw new Error('Fotografiile sunt prea mari împreună. Repetă-le mai aproape de etichetă.');
        }
        renderGallery();
        note.textContent = `${images.length} fotografie${images.length === 1 ? '' : 'i'} pregătită${images.length === 1 ? '' : 'e'}. Toate vor fi citite ca același produs.`;
      } catch (error) {
        note.textContent = error.message;
        alert(error.message);
      }
    });

    analyzeButton.addEventListener('click', async () => {
      if (!images.length) {
        alert('Adaugă mai întâi una sau mai multe fotografii ale produsului.');
        return;
      }

      const pin = getAiPin();
      if (!pin) return;

      analyzeButton.disabled = true;
      analyzeButton.textContent = `Motanul citește ${images.length} fotografie${images.length === 1 ? '' : 'i'}…`;
      try {
        const response = await fetch('/api/wellness-vision', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pin,
            mode: 'food',
            images,
            context: {
              source: byId('foodSource').value,
              quantity: byId('foodQuantity').value.trim()
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) localStorage.removeItem('salaAiPin');
          throw new Error(payload.error || `Eroare server ${response.status}`);
        }

        const result = payload.result || {};
        byId('foodName').value = result.name || '';
        byId('foodTime').value = timeNow();
        byId('foodCalories').value = round1(result.calories_kcal);
        byId('foodProtein').value = round1(result.protein_g);
        byId('foodCarbs').value = round1(result.carbs_g);
        byId('foodFat').value = round1(result.fat_g);
        byId('foodNote').value = [
          result.serving_description,
          `Încredere ${result.confidence || 'nespecificată'}`,
          `${images.length} fotografie${images.length === 1 ? '' : 'i'} analizată${images.length === 1 ? '' : 'e'}`,
          result.warning,
          result.details
        ].filter(Boolean).join(' · ');
        byId('foodAiNote').textContent = 'Toate fotografiile au fost analizate împreună. Verifică valorile și apasă SALVEAZĂ ALIMENTUL.';
      } catch (error) {
        byId('foodAiNote').textContent = `Analiza nu a reușit: ${error.message}`;
      } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = '🐾 ANALIZEAZĂ FOTOGRAFIILE';
      }
    });

    saveButton.addEventListener('click', () => {
      setTimeout(() => {
        if (byId('foodName').value.trim()) return;
        images = [];
        renderGallery();
        input.value = '';
      }, 0);
    });

    analyzeButton.textContent = '🐾 ANALIZEAZĂ FOTOGRAFIILE';
    const version = byId('version');
    if (version) version.textContent = `Versiunea ${MULTI_PHOTO_VERSION}`;
    localStorage.setItem('fitAppVersion', MULTI_PHOTO_VERSION);
  });
})();