'use strict';
const APP_VERSION='1.1.1';
const PROGRAM={
  A:[
    {name:'Împins la piept la aparat',kg:30,sets:3,min:8,max:12,rest:120,decision:'Menține 30 kg; crește numai după 3 seturi curate în țintă.',video:'machine chest press proper form'},
    {name:'Tracțiuni la helcometru - priză neutră',kg:40,sets:3,min:8,max:12,rest:120,decision:'Menține 40 kg; urmărește 3 seturi constante.',video:'neutral grip lat pulldown proper form'},
    {name:'Împins înclinat cu gantere',kg:12,sets:3,min:8,max:12,rest:120,decision:'Gantere de 12 kg fiecare; greutate pară.',video:'incline dumbbell press proper form'},
    {name:'Ramat la cablu din șezut',kg:35,sets:3,min:8,max:12,rest:120,decision:'Menține 35 kg; crește doar cu tehnică curată.',video:'seated cable row proper form'},
    {name:'Flexii biceps cu gantere',kg:12,sets:3,min:10,max:15,rest:75,decision:'Gantere de 12 kg fiecare; fără balans.',video:'dumbbell biceps curl proper form'},
    {name:'Extensii triceps cu frânghia',kg:20,sets:3,min:10,max:15,rest:75,decision:'Menține 20 kg; execuție controlată.',video:'rope triceps pushdown proper form'}
  ],
  B:[
    {name:'Presa pentru umeri la aparat',kg:25,sets:3,min:8,max:12,rest:120,decision:'Menține 25 kg.',video:'machine shoulder press proper form'},
    {name:'Ramat cu pieptul sprijinit',kg:60,sets:3,min:8,max:12,rest:120,decision:'Menține 60 kg.',video:'seated chest supported row machine proper form'},
    {name:'Ridicări laterale cu gantere',kg:5,sets:3,min:12,max:15,rest:75,decision:'Menține 5 kg; control, fără balans.',video:'dumbbell lateral raise proper form'},
    {name:'Face pull la cablu',kg:15,sets:3,min:12,max:15,rest:75,decision:'Menține 15 kg.',video:'face pull cable proper form'},
    {name:'Ridicări din umeri pentru trapez',kg:20,sets:3,min:10,max:15,rest:90,decision:'Menține 20 kg.',video:'dumbbell shrug proper form'},
    {name:'Presa pentru picioare - întreținere',kg:110,sets:2,min:10,max:15,rest:120,decision:'Două seturi; prima căsuță rămâne X.',video:'leg press proper form'},
    {name:'Flexii femurali la aparat - întreținere',kg:60,sets:2,min:10,max:15,rest:90,decision:'Două seturi; prima căsuță rămâne X.',video:'leg curl machine proper form'}
  ],
  C:[
    {name:'Fluturări la aparat pentru piept',kg:35,sets:3,min:10,max:15,rest:90,decision:'Menține 35 kg.',video:'pec deck fly proper form'},
    {name:'Tracțiuni la helcometru - priză medie',kg:40,sets:3,min:8,max:12,rest:120,decision:'Menține 40 kg.',video:'lat pulldown proper form'},
    {name:'Împins la piept - varianta alternativă',kg:35,sets:3,min:8,max:12,rest:120,decision:'Varianta confirmată; menține 35 kg.',video:'converging chest press proper form'},
    {name:'Ramat jos la aparat',kg:45,sets:3,min:8,max:12,rest:120,decision:'Menține 45 kg.',video:'low row machine proper form'},
    {name:'Ridicări laterale la cablu',side:'STÂNGA',kg:5,sets:3,min:10,max:15,rest:75,decision:'Urmărim separat partea stângă.',video:'cable lateral raise proper form'},
    {name:'Ridicări laterale la cablu',side:'DREAPTA',kg:5,sets:3,min:10,max:15,rest:75,decision:'Urmărim separat partea dreaptă.',video:'cable lateral raise proper form'},
    {name:'Flexii ciocan',kg:10,sets:3,min:10,max:15,rest:75,decision:'Menține 10 kg.',video:'hammer curl proper form'},
    {name:'Extensii triceps deasupra capului cu frânghia',kg:12.5,sets:3,min:10,max:15,rest:75,decision:'Menține 12,5 kg.',video:'overhead rope triceps extension proper form'},
    {name:'Pallof press',side:'STÂNGA',kg:40,sets:2,min:10,max:12,rest:60,decision:'Două seturi; fără rotație.',video:'pallof press proper form'},
    {name:'Pallof press',side:'DREAPTA',kg:40,sets:2,min:10,max:12,rest:60,decision:'Două seturi; aceeași sarcină ca stânga.',video:'pallof press proper form'}
  ]
};
const NEXT={A:'B',B:'C',C:'A'};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
let currentDay=localStorage.getItem('fitDay')||'B';
let timerId=null;
let waitingWorker=null;
let installPrompt=null;
let startupUpdatePhase=true;

function localDate(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sessionKey(day=currentDay,date=localDate()){return `fit:${date}:${day}`;}
function loadSession(day=currentDay,date=localDate()){
  try{return JSON.parse(localStorage.getItem(sessionKey(day,date))||'{}');}catch{return {};}
}
function saveSession(data,day=currentDay,date=localDate()){
  localStorage.setItem(sessionKey(day,date),JSON.stringify(data));
  showToast('Salvat');
  updateStats();
}
function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function requiredFields(ex){return ex.sets===2?['s2','s3']:['s1','s2','s3'];}
function hasAnyReps(row,ex){return requiredFields(ex).some(k=>String(row?.[k]??'').trim()!=='');}
function isComplete(row,ex){return requiredFields(ex).every(k=>Number.parseInt(row?.[k],10)>0);}
function classFor(row,ex){if(row?.done||isComplete(row,ex))return 'done';if(hasAnyReps(row,ex))return 'partial';return '';}
function setValue(row,ex,n){if(ex.sets===2&&n===1)return 'X';return row?.[`s${n}`]??'';}

function render(){
  localStorage.setItem('fitDay',currentDay);
  $$('.tab').forEach(btn=>btn.classList.toggle('on',btn.dataset.d===currentDay));
  $('#day').textContent=currentDay;
  const data=loadSession();
  const exercises=PROGRAM[currentDay].map((ex,index)=>{
    const row=data[index]||{};
    const done=row.done||isComplete(row,ex);
    return `<article class="ex ${classFor(row,ex)}" data-i="${index}">
      <div class="head"><div class="nr">${index+1}</div><div class="wrap"><div class="name">${esc(ex.name)}</div>${ex.side?`<div class="side">${esc(ex.side)}</div>`:''}</div><a class="video" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video)}">VIDEO ▶</a></div>
      <div class="meta"><span class="pill">${ex.sets} seturi</span><span class="pill">${ex.min}–${ex.max} repetări</span><span class="pill">${ex.rest} sec pauză</span></div>
      <div class="dec">${esc(ex.decision)}</div>
      <div class="grid"><div class="field"><label>KG</label><input data-f="kg" inputmode="decimal" value="${esc(row.kg??ex.kg)}"></div>
        ${[1,2,3].map(n=>`<div class="field"><label>SET ${n}</label><input data-f="s${n}" inputmode="numeric" value="${esc(setValue(row,ex,n))}" ${ex.sets===2&&n===1?'disabled':''}></div>`).join('')}
      </div>
      <div class="row"><div class="field"><label>RIR</label><select data-f="rir">${[0,1,2,3,4,5].map(v=>`<option ${String(v)===String(row.rir??2)?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>DURERE</label><select data-f="pain">${[0,1,2,3,4,5,6,7,8,9,10].map(v=>`<option ${String(v)===String(row.pain??0)?'selected':''}>${v}</option>`).join('')}</select></div><button class="timer" data-t="${ex.rest}">⏱ ${ex.rest}s</button></div>
      <textarea class="notes" data-f="note" placeholder="Observații...">${esc(row.note||'')}</textarea>
      <button class="donebtn ${done?'on':''}" data-done>${done?'✓ FINALIZAT':'MARCAJ FINALIZAT'}</button>
    </article>`;
  }).join('');

  const optional=`<article class="optional-card">
    <div class="optional-head"><div class="nr">+</div><div><div class="name">OPTIONAL LA FINAL</div><div class="optional-sub">Completezi numai când mai faci ceva după programul principal.</div></div></div>
    <textarea class="optional-notes" id="optional" placeholder="Ex.: bandă 10 min, 5 km/h, înclinație 6%; eliptică 12 min; abdomen pe minge 3 × 15; stretching 8 min...">${esc(data.optional||'')}</textarea>
  </article>`;

  $('#list').innerHTML=exercises+optional;

  $$('.ex').forEach(card=>{
    const index=Number(card.dataset.i);
    card.querySelectorAll('[data-f]').forEach(el=>{
      const persist=()=>{
        const data=loadSession();
        data[index]={...(data[index]||{}),[el.dataset.f]:el.value};
        saveSession(data);
        card.className=`ex ${classFor(data[index],PROGRAM[currentDay][index])}`;
      };
      el.addEventListener('input',persist);
      el.addEventListener('change',persist);
    });
    card.querySelector('[data-done]').addEventListener('click',()=>{
      const data=loadSession();
      data[index]={...(data[index]||{}),done:!(data[index]?.done||isComplete(data[index],PROGRAM[currentDay][index]))};
      saveSession(data);
      render();
    });
    card.querySelector('[data-t]').addEventListener('click',event=>startTimer(Number(event.currentTarget.dataset.t),event.currentTarget));
  });

  $('#optional').addEventListener('input',event=>{
    const data=loadSession();
    data.optional=event.currentTarget.value;
    saveSession(data);
  });

  updateStats();
}

function updateStats(){
  const data=loadSession();
  let done=0,volume=0;
  PROGRAM[currentDay].forEach((ex,index)=>{
    const row=data[index]||{};
    if(row.done||isComplete(row,ex))done++;
    const reps=[row.s1,row.s2,row.s3].reduce((sum,value)=>sum+(Number.parseInt(value,10)||0),0);
    volume+=(Number.parseFloat(row.kg??ex.kg)||0)*reps;
  });
  $('#prog').textContent=`${done}/${PROGRAM[currentDay].length}`;
  $('#vol').textContent=Math.round(volume).toLocaleString('ro-RO');
}
function startTimer(seconds,button){
  clearInterval(timerId);
  const end=Date.now()+seconds*1000;
  const original=`⏱ ${seconds}s`;
  timerId=setInterval(()=>{
    const left=Math.max(0,Math.ceil((end-Date.now())/1000));
    button.textContent=left?`⏱ ${left}s`:'GATA!';
    if(!left){clearInterval(timerId);navigator.vibrate?.([200,120,200]);setTimeout(()=>button.textContent=original,1500);}
  },250);
}
function sessionText(day,data,date){
  const lines=[`SALA FIT - ${date} - ZIUA ${day}`];
  PROGRAM[day].forEach((ex,index)=>{
    const row=data[index]||{};
    lines.push(`${index+1}. ${ex.name}${ex.side?' '+ex.side:''} | ${row.kg??ex.kg} kg | ${ex.sets===2?'X/':''}${ex.sets===2?(row.s2||'')+'/'+(row.s3||''):(row.s1||'')+'/'+(row.s2||'')+'/'+(row.s3||'')} | RIR ${row.rir??2} | durere ${row.pain??0}${row.note?' | '+row.note:''}`);
  });
  lines.push(`OPTIONAL: ${String(data.optional||'').trim()||'nimic'}`);
  return lines.join('\n');
}
function quoteCsv(value){return `"${String(value??'').replaceAll('"','""')}"`;}
function createCsv(day,data,date){
  const rows=[['Data','Zi','Ordine','Exercitiu','Parte','Kg','Set 1','Set 2','Set 3','RIR','Durere','Finalizat','Observatii']];
  PROGRAM[day].forEach((ex,index)=>{
    const row=data[index]||{};
    const complete=row.done||isComplete(row,ex);
    rows.push([date,day,index+1,ex.name,ex.side||'Bilateral',row.kg??ex.kg,ex.sets===2?'X':row.s1||'',row.s2||'',row.s3||'',row.rir??2,row.pain??0,complete?'DA':'NU',row.note||'']);
  });
  rows.push([date,day,'OPTIONAL','OPTIONAL','','','','','','','','',data.optional||'']);
  return '\ufeff'+rows.map(row=>row.map(quoteCsv).join(';')).join('\r\n');
}
async function shareCsv(day,data,date){
  const name=`SALA_${date}_${day}.csv`;
  const file=new File([createCsv(day,data,date)],name,{type:'text/csv;charset=utf-8'});
  try{
    if(navigator.canShare?.({files:[file]})){
      await navigator.share({title:`SALA FIT ${day}`,text:`Ședința ${day} din ${date}`,files:[file]});
      showToast('Trimis către Drive');
      return;
    }
  }catch(error){
    if(error?.name==='AbortError'){showToast('Partajare anulată');return;}
  }
  const url=URL.createObjectURL(file);
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  showToast('CSV descărcat');
}
async function finishSession(){
  const button=$('#finish');
  if(button.classList.contains('busy'))return;
  button.classList.add('busy');
  const finishedDay=currentDay;
  const finishedDate=localDate();
  const data=loadSession(finishedDay,finishedDate);
  PROGRAM[finishedDay].forEach((ex,index)=>{
    data[index]={...(data[index]||{}),done:isComplete(data[index]||{},ex)||(data[index]?.done===true)};
  });
  localStorage.setItem(sessionKey(finishedDay,finishedDate),JSON.stringify(data));
  localStorage.setItem('fitLastFinished',JSON.stringify({day:finishedDay,date:finishedDate,at:new Date().toISOString()}));
  currentDay=NEXT[finishedDay];
  localStorage.setItem('fitDay',currentDay);
  render();
  showToast(`Gata ${finishedDay} → urmează ${currentDay}`);
  button.classList.remove('busy');
  await new Promise(resolve=>setTimeout(resolve,250));
  await shareCsv(finishedDay,data,finishedDate);
}
function showToast(message='Salvat'){
  const toast=$('#toast');toast.textContent=message;toast.classList.add('on');clearTimeout(showToast.id);showToast.id=setTimeout(()=>toast.classList.remove('on'),1800);
}
function resetCurrent(){
  if(!confirm(`Ștergi valorile introduse astăzi pentru ziua ${currentDay}?`))return;
  localStorage.removeItem(sessionKey());render();showToast('Resetat');
}

$$('.tab').forEach(button=>button.addEventListener('click',()=>{currentDay=button.dataset.d;render();}));
$('#reset').addEventListener('click',resetCurrent);
$('#copy').addEventListener('click',async()=>{await navigator.clipboard.writeText(sessionText(currentDay,loadSession(),localDate()));showToast('Copiat');});
$('#finish').addEventListener('click',finishSession);
$('#version').textContent=`Versiunea ${APP_VERSION}`;

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').classList.add('on');});
$('#install').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').classList.remove('on');});
window.addEventListener('appinstalled',()=>showToast('Aplicația a fost instalată'));

function activateUpdate(worker){
  waitingWorker=worker;
  worker?.postMessage({type:'SKIP_WAITING'});
}
function offerUpdate(worker){
  waitingWorker=worker;
  if(startupUpdatePhase)activateUpdate(worker);
  else $('#update').classList.add('on');
}
$('#applyUpdate').addEventListener('click',()=>{if(waitingWorker)activateUpdate(waitingWorker);else location.reload();});
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      if(registration.waiting)offerUpdate(registration.waiting);
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(worker);});
      });
      await registration.update();
      setTimeout(()=>{startupUpdatePhase=false;},10000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registration.update();});
      setInterval(()=>registration.update(),60*60*1000);
    }catch(error){
      startupUpdatePhase=false;
      console.warn('Actualizarea automată nu a putut fi verificată.',error);
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
}

// Migrare: prima versiune PWA pornește pe B, deoarece A din 21.07.2026 este deja încheiată.
if(!localStorage.getItem('fitPwaMigrated')){
  localStorage.setItem('fitPwaMigrated',APP_VERSION);
  localStorage.setItem('fitDay','B');
  currentDay='B';
}
localStorage.setItem('fitAppVersion',APP_VERSION);
render();
