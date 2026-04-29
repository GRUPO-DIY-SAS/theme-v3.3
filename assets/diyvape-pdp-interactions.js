/* ═══════════════════════════════════════════
   DIYVAPE.CO — PDP Interactive Components
   AIDA+SCENE v4 · PRODUCTION BUILD
   Abril 2026
   ═══════════════════════════════════════════ */

/* ── Scroll Reveal ── */
function initRv(){
  var o=new IntersectionObserver(function(entries){
    entries.forEach(function(x){if(x.isIntersecting)x.target.classList.add('vis')});
  },{threshold:0.12});
  document.querySelectorAll('.rv').forEach(function(el){o.observe(el)});
}

/* ── Accordion ── */
function togA(t){
  var i=t.closest('.acc__item');if(!i)return;
  var wasOpen=i.classList.contains('open');
  var acc=i.closest('.acc');
  if(acc)acc.querySelectorAll('.acc__item').forEach(function(x){x.classList.remove('open')});
  if(!wasOpen)i.classList.add('open');
}

/* ── Tabs ── */
function swT(b,id){
  var s=b.closest('.tabs');if(!s)return;
  s.querySelectorAll('.tab-b').forEach(function(x){x.classList.remove('on')});
  s.querySelectorAll('.tab-p').forEach(function(x){x.classList.remove('on')});
  b.classList.add('on');
  var p=document.getElementById(id);if(p)p.classList.add('on');
}

/* ── Timeline ── */
function togT(i){
  var wasOn=i.classList.contains('on');
  var tl=i.closest('.tl');
  if(tl)tl.querySelectorAll('.tl__item').forEach(function(x){x.classList.remove('on')});
  if(!wasOn)i.classList.add('on');
}

/* ── Color Swatches ── */
function pCS(el){
  var s=el.closest('.cs__strip');
  if(s)s.querySelectorAll('.cs__dot').forEach(function(x){x.classList.remove('on')});
  el.classList.add('on');
}

/* ── Resistance Finder ── */
function pR(el){
  document.querySelectorAll('.rc').forEach(function(x){x.classList.remove('on')});
  el.classList.add('on');
}

/* ── Presentation Toggle ── */
function pPres(el){
  var rp=el.closest('.rp');
  if(rp)rp.querySelectorAll('.rp__opt').forEach(function(x){x.classList.remove('on')});
  el.classList.add('on');
}

/* ── Progress Rings ── */
function animRg(){
  document.querySelectorAll('.rg__fl').forEach(function(r){
    var t=parseInt(r.dataset.to)||30;
    r.style.strokeDashoffset=251-(251*((10-t/10)/10));
  });
}

/* ── Flavor Wheel ── */
function pf(el,idx){
  if(!el||typeof flvs==='undefined'||!flvs[idx])return;
  document.querySelectorAll('.wc').forEach(function(c){c.classList.remove('on')});
  el.classList.add('on');
  var fl=flvs[idx];
  var nm=document.getElementById('wNm');if(nm)nm.textContent=fl.nm;
  var dsc=document.getElementById('wDsc');if(dsc)dsc.textContent=fl.desc;
  var bs=[fl.d,fl.f,fl.i,fl.r];
  for(var i=0;i<4;i++){
    var bar=document.getElementById('b'+(i+1));if(bar)bar.style.width=bs[i]+'%';
    var val=document.getElementById('v'+(i+1));if(val)val.textContent=bs[i];
  }
  var c=478;
  var wD=document.getElementById('wD');if(wD)wD.setAttribute('stroke-dasharray',(fl.d/100*c*0.25)+' '+c);
  var wF=document.getElementById('wF');if(wF){wF.setAttribute('stroke-dasharray',(fl.f/100*c*0.25)+' '+c);wF.setAttribute('stroke-dashoffset','-'+(c*0.25));}
  var wI=document.getElementById('wI');if(wI){wI.setAttribute('stroke-dasharray',(fl.i/100*c*0.25)+' '+c);wI.setAttribute('stroke-dashoffset','-'+(c*0.5));}
  var wR=document.getElementById('wR');if(wR){wR.setAttribute('stroke-dasharray',(fl.r/100*c*0.25)+' '+c);wR.setAttribute('stroke-dashoffset','-'+(c*0.75));}
  document.querySelectorAll('.w-fruit').forEach(function(f){f.classList.remove('show')});
  var fri=document.getElementById('wfr-'+fl.fr);if(fri)fri.classList.add('show');
}

/* ── Nicotine Calculator ── */
function uC(){
  var cC=document.getElementById('cC'),cF=document.getElementById('cF');
  if(!cC||!cF)return;
  var cigs=parseInt(cC.value),freq=parseInt(cF.value);
  var cCv=document.getElementById('cCv');if(cCv)cCv.textContent=cigs;
  var labels=['Poco','Moderado','Intenso'];
  var cFv=document.getElementById('cFv');if(cFv)cFv.textContent=labels[freq-1];
  var rec,det;
  if(cigs<=5&&freq<=2){rec='20mg';det='Consumo bajo. 20mg te dara satisfaccion sin exceso.';}
  else if(cigs<=10&&freq<=2){rec='35mg';det='Suficiente para satisfacer sin sobrecargar.';}
  else if(cigs<=15){rec='35mg';det='Buen balance para fumadores regulares.';}
  else if(cigs<=25){rec='50mg';det='Consumo alto. 50mg en menos puffs.';}
  else{rec='50mg';det='Fumador intenso. Empieza con 50mg y ajusta.';}
  var cO=document.getElementById('cO');
  if(cO)cO.innerHTML='Con <strong>'+cigs+' cigarrillos/dia</strong> y uso <strong>'+labels[freq-1].toLowerCase()+'</strong>, te recomendamos <strong>'+rec+'</strong>. '+det;
}

/* ── Compatibility Checker ── */
var cData=[
  {n:'Oxva NeXlim',ok:true},{n:'Oxva Xlim Pro 3',ok:true},{n:'Oxva Xlim 3 Ultra',ok:true},
  {n:'Oxva Xlim Go 2',ok:true},{n:'Oxva Xlim SQ Pro',ok:true},{n:'Oxva Xlim Pro',ok:true},
  {n:'Vaporesso XROS 4',ok:false},{n:'Smok Nord 5',ok:false},{n:'Uwell Caliburn G',ok:false},
  {n:'Voopoo Drag S',ok:false},{n:'Geekvape Aegis Pod',ok:false}
];
function chkC(q){
  var r=document.getElementById('cRes');if(!r)return;
  if(q.length<2){r.innerHTML='';return;}
  var m=cData.filter(function(d){return d.n.toLowerCase().indexOf(q.toLowerCase())!==-1});
  if(!m.length){r.innerHTML='<div style="padding:8px 0;font-size:12px;color:var(--graphite)">No encontrado. Preguntanos por WhatsApp.</div>';return;}
  r.innerHTML=m.map(function(d){return '<div class="compat__item"><span>'+d.n+'</span><span class="compat__badge '+(d.ok?'compat__badge--y':'compat__badge--n')+'">'+(d.ok?'Compatible':'No compatible')+'</span></div>'}).join('');
}

/* ── Init on DOM ready ── */
document.addEventListener('DOMContentLoaded',function(){
  initRv();
  animRg();
  var rgObs=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting)animRg()})},{threshold:0.3});
  document.querySelectorAll('.rg').forEach(function(s){rgObs.observe(s)});
  var fpObs=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting)x.target.querySelectorAll('.fp__m-fl').forEach(function(b){var w=b.dataset.w;if(w)b.style.width=w})})},{threshold:0.3});
  document.querySelectorAll('.fp__mt').forEach(function(s){fpObs.observe(s)});
  document.querySelectorAll('.nv__chip').forEach(function(c){c.addEventListener('click',function(){var s=c.closest('.nv__strip');if(s)s.querySelectorAll('.nv__chip').forEach(function(x){x.classList.remove('on')});c.classList.add('on')})});
  var firstWc=document.querySelector('.wc.on');
  if(firstWc&&typeof flvs!=='undefined')pf(firstWc,0);
});