'use strict';

(() => {
  const VERSION = '1.4.5';
  const ex = (name, kg, step, sets, min, max, rest, video, extra = {}) => ({ name, kg, step, sets, min, max, rest, video, ...extra });

  PROGRAM.A = [
    ex('Împins la piept la aparat',35,5,3,8,12,120,'machine chest press proper form'),
    ex('Tracțiuni la helcometru - priză neutră',45,5,3,8,12,120,'neutral grip lat pulldown proper form'),
    ex('Împins înclinat cu gantere',12,2,3,8,12,120,'incline dumbbell press proper form'),
    ex('Ramat la cablu din șezut',50,5,3,8,12,120,'seated cable row proper form'),
    ex('Flexii biceps cu gantere',12,2,3,10,15,75,'dumbbell biceps curl proper form'),
    ex('Extensii triceps cu frânghia',20,5,3,10,15,75,'rope triceps pushdown proper form'),
    ex('Crunch la cablu pentru abdomen',25,5,3,12,18,60,'kneeling cable crunch proper form')
  ];
  PROGRAM.B = [
    ex('Presa pentru umeri la aparat',30,5,3,8,12,120,'machine shoulder press proper form'),
    ex('Ramat cu pieptul sprijinit',65,5,3,8,12,120,'seated chest supported row machine proper form'),
    ex('Ridicări laterale cu gantere',5,1,3,12,15,75,'dumbbell lateral raise proper form'),
    ex('Face pull la cablu',15,5,3,12,15,75,'face pull cable proper form'),
    ex('Presa pentru picioare - întreținere',120,10,2,10,15,120,'leg press proper form'),
    ex('Flexii femurali la aparat - întreținere',65,5,2,10,15,90,'leg curl machine proper form'),
    ex('Abdomene pe minge mare',0,0,3,15,20,60,'stability ball crunch proper form')
  ];
  PROGRAM.C = [
    ex('Fluturări la aparat pentru piept',35,5,3,10,15,90,'pec deck fly proper form'),
    ex('Tracțiuni la helcometru - priză medie',40,5,3,8,12,120,'lat pulldown proper form'),
    ex('Fandări în mers cu gantere',8,2,3,10,14,90,'walking dumbbell lunges proper form'),
    ex('Flexii ciocan',10,2,3,10,15,75,'hammer curl proper form'),
    ex('Extensii triceps deasupra capului cu frânghia',12.5,2.5,3,10,15,75,'overhead rope triceps extension proper form'),
    ex('Rotiri de trunchi la cablu',15,5,2,10,12,60,'standing cable torso rotation arms extended chest height proper form',{side:'STÂNGA'}),
    ex('Rotiri de trunchi la cablu',15,5,2,10,12,60,'standing cable torso rotation arms extended chest height proper form',{side:'DREAPTA'})
  ];
  PROGRAM.D = [
    ex('Extensii lombare la banca de 45°',15,2.5,3,12,15,90,'45 degree back extension weighted proper form'),
    ex('Îndreptări românești cu gantere',12,2,3,10,15,120,'dumbbell romanian deadlift proper form'),
    ex('Pull-through la cablu',20,5,3,12,15,90,'cable pull through glutes proper form'),
    ex('Ramat unilateral la cablu',20,5,3,10,15,90,'single arm cable row proper form',{side:'STÂNGA'}),
    ex('Ramat unilateral la cablu',20,5,3,10,15,90,'single arm cable row proper form',{side:'DREAPTA'}),
    ex('Bird-dog controlat',0,0,2,10,15,60,'bird dog exercise proper form'),
    ex('Ridicări de genunchi pentru abdomen',0,0,3,10,15,60,'captains chair knee raise proper form')
  ];
  PROGRAM.E = [
    ex('Cardio la alegere - minute',0,0,2,10,30,60,'treadmill elliptical stationary bike moderate cardio workout'),
    ex('Mobilitate toracică - rotații',0,0,2,8,12,45,'thoracic rotation mobility exercise proper form'),
    ex('Mobilitate șolduri - 90/90',0,0,2,8,12,45,'90 90 hip mobility proper form'),
    ex('Cat-cow pentru coloană',0,0,2,10,15,45,'cat cow stretch proper form'),
    ex('Dead bug pentru abdomen',0,0,2,10,15,60,'dead bug exercise proper form')
  ];

  // Migrare sigură a ședințelor D vechi: ramatul bilateral notat pe un singur rând
  // devine STÂNGA + DREAPTA, fără să deplasăm Bird-dog / abdomen.
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!/^fit:\d{4}-\d{2}-\d{2}:D$/.test(key||''))continue;
    try{
      const old=JSON.parse(localStorage.getItem(key)||'{}');
      if(!old || old._dLayoutV145)continue;
      const migrated={...old};
      migrated[3]=old[3]?{...old[3]}:{};
      migrated[4]=old[3]?{...old[3]}:{};
      migrated[5]=old[4]?{...old[4]}:{};
      migrated[6]=old[5]?{...old[5]}:{};
      migrated._dLayoutV145=true;
      localStorage.setItem(key,JSON.stringify(migrated));
    }catch{}
  }

  Object.assign(NEXT,{A:'B',B:'C',C:'D',D:'E',E:'A'});
  historyFor = function(day){
    const out=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i),m=key?.match(/^fit:(\d{4}-\d{2}-\d{2}):([ABCDE])$/);
      if(m&&m[2]===day&&m[1]!==localDate())out.push({date:m[1],data:loadSession(day,m[1])});
    }
    return out.sort((a,b)=>b.date.localeCompare(a.date));
  };

  const previousPrescription = prescription;
  const rotationHistory = {
    'STÂNGA': { kg:15, s1:'X', s2:'20', s3:'12', done:true },
    'DREAPTA': { kg:15, s1:'X', s2:'15', s3:'14', done:true }
  };
  prescription = function(day,index,exercise){
    if(day==='C' && exercise?.name==='Rotiri de trunchi la cablu'){
      const sessions=historyFor(day);
      for(const session of sessions){
        if(session.date<'2026-08-01') continue;
        const row=session?.data?.[index];
        const values=completedReps(row,exercise);
        if(values!==null){
          const kg=parseFloat(row.kg??exercise.kg)||exercise.kg;
          const grow=values.every(value=>value>=exercise.max);
          const average=values.reduce((sum,value)=>sum+value,0)/values.length;
          return {kg:grow?kg+exercise.step:kg,last:row,medal:grow,lastAvg:average};
        }
      }
      const row=rotationHistory[exercise.side];
      const values=completedReps(row,exercise);
      const grow=values.every(value=>value>=exercise.max);
      const average=values.reduce((sum,value)=>sum+value,0)/values.length;
      return {kg:grow?row.kg+exercise.step:row.kg,last:row,medal:grow,lastAvg:average};
    }
    // Pull-through pornește de la 20 kg; istoricul hip thrust nu se folosește pentru progresie.
    if(day==='D' && exercise?.name==='Pull-through la cablu'){
      const sessions=historyFor(day);
      for(const session of sessions){
        if(session.date<'2026-08-19')continue;
        const row=session?.data?.[index];
        const values=completedReps(row,exercise);
        if(values!==null){
          const kg=parseFloat(row.kg??exercise.kg)||exercise.kg;
          const grow=values.every(value=>value>=exercise.max);
          const average=values.reduce((sum,value)=>sum+value,0)/values.length;
          return {kg:grow?kg+exercise.step:kg,last:row,medal:grow,lastAvg:average};
        }
      }
      return {kg:exercise.kg,last:null,medal:false,lastAvg:null};
    }
    return previousPrescription(day,index,exercise);
  };

  award = function(row,exercise,plan){
    const avg=repsAverage(row,exercise),prev=plan.last?repsAverage(plan.last,exercise):null;
    const same=Number(row?.kg??plan.kg)===Number(plan.last?.kg??plan.kg);
    if(avg!==null&&prev!==null&&same&&avg>prev)return{icon:'⭐',text:`Media repetărilor a crescut de la ${prev.toFixed(1)} la ${avg.toFixed(1)}.`};
    if(plan.medal&&avg!==null&&Number(row?.kg)===Number(plan.kg))return{icon:'🏅',text:`Greutatea nouă de ${plan.kg} kg a fost confirmată.`};
    return null;
  };

  const tabs=document.querySelector('.tabs');
  if(tabs){
    tabs.innerHTML=['A','B','C','D','E'].map(d=>`<button class="tab" data-d="${d}">${d}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{currentDay=b.dataset.d;render();}));
  }
  const sub=document.querySelector('.sub');
  if(sub)sub.textContent='Program A / B / C / D + E cardio-mobilitate · maxim 60 minute';
  localStorage.setItem('fitAppVersion',VERSION);
  const show=()=>{const el=document.querySelector('#version');if(el)el.textContent=`Versiunea ${VERSION}`;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{show();render();});else{show();render();}
})();
