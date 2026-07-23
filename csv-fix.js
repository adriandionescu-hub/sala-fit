'use strict';

const quoteCsvOriginal=quoteCsv;
quoteCsv=function(value){
  const text=String(value??'');
  const localized=/^-?\d+\.\d+$/.test(text.trim())?text.replace('.',','):text;
  return quoteCsvOriginal(localized);
};

document.querySelector('#version').textContent='Versiunea 1.1.2';
localStorage.setItem('fitAppVersion','1.1.2');
