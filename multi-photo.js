'use strict';

(() => {
  const MULTI_PHOTO_VERSION = '1.4.1';
  const MAX_PHOTOS = 5;
  const MAX_TOTAL_DATA_LENGTH = 10_000_000;

  const byId = id => document.getElementById(id);
  const round1 = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Math.round((Number.isFinite(parsed) ? parsed : 0) * 10) / 10;
  };

  function timeNow() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  async function imageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Fotografia nu a putut fi deschisă.'));
      image.src = dataUrl;
    });
  }

  function resizeImage(image, maxSide = 1200, quality = 0.72) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Alege numai fotografii valide.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Fotografia nu a putut fi citită.'));
      reader.readAsDataURL(file);
    });
    const image = await imageFromDataUrl(dataUrl);
    return resizeImage(image);
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
    const photoRow = oldInput?.closest('.camera-row');
    const pickerLabel = oldInput?.closest('.camera-file');
    if (!oldInput || !oldAnalyze || !preview || !saveButton || !photoRow || !pickerLabel) return;

    let images = [];
    let cameraStream = null;
    let capturedImage = '';

    const input = oldInput.cloneNode(true);
    input.multiple = true;
    input.setAttribute('multiple', '');
    input.removeAttribute('capture');
    oldInput.replaceWith(input);

    pickerLabel.replaceChildren(document.createTextNode('🖼️ ALEGE UNA SAU MAI MULTE POZE'), input);
    pickerLabel.classList.add('multi-picker-label');

    const cameraOpen = document.createElement('button');
    cameraOpen.id = 'foodCameraOpen';
    cameraOpen.type = 'button';
    cameraOpen.className = 'photo-camera-open';
    cameraOpen.textContent = '📷 FĂ POZĂ';
    photoRow.insertBefore(cameraOpen, pickerLabel);

    const analyzeButton = oldAnalyze.cloneNode(true);
    oldAnalyze.replaceWith(analyzeButton);
    analyzeButton.textContent = '🐾 ANALIZEAZĂ FOTOGRAFIILE';

    preview.hidden = true;
    preview.classList.remove('on');

    const gallery = document.createElement('div');
    gallery.id = 'foodPhotoGallery';
    gallery.className = 'multi-photo-gallery';
    photoRow.insertAdjacentElement('afterend', gallery);

    const helper = document.createElement('div');
    helper.className = 'multi-photo-help';
    helper.textContent = 'Poți adăuga până la 5 fotografii ale aceluiași produs: față, ingrediente, cantitate și tabel nutrițional.';
    gallery.insertAdjacentElement('afterend', helper);

    const cameraModal = document.createElement('div');
    cameraModal.id = 'fitCameraModal';
    cameraModal.className = 'fit-camera-modal';
    cameraModal.hidden = true;
    cameraModal.innerHTML = `
      <div class="fit-camera-card" role="dialog" aria-modal="true" aria-label="Cameră aliment">
        <div class="fit-camera-title"><b>FOTOGRAFIE PRODUS</b><span id="cameraCount">Poza 1 din ${MAX_PHOTOS}</span></div>
        <div class="fit-camera-stage">
          <video id="fitCameraVideo" autoplay playsinline muted></video>
          <img id="fitCameraCaptured" alt="Fotografia realizată" hidden>
        </div>
        <div class="fit-camera-actions">
          <button class="camera-close-button" id="fitCameraClose" type="button">ÎNCHIDE</button>
          <button class="camera-capture-button" id="fitCameraCapture" type="button">📸 CAPTUREAZĂ</button>
          <button class="camera-retake-button" id="fitCameraRetake" type="button" hidden>↻ REÎNCEARCĂ</button>
          <button class="camera-ok-button" id="fitCameraAccept" type="button" hidden>✓ OK, ADAUGĂ POZA</button>
        </div>
      </div>`;
    document.body.appendChild(cameraModal);

    const video = byId('fitCameraVideo');
    const capturedPreview = byId('fitCameraCaptured');
    const captureButton = byId('fitCameraCapture');
    const retakeButton = byId('fitCameraRetake');
    const acceptButton = byId('fitCameraAccept');
    const closeCameraButton = byId('fitCameraClose');

    const style = document.createElement('style');
    style.textContent = `
      .camera-row:has(#foodPhoto){display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:stretch}
      .multi-picker-label,.photo-camera-open{width:100%;min-height:52px;border-radius:13px;padding:12px 10px;font-weight:950;text-align:center;display:flex;align-items:center;justify-content:center}
      .multi-picker-label{background:#4c1d95!important;border:1px solid #8b5cf6!important;color:#fff!important}
      .photo-camera-open{background:#1d4ed8;border:1px solid #60a5fa;color:#fff}
      .multi-photo-gallery{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;width:100%;margin-top:9px}
      .multi-photo-item{position:relative;aspect-ratio:1/1;border:1px solid #475569;border-radius:12px;overflow:hidden;background:#07101f}
      .multi-photo-item img{width:100%;height:100%;object-fit:cover;display:block}
      .multi-photo-number{position:absolute;left:4px;bottom:4px;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:#020617dd;color:#fff;font-size:12px;font-weight:950;display:grid;place-items:center}
      .multi-photo-remove{position:absolute;right:4px;top:4px;width:29px;height:29px;padding:0;border:1px solid #fecaca;border-radius:50%;background:#b91c1c;color:#fff;font-weight:950;line-height:27px}
      .multi-photo-help{margin-top:8px;color:#cbd5e1;font-size:11px;line-height:1.35}
      .fit-camera-modal{position:fixed;inset:0;z-index:10050;padding:12px;background:rgba(2,6,23,.96);display:grid;place-items:center}
      .fit-camera-modal[hidden]{display:none}
      .fit-camera-card{width:min(100%,680px);background:#0f172a;border:1px solid #475569;border-radius:22px;padding:12px;box-shadow:0 22px 70px rgba(0,0,0,.65)}
      .fit-camera-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 3px 10px;color:#fff}.fit-camera-title span{color:#cbd5e1;font-size:12px}
      .fit-camera-stage{position:relative;width:100%;min-height:48vh;max-height:68vh;overflow:hidden;border-radius:16px;background:#000;display:grid;place-items:center}
      .fit-camera-stage video,.fit-camera-stage img{width:100%;height:100%;max-height:68vh;object-fit:contain;background:#000}
      .fit-camera-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin-top:10px}
      .fit-camera-actions button{min-height:54px;border-radius:14px;padding:11px 8px;font-weight:1000;font-size:15px}
      .camera-close-button{background:#334155;border:1px solid #64748b;color:#fff}
      .camera-capture-button{background:#2563eb;border:1px solid #93c5fd;color:#fff}
      .camera-retake-button{background:#f59e0b;border:1px solid #fde68a;color:#1c1917}
      .camera-ok-button{background:#16a34a;border:1px solid #86efac;color:#fff}
      .camera-retake-button[hidden],.camera-ok-button[hidden],.camera-capture-button[hidden]{display:none}
      @media(max-width:500px){.multi-photo-gallery{grid-template-columns:repeat(3,1fr)}.fit-camera-stage{min-height:52vh}.fit-camera-actions{grid-template-columns:1fr 1fr}.camera-row:has(#foodPhoto){grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    function noteText() {
      return images.length
        ? `${images.length} fotografie${images.length === 1 ? '' : 'i'} pregătită${images.length === 1 ? '' : 'e'}. Toate vor fi citite ca același produs.`
        : 'Fotografiile nu sunt păstrate în jurnalul aplicației.';
    }

    function renderGallery() {
      gallery.innerHTML = images.map((image, index) => `
        <div class="multi-photo-item">
          <img src="${image}" alt="Etichetă ${index + 1}">
          <span class="multi-photo-number">${index + 1}</span>
          <button class="multi-photo-remove" type="button" data-remove-photo="${index}" aria-label="Șterge fotografia ${index + 1}">×</button>
        </div>`).join('');

      gallery.querySelectorAll('[data-remove-photo]').forEach(button => {
        button.addEventListener('click', () => {
          images.splice(Number(button.dataset.removePhoto), 1);
          renderGallery();
          byId('foodAiNote').textContent = noteText();
        });
      });
    }

    function stopCamera() {
      cameraStream?.getTracks().forEach(track => track.stop());
      cameraStream = null;
      video.srcObject = null;
      cameraModal.hidden = true;
      document.body.style.overflow = '';
      capturedImage = '';
    }

    function showLiveCamera() {
      capturedImage = '';
      video.hidden = false;
      capturedPreview.hidden = true;
      capturedPreview.src = '';
      captureButton.hidden = false;
      retakeButton.hidden = true;
      acceptButton.hidden = true;
    }

    async function openCamera() {
      if (images.length >= MAX_PHOTOS) {
        alert(`Ai ajuns la maximum ${MAX_PHOTOS} fotografii pentru acest produs.`);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Camera directă nu este disponibilă aici. Folosește butonul ALEGE POZE.');
        return;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        byId('cameraCount').textContent = `Poza ${images.length + 1} din ${MAX_PHOTOS}`;
        video.srcObject = cameraStream;
        showLiveCamera();
        cameraModal.hidden = false;
        document.body.style.overflow = 'hidden';
      } catch {
        alert('Nu am putut deschide camera. Verifică permisiunea camerei sau folosește ALEGE POZE.');
      }
    }

    function capturePhoto() {
      if (!video.videoWidth || !video.videoHeight) return;
      const scale = Math.min(1, 1200 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedImage = canvas.toDataURL('image/jpeg', 0.72);
      capturedPreview.src = capturedImage;
      capturedPreview.hidden = false;
      video.hidden = true;
      captureButton.hidden = true;
      retakeButton.hidden = false;
      acceptButton.hidden = false;
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
        note.textContent = noteText();
      } catch (error) {
        note.textContent = error.message;
        alert(error.message);
      }
    });

    cameraOpen.addEventListener('click', openCamera);
    closeCameraButton.addEventListener('click', stopCamera);
    cameraModal.addEventListener('click', event => {
      if (event.target === cameraModal) stopCamera();
    });
    captureButton.addEventListener('click', capturePhoto);
    retakeButton.addEventListener('click', showLiveCamera);
    acceptButton.addEventListener('click', () => {
      if (!capturedImage) return;
      images.push(capturedImage);
      renderGallery();
      byId('foodAiNote').textContent = noteText();
      stopCamera();
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
        const response = await fetch('/api/wellness-vision-multi', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pin,
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

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !cameraModal.hidden) stopCamera();
    });

    const version = byId('version');
    if (version) version.textContent = `Versiunea ${MULTI_PHOTO_VERSION}`;
    localStorage.setItem('fitAppVersion', MULTI_PHOTO_VERSION);
  });
})();