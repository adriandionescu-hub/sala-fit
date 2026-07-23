'use strict';

const AI_VERSION='1.2.0';
const aiButton=document.querySelector('#aiAnalyze');
const aiPanel=document.querySelector('#aiPanel');
const aiText=document.querySelector('#aiText');
const aiCopy=document.querySelector('#aiCopy');
const aiClose=document.querySelector('#aiClose');

function hasWorkoutData(data){
  if(!data||typeof data!=='object')return false;
  if(String(data.optional||'').trim())return true;
  return Object.keys(data).some(key=>{
    if(key==='optional')return false;
    const row=data[key]||{};
    return Boolean(row.done||row.note||row.s1||row.s2||row.s3);
  });
}

function targetSession(){
  const today=localDate();
  const current=loadSession(currentDay,today);
  if(hasWorkoutData(current))return {day:currentDay,date:today,data:current};

  try{
    const last=JSON.parse(localStorage.getItem('fitLastFinished')||'null');
    if(last?.day&&last?.date){
      const data=loadSession(last.day,last.date);
      if(hasWorkoutData(data))return {day:last.day,date:last.date,data};
    }
  }catch{}

  return {day:currentDay,date:today,data:current};
}

function sessionPayload(day,date,data){
  return {
    date,
    day,
    optional:String(data.optional||'').trim(),
    exercises:PROGRAM[day].map((ex,index)=>{
      const row=data[index]||{};
      return {
        order:index+1,
        name:ex.name,
        side:ex.side||'Bilateral',
        kg:String(row.kg??ex.kg),
        sets:ex.sets===2?['X',row.s2||'',row.s3||'']:[row.s1||'',row.s2||'',row.s3||''],
        target:`${ex.min}-${ex.max}`,
        rir:Number(row.rir??2),
        pain:Number(row.pain??0),
        completed:Boolean(row.done||isComplete(row,ex)),
        note:String(row.note||'').trim(),
        decision:ex.decision
      };
    })
  };
}

function showAi(message,isError=false){
  aiText.textContent=message;
  aiPanel.hidden=false;
  aiPanel.classList.toggle('error',isError);
  aiPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function runAiAnalysis(){
  const target=targetSession();
  if(!hasWorkoutData(target.data)){
    showAi('Completează măcar un exercițiu sau rubrica opțională înainte de analiză.',true);
    return;
  }

  let pin=localStorage.getItem('salaAiPin')||'';
  if(!pin){
    pin=prompt('Introdu PIN-ul SALA FIT AI. Rămâne salvat numai pe acest dispozitiv.')||'';
    pin=pin.trim();
    if(!pin)return;
    localStorage.setItem('salaAiPin',pin);
  }

  aiButton.disabled=true;
  aiButton.textContent='Motanul analizează…';
  aiPanel.hidden=true;

  try{
    const response=await fetch('/api/analyze',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({pin,session:sessionPayload(target.day,target.date,target.data)})
    });

    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401)localStorage.removeItem('salaAiPin');
      throw new Error(payload.error||`Eroare server ${response.status}`);
    }

    const analysis=String(payload.analysis||'').trim();
    localStorage.setItem(`fitAI:${target.date}:${target.day}`,analysis);
    showAi(analysis,false);
  }catch(error){
    showAi(`Analiza nu a reușit: ${error.message}`,true);
  }finally{
    aiButton.disabled=false;
    aiButton.textContent='🐾 ANALIZĂ AI';
  }
}

aiButton?.addEventListener('click',runAiAnalysis);
aiCopy?.addEventListener('click',async()=>{
  await navigator.clipboard.writeText(aiText.textContent||'');
  showToast('Analiza a fost copiată');
});
aiClose?.addEventListener('click',()=>{aiPanel.hidden=true;});

document.querySelector('#version').textContent=`Versiunea ${AI_VERSION}`;
localStorage.setItem('fitAppVersion',AI_VERSION);
