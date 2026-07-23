'use strict';

function localizedDecimal(value){
  const text=String(value??'').trim();
  return /^-?\d+\.\d+$/.test(text)?text.replace('.',','):text;
}

createCsv=function(day,data,date){
  const rows=[['Data','Zi','Ordine','Exercitiu','Parte','Kg','Set 1','Set 2','Set 3','RIR','Durere','Finalizat','Observatii']];
  PROGRAM[day].forEach((ex,index)=>{
    const row=data[index]||{};
    const complete=row.done||isComplete(row,ex);
    const kg=localizedDecimal(row.kg??ex.kg);
    rows.push([date,day,index+1,ex.name,ex.side||'Bilateral',kg,ex.sets===2?'X':row.s1||'',row.s2||'',row.s3||'',row.rir??2,row.pain??0,complete?'DA':'NU',row.note||'']);
  });
  rows.push([date,day,'OPTIONAL','OPTIONAL','','','','','','','','',data.optional||'']);
  return '\ufeff'+rows.map(row=>row.map(quoteCsv).join(';')).join('\r\n');
};

document.querySelector('#version').textContent='Versiunea 1.1.3';
localStorage.setItem('fitAppVersion','1.1.3');
