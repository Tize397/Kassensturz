// Kassensturz – Anzeigen, Bedienung und Start
// Die Dateien werden in dieser Reihenfolge geladen und teilen sich ihre Namen:
// daten.js → erkennung.js → ansichten.js → app.js
'use strict';
/* ---------- Rendern ---------- */
const main=document.getElementById('main');
const header=document.querySelector('header');
const TABS=['monat','beleg','fixkosten','verlauf','mehr'];
function render(){
  if(!booted)return;
  if(ui.locked){if(header)header.hidden=true;main.innerHTML=vLock();const p=document.getElementById('unlock-pin');if(p&&!p.disabled)p.focus();return}
  if(header)header.hidden=false;
  document.querySelectorAll('.tabs a').forEach(a=>a.setAttribute('aria-current',a.dataset.tab===ui.tab?'page':'false'));
  document.getElementById('month-label').textContent=ymLabel(ui.ym);
  let h=(ui.rescue&&ui.snaps&&ui.snaps.length?`<div class="note bad" role="alert"><b>Deine gespeicherten Daten ließen sich nicht lesen.</b> Es gibt eine Sicherheitskopie vom ${esc(fmtD(ui.snaps[0].day.slice(0,10)))} mit ${ui.snaps[0].n} Belegen.<div class="row" style="margin-top:8px"><button class="primary" data-act="snap-yes" data-day="${esc(ui.snaps[0].day)}">Sicherheitskopie zurückholen</button><button class="ghost" data-act="rescue-no">Nein, neu anfangen</button></div></div>`:'')+(storageOk?'':`<div class="note bad"><b>Speichern ist blockiert.</b> Änderungen gehen beim Schließen verloren. Prüfe, ob der Speicher des Handys voll ist, und sichere deine Daten unter „Mehr“.</div>`);
  if(ui.updateAvail) h+=`<div class="note update" role="status"><b>Neue Version ${esc(ui.updateAvail)} verfügbar.</b> ${ui.draft?'Speichere oder verwirf zuerst deinen Beleg, sonst geht er verloren.':'Deine Daten bleiben erhalten.'}${getLock()?' Danach fragt die App einmal nach deiner PIN.':''}
    <div class="row" style="margin-top:8px"><button class="primary" data-act="app-reload">Jetzt laden</button><button class="ghost" data-act="update-later">Später</button></div></div>`;
  h+=ui.tab==='beleg'?vBeleg():ui.tab==='fixkosten'?vFixed():ui.tab==='verlauf'?vVerlauf():ui.tab==='mehr'?vMehr():vMonat();
  if(ui.tut)h+=vTut();
  main.innerHTML=h;
  if(ui.slideDir){const c='slide-'+ui.slideDir;ui.slideDir=null;main.classList.remove('slide-l','slide-r');if(!reduceMotion()){void main.offsetWidth;main.classList.add(c)}}
  document.documentElement.classList.toggle('tut-open',!!ui.tut);
  if(ui.tut){const c=document.getElementById('tut-card');if(c)c.focus({preventScroll:true})}
}
function scrollToHead(id){const n=document.getElementById(id);if(n){const r=n.getBoundingClientRect(),hh=(header&&header.offsetHeight)||0;if(r.top<hh+8||r.top>window.innerHeight*0.6)window.scrollBy({top:r.top-hh-12})}}
function focusForm(id){const n=document.getElementById(id);if(n){const f=n.closest('form')||n;const r=f.getBoundingClientRect(),hh=(header&&header.offsetHeight)||0;if(r.top<hh||r.bottom>window.innerHeight)window.scrollBy({top:r.top-hh-12});n.focus({preventScroll:true})}}
function go(tab){if(location.hash!=='#'+tab){location.hash='#'+tab}else render()}
function route(){const t=(location.hash||'').slice(1);ui.err='';ui.tab=TABS.includes(t)?t:'monat';render();
  if(ui.jumpTo){const id=ui.jumpTo;ui.jumpTo='';setTimeout(()=>scrollToHead(id),0)}}
window.addEventListener('hashchange',()=>{ui.flash=ui.flashNext||'';ui.flashNext='';ui.confirmDel=null;ui.confirmCat=null;window.scrollTo(0,0);route()});

// Neu zeichnen, ohne dass das gerade angetippte Feld seine Eingabe verliert
let rkfTimer=null;
function renderKeepFocus(){
  clearTimeout(rkfTimer);
  rkfTimer=setTimeout(()=>{
    const a=document.activeElement,id=a&&a.id;let ss=null,se=null;
    try{ss=a.selectionStart;se=a.selectionEnd}catch(e){}
    render();
    if(id){const n=document.getElementById(id);if(n){n.focus({preventScroll:true});try{if(ss!=null)n.setSelectionRange(ss,se)}catch(e){}}}
  },0);
}
function updateSums(){
  const d=ui.draft;if(!d)return;
  const sum=d.items.reduce((s,i)=>s+(toNum(i.amount)||0),0);
  const el=document.getElementById('sum');if(el)el.textContent=fmt(d.refund?-sum:sum);
  const df=document.getElementById('diff');if(df)df.textContent=diffText(d.total,sum);
}

// Korrekturen merken: geänderte Namen (Lesefehler), gelöschte Störzeilen, Bauart des Bons
function learnFromDraft(d,items,mk){
  const F=state.rules.fix[mk]=state.rules.fix[mk]||{},D=state.rules.drop[mk]=state.rules.drop[mk]||{};
  d.items.forEach((it,i)=>{const ok=normKey(it.o||''),nk=normKey(items[i]?items[i].name:'');
    if(ok.length>=3&&nk.length>=3&&ok!==nk&&!/^(ARTIKEL|OHNE BEZEICHNUNG)$/.test(ok))F[ok]=items[i].name});
  // Gelöschte Zeile nur als Störzeile merken, wenn sie kein bekanntes Produkt ist und nicht noch einmal im Beleg steht
  (d.removed||[]).forEach(o=>{const k=normKey(o);if(k.length<3||state.rules.products[k]||F[k]||items.some(x=>normKey(x.name)===k)||d.items.some(x=>normKey(x.o||'')===k))return;D[k]=true});
  if(d.below)state.rules.layout[mk]={below:true};
  if(!Object.keys(F).length)delete state.rules.fix[mk];if(!Object.keys(D).length)delete state.rules.drop[mk];
}
function saveDraft(){
  const d=ui.draft;
  const items=d.items.map(i=>{const o={name:i.name.trim()||'Ohne Bezeichnung',amount:toNum(i.amount),cat:i.cat};if(i.tax)o.tax=i.tax;return o});
  const missing=items.filter(i=>!i.cat).length;
  if(missing){ui.err=`${missing} ${missing===1?'Position hat':'Positionen haben'} noch keine Kategorie. Wähle sie aus, dann lässt sich der Beleg speichern.`;render();
    const f=document.querySelector('.p.needs select');if(f)f.focus();return}
  const bad=items.findIndex(i=>isNaN(i.amount));
  if(bad>=0){ui.err=`Der Betrag in Position ${bad+1} ist keine Zahl. Schreibe ihn z. B. als 3,49.`;render();return}
  if(!items.length){ui.err='Der Beleg hat keine Positionen. Füge mindestens eine hinzu.';render();return}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)){ui.err='Bitte ein Datum wählen.';render();return}
  const sign=d.refund?-1:1;
  const recItems=items.map(i=>({...i,amount:r2(sign*Math.abs(i.amount))*(i.amount<0&&!d.refund?-1:1)}));
  const total=recItems.reduce((s,i)=>s+i.amount,0);
  const mk=normKey(d.merchant);
  if(!ui.dupOk&&!d.id){
    const dup=state.receipts.find(r=>r.date===d.date&&normKey(r.merchant)===mk&&Math.abs(rTotal(r)-total)<0.01&&!!r.refund===!!d.refund);
    if(dup){ui.dup=dup;ui.err='';render();return}
  }
  let learned=0;
  items.forEach(i=>{const k=normKey(i.name);if(k.length>=3){if(state.rules.products[k]!==i.cat)learned++;state.rules.products[k]=i.cat;
    if(i.tax)state.rules.tax[k]=i.tax;else delete state.rules.tax[k]}});
  if(mk&&!d.refund){const counts={};items.forEach(i=>counts[i.cat]=(counts[i.cat]||0)+Math.abs(i.amount));
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    state.rules.merchants[mk]={cat:d.always?items[0].cat:top,always:!!d.always}}
  if(d.orig&&mk&&!d.id)learnFromDraft(d,items,mk);
  const rec={id:d.id||uid(),date:d.date,merchant:d.merchant.trim(),items:recItems};
  if(d.refund)rec.refund=true;if(d.refOf)rec.refOf=d.refOf;if(d.pay)rec.pay=d.pay;if(d.pot&&!d.refund&&state.goals.some(g=>g.pot&&g.id===d.pot))rec.pot=d.pot;
  if(!d.refund&&d.open){rec.open=true;rec.due=d.due||''}
  const ix=state.receipts.findIndex(r=>r.id===rec.id);
  if(ix>=0)state.receipts[ix]=rec;else state.receipts.push(rec);
  persist();
  if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}
  let tplMsg='';if(d.asTemplate&&!d.refund){tplMsg=addTemplate(rec)?' · Vorlage gemerkt':'';persist()}
  ui.draft=null;ui.paste='';ui.err='';ui.dup=null;ui.dupOk=false;ui.ym=rec.date.slice(0,7);ui.open=rec.id;
  const msg=(d.refund?'Retoure gespeichert: ':'Beleg gespeichert: ')+fmt(rTotal(rec))+(learned?` · ${learned} ${learned===1?'Zuordnung':'Zuordnungen'} gelernt`:'')+tplMsg;
  if(ui.qTotal>1){ui.qSaved=(ui.qSaved||0)+1;ui.ym=thisYM();if(queueNext())return}
  if(location.hash!=='#monat'){ui.flashNext=msg;location.hash='#monat'}else{ui.flash=msg;render()}
}

function doImport(text){
  try{
    const o=JSON.parse(text);
    if(!o||!Array.isArray(o.receipts)||!Array.isArray(o.fixed)||!Array.isArray(o.categories)) throw new Error();
    state=migrate(o);persist();
    ui.importMsg=`Wiederhergestellt: ${state.receipts.length} Belege, ${state.fixed.length} Fixkosten und Einnahmen, ${Object.keys(state.rules.products).length} gelernte Produkte.`;
  }catch(e){ui.importMsg='Das ist kein gültiges Kassensturz-Backup. Wähle die heruntergeladene Datei oder kopiere den kompletten Backup-Text.'}
  render();
}
function canShareFiles(){try{return !!(navigator.canShare&&navigator.canShare({files:[new File(['x'],'t.txt',{type:'text/plain'})]}))}catch(e){return false}}
function download(name,content,type){
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
}
const csvCell=v=>{v=String(v??'');return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const csvNum=n=>fmtIn(n);
function csv(rows){return '﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')}
function monthRow(ym){const s=monthStats(ym);return [ymLabel(ym),csvNum(s.inc),csvNum(s.out),csvNum(s.fixOut),csvNum(s.varOut),csvNum(s.saved),csvNum(s.left),...state.categories.map(c=>csvNum(s.by[c.id]||0))]}
const MONTH_HEAD=()=>['Monat','Einnahmen','Ausgaben gesamt','Fixkosten','Belege','Gespart','Übrig',...state.categories.map(c=>c.name)];
function markYear(y,part){if(!y)return;const e=state.yearExport[y]=state.yearExport[y]||{};e[part]=true;if(e.csv&&e.tax&&e.backup)e.done=true;persist()}
function exportCsv(kind,year){
  const t=today();let rows,name;
  if(kind==='items'){
    rows=[['Datum','Händler','Position','Kategorie','Betrag','Art','Steuerlich absetzbar']];
    state.receipts.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>r.items.forEach(i=>rows.push([fmtD(r.date),r.merchant,i.name,cat(i.cat).name,csvNum(i.amount),r.refund?'Retoure':'Beleg',i.tax?TAXKINDS[i.tax]:''])));
    name=`kassensturz-belege-${t}.csv`;
  }else if(kind==='fixed'){
    rows=[['Art','Bezeichnung','Kategorie','Betrag','Rhythmus','Pro Monat','Ab','Bis','Steuerlich absetzbar','Mindestlaufzeit bis','Letzter Kündigungstag']];
    state.fixed.forEach(f=>{const c=f.kind!=='in'&&contractInfo(f);rows.push([f.kind==='in'?'Einnahme':'Ausgabe',f.name,f.kind==='in'?'':cat(f.cat).name,csvNum(f.amount),INTERVALS[f.interval],csvNum(shareOf(f)),f.start,f.end,f.tax?TAXKINDS[f.tax]:'',c?fmtD(f.contractEnd):'',c?fmtD(c.deadline):''])});
    rows.push([]);rows.push(['Sparziel','Zielbetrag','Stand','Sparrate pro Monat','Ziel bis']);
    state.goals.forEach(g=>{const i=goalInfo(g);rows.push([g.name,i.target?csvNum(i.target):'',csvNum(i.bal),csvNum(i.rate),g.due?ymLabel(g.due):''])});
    name=`kassensturz-planung-${t}.csv`;
  }else if(kind==='tax'){
    const tx=taxYear(year);
    rows=[['Datum','Händler','Position','Gruppe','Art','Betrag']];
    const grp=k=>TAXGROUPS.find(g=>g.kinds.includes(k))||{name:''};
    tx.rows.slice().sort((a,b)=>TAXGROUPS.indexOf(grp(a.kind))-TAXGROUPS.indexOf(grp(b.kind))||a.date.localeCompare(b.date)).forEach(r=>rows.push([fmtD(r.date),r.merchant,r.name,grp(r.kind).name,TAXKINDS[r.kind]||r.kind,csvNum(r.amount)]));
    rows.push([]);TAXGROUPS.forEach(g=>{g.kinds.forEach(k=>rows.push(['','','Summe',g.name,TAXKINDS[k],csvNum(tx.by[k]||0)]));rows.push(['','','Summe '+g.name,`(${g.where})`,'',csvNum(g.kinds.reduce((a,k)=>a+(tx.by[k]||0),0))])});
    name=`kassensturz-steuer-${year}.csv`;markYear(year,'tax');
  }else if(kind==='year'){
    rows=[MONTH_HEAD()];const sum=new Array(rows[0].length-1).fill(0);
    for(let m=1;m<=12;m++){const r=monthRow(year+'-'+pad(m));rows.push(r);r.slice(1).forEach((v,i)=>sum[i]+=toNum(v)||0)}
    rows.push(['Summe '+year,...sum.map(csvNum)]);
    name=`kassensturz-jahr-${year}.csv`;markYear(year,'csv');
  }else{
    const yms=new Set(state.receipts.map(r=>r.date.slice(0,7)));yms.add(thisYM());
    const sorted=[...yms].sort();const months=[];for(let m=sorted[0];m<=sorted[sorted.length-1];m=addMonths(m,1))months.push(m);
    rows=[MONTH_HEAD()];months.forEach(ym=>rows.push(monthRow(ym)));
    name=`kassensturz-monate-${t}.csv`;
  }
  download(name,csv(rows),'text/csv;charset=utf-8');
}
function dataYears(){const ys=new Set([+thisYM().slice(0,4)]);state.receipts.forEach(r=>r.date&&ys.add(+r.date.slice(0,4)));return [...ys].sort((a,b)=>b-a)}
const TAX_NOTES={
  vs:'Für Versicherungen wie Berufsunfähigkeit, Unfall oder Haftpflicht gilt ein gemeinsamer Höchstbetrag von 1.900 € im Jahr (Selbstständige 2.800 €). Kranken- und Pflegeversicherung füllen ihn oft schon allein, dann wirken diese Beiträge nicht mehr. Eintragen schadet trotzdem nicht. Eine BU als Teil einer Basisrente zählt zur Altersvorsorge.',
  hw:'Absetzbar sind nur Arbeits-, Fahrt- und Maschinenkosten, nicht das Material, und nur bei Überweisung.',
  ab:'Krankheitskosten wirken erst über der zumutbaren Belastung.'};
function vTaxYear(){
  const y=ui.taxYear,tx=taxYear(y),ye=state.yearExport[y]||{};
  const yd=yearDue();
  return `<h2 id="steuer">Steuer & Jahresexport</h2>
  <label class="f" for="tax-year" style="margin-bottom:10px">Jahr<select id="tax-year">${dataYears().map(v=>`<option value="${v}"${v===y?' selected':''}>${v}</option>`).join('')}</select></label>
  <div class="box">
    <b>Steuerlich absetzbar ${y}</b>
    ${TAXGROUPS.map(g=>{const sum=g.kinds.reduce((a,k)=>a+(tx.by[k]||0),0);return `<div class="taxgrp"><div class="tg-h"><span><b>${g.name}</b> <small class="muted">${g.where}</small></span><b class="num">${fmt(sum)}</b></div>
      ${g.kinds.length>1?`<div class="lines">${g.kinds.map(k=>`<div><span class="n">${TAXKINDS[k]}</span><span></span><span class="num">${fmt(tx.by[k]||0)}</span></div>`).join('')}</div>`:''}
      ${TAX_NOTES[g.id]?`<p class="muted small" style="margin:0">${TAX_NOTES[g.id]}</p>`:''}</div>`}).join('')}
    <p class="muted small" style="margin:0">${tx.rows.length} markierte Positionen. Markiere beim Prüfen eines Belegs oder bei Fixkosten mit „§“. Die Liste ist eine Sammelhilfe, keine Steuerberatung.</p>
  </div>
  <div class="box" id="jahr" style="margin-top:10px">
    <b>Jahresexport ${y}</b>${ye.done?' <span class="tag ret">erledigt</span>':''}
    <div class="row"><button data-act="year-csv">${ye.csv?'✓ ':''}Jahres-CSV</button><button data-act="csv-tax">${ye.tax?'✓ ':''}Steuerliste</button><button data-act="year-backup">${ye.backup?'✓ ':''}Backup</button></div>
    <p class="muted small" style="margin:0">${yd===y?'Vom 15. Dezember bis Ende Januar erinnert dich die App an diesen Export, bis alle drei Teile heruntergeladen sind.':'Die App erinnert dich ab dem 15. Dezember an den Jahresexport.'}</p>
    ${ye.done?'':`<button class="ghost" data-act="year-done" style="justify-self:start">Als erledigt markieren</button>`}
  </div>`;
}
/* ---------- Ereignisse ---------- */
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,id=b.dataset.id,i=+b.dataset.i;
  const d=ui.draft;
  switch(a){
    case 'month':ui.showAll=false;ui.ym=addMonths(ui.ym,+b.dataset.d);ui.flash='';ui.open=null;if(['beleg','mehr'].includes(ui.tab))go('monat');else render();break;
    case 'goto':ui.ym=b.dataset.ym;go('monat');break;
    case 'remove-examples':state.receipts=state.receipts.filter(r=>!r.example);state.fixed=state.fixed.filter(f=>!f.example);
      {const exg=state.goals.filter(g=>g.example).map(g=>g.id);state.goals=state.goals.filter(g=>!g.example);state.deposits=state.deposits.filter(d=>!d.example&&!exg.includes(d.goalId))}persist();ui.flash='Beispieldaten entfernt. Trag als Erstes deine Einnahmen und Fixkosten ein.';render();break;
    case 'toggle':ui.open=ui.open===id?null:id;ui.confirmDel=null;render();break;
    case 'del':ui.confirmDel=id;render();break;
    case 'del-no':ui.confirmDel=null;render();break;
    case 'del-yes':state.receipts=state.receipts.filter(r=>r.id!==id);persist();ui.confirmDel=null;ui.flash='Beleg gelöscht.';render();break;
    case 'edit':{const r=state.receipts.find(x=>x.id===id);if(!r)break;
      const m=state.rules.merchants[normKey(r.merchant)];
      ui.draft={id:r.id,refund:!!r.refund,refOf:r.refOf,pay:r.pay||'',pot:r.pot||'',merchant:r.merchant,date:r.date,total:null,always:!!(m&&m.always),open:!!r.open,due:r.due||'',
        items:r.items.map(it=>({name:it.name,amount:fmtIn(r.refund?Math.abs(it.amount):it.amount),cat:it.cat,tax:it.tax||'',src:'gespeichert',flag:false}))};
      ui.err='';ui.dup=null;go('beleg');break}
    case 'refund':{const r=state.receipts.find(x=>x.id===id);if(!r)break;
      ui.draft={id:null,refund:true,refOf:r.id,merchant:r.merchant,date:today(),total:null,always:false,
        items:r.items.filter(it=>it.amount>0).map(it=>({name:it.name,amount:fmtIn(it.amount),cat:it.cat,tax:it.tax||'',src:'vom Originalbon',flag:false}))};
      ui.err='';ui.dup=null;ui.dupOk=false;go('beleg');break}
    case 'tut-open':openTut(b.dataset.t);break;
    case 'tut-next':if(ui.tut){ui.tut.i=Math.min(ui.tut.i+1,TUT[ui.tut.topic].steps.length-1);render()}break;
    case 'tut-prev':if(ui.tut){ui.tut.i=Math.max(ui.tut.i-1,0);render()}break;
    case 'tut-close':closeTut(false);break;
    case 'tut-go':closeTut(true);break;
    case 'tut-back':if(ev.target===b)closeTut(false);break;
    case 'seen':state.prefs.seenVersion=APP_VERSION;newList=[];persist();render();break;
    case 'app-reload':location.reload();break;
    case 'update-later':ui.updateAvail=null;ui.updateSnoozed=true;render();break;
    case 'show-items':if(ui.draft)ui.draft.fix=null;if(ui.draft&&ui.draft.collapsed){ui.draft.items=ui.draft.collapsed;ui.draft.collapsed=null;render()}break;
    case 'total-only':if(ui.draft)ui.draft.fix=null;{const d=ui.draft;if(!d||d.total==null)break;const cs={};d.items.forEach(x=>{if(x.cat)cs[x.cat]=(cs[x.cat]||0)+Math.abs(toNum(x.amount)||0)});
      const top=Object.entries(cs).sort((a,b)=>b[1]-a[1])[0];const mi=merchantInfo(d.merchant);
      d.items=[{name:d.merchant||'Einkauf',amount:fmtIn(d.total),cat:mi.cat||(top?top[0]:''),src:mi.cat?'Händler':(top?'häufigste Kategorie':''),flag:false,suggest:null,tax:''}];render();break}
    case 'paid':{const r=state.receipts.find(x=>x.id===id);if(r){r.open=false;r.paidOn=today();persist();ui.flash=`„${r.merchant||'Rechnung'}“ als bezahlt markiert.`}render();break}
    case 'chart-mode':state.prefs.chart=b.dataset.m;persist();render();break;
    case 'pie-sel':ui.pieSel=ui.pieSel===id?null:id;render();break;
    case 'pie-sel2':ui.pieSel2=ui.pieSel2===id?null:id;render();break;
    case 'repeat':{const r=state.receipts.find(x=>x.id===id);if(!r)break;openPrefilled(r,`dem Beleg vom ${fmtD(r.date)}`,false);go('beleg');break}
    case 'tpl-from':{const r=state.receipts.find(x=>x.id===id);if(!r)break;ui.flash=addTemplate(r)?`Vorlage „${(r.merchant||r.items[0].name).slice(0,40)}“ gemerkt. Du findest sie unter „Beleg“.`:'Diese Vorlage gibt es schon.';persist();render();window.scrollTo(0,0);break}
    case 'tpl-use':{const t=state.templates.find(x=>x.id===id);if(!t)break;openPrefilled(t,`der Vorlage „${t.name}“`,true);render();window.scrollTo(0,0);break}
    case 'tpl-edit':ui.tplEdit=!ui.tplEdit;render();break;
    case 'tpl-del':state.templates=state.templates.filter(t=>t.id!==id);if(!state.templates.length)ui.tplEdit=false;persist();render();break;
    case 'photo':ui.action='';document.getElementById('photo').click();break;
    case 'sample':ui.paste=SAMPLE();ui.err='';render();break;
    case 'parse':{ui.paste=(document.getElementById('bon-text')||{}).value||'';parseNow();break}
    case 'manual':ui.draft={id:null,refund:false,merchant:'',date:today(),total:null,always:false,items:[{name:'',amount:'',cat:'',src:'',flag:true}]};ui.err='';ui.dup=null;ui.dupOk=false;render();break;
    case 'add-row':if(ui.draft)ui.draft.fix=null;d.items.push({name:'',amount:'',cat:'',src:'',flag:true});render();{const n=document.getElementById('n-'+(d.items.length-1));if(n)n.focus()}break;
    case 'del-row':if(ui.draft)ui.draft.fix=null;if(d.removed&&d.items[i]&&d.items[i].o)d.removed.push(d.items[i].o);d.items.splice(i,1);if(!d.items.length)d.items.push({name:'',amount:'',cat:'',src:'',flag:true});render();break;
    case 'add-diff':if(ui.draft)ui.draft.fix=null;{const sum=d.items.reduce((s,x)=>s+(toNum(x.amount)||0),0);const df=r2(d.total-sum);
      d.items.push({name:'Nicht erkannte Position',amount:fmtIn(df),cat:'',src:'',flag:true,suggest:merchantInfo(d.merchant).cat||'sonstiges'});render();break}
    case 'accept':d.items[i].cat=d.items[i].suggest;d.items[i].src='Vorschlag übernommen';ui.err='';render();break;
    case 'accept-all':d.items.forEach(x=>{if(!x.cat&&x.suggest){x.cat=x.suggest;x.src='Vorschlag übernommen'}});ui.err='';render();break;
    case 'save':saveDraft();break;
    case 'save-dup':ui.dupOk=true;ui.dup=null;saveDraft();break;
    case 'cancel':ui.draft=null;ui.err='';ui.dup=null;if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}if(ui.qTotal>1&&queueNext())break;render();break;
    case 'rot-reread':if(ui.lastFile)runOCR(ui.lastFile,{rot:((ui.rot||0)+90)%360});break;
    case 'apply-fix':{const d=ui.draft;if(d&&d.fix&&d.items[d.fix.i]){d.items[d.fix.i].amount=fmtIn(d.fix.amount);d.items[d.fix.i].check=false;d.fix=null;render()}break}
    case 'snap-ask':ui.snapConfirm=b.dataset.day;render();break;
    case 'snap-no':ui.snapConfirm=null;render();break;
    case 'snap-yes':snapRestore(b.dataset.day);break;
    case 'rescue-no':ui.rescue=false;ui.rescueDone=true;loadBroken=false;render();break;
    case 'kasse-cash':ui.kCash=true;render();setTimeout(()=>{const e=document.getElementById(document.getElementById('k-cprev')&&!document.getElementById('k-cprev').value?'k-cprev':'k-cash');if(e){e.scrollIntoView({block:'center'});e.focus()}},60);break;
    case 'kasse-nocash':{const e=state.kasse[b.dataset.ym]=state.kasse[b.dataset.ym]||{};e.noCash=true;persist();render();break}
    case 'kasse-accept':{const ym=b.dataset.ym,i=kasseInfo(ym);if(i.has){state.kasse[ym].accept=i.diff;persist()}render();break}
    case 'kasse-reopen':{const e=state.kasse[b.dataset.ym];if(e)delete e.accept;persist();render();break}
    case 'kasse-quick':ui.action='quick';if(location.hash!=='#monat')location.hash='monat';render();setTimeout(focusAction,60);break;
    case 'kasse-book':{const ym=b.dataset.ym,i=kasseInfo(ym);if(i.has&&i.diff>=0.5){
      state.receipts.push({id:uid(),date:ym===thisYM()?today():lastDay(ym),merchant:'Nicht erfasst',items:[{name:'Nicht erfasste Ausgaben (Kassensturz)',amount:i.diff,cat:'sonstiges'}]});
      persist();ui.flash=`${fmt(i.diff)} als „nicht erfasst“ gebucht.`}render();break}
    case 'yr-open':ui.yrOpen=!ui.yrOpen;render();if(ui.yrOpen)scrollToHead('jahr');break;
    case 'pick-sep':{const f=ui.pick||[];ui.pick=null;startQueue(f);break}
    case 'pick-merge':{const f=ui.pick||[];runPages(f);break}
    case 'pick-cancel':ui.pick=null;render();break;
    case 'queue-next':ui.err='';queueNext();break;
    case 'queue-stop':dropPrefetch();ui.queue=[];ui.err='';if(!ui.draft&&!ui.ocr)queueNext();else render();break;
    case 'jump':{ev.preventDefault();const n=document.getElementById(b.dataset.to);if(n)n.scrollIntoView({block:'start'});break}
    case 'goal-new':ui.goalNew=b.dataset.pot?'pot':'goal';ui.planOpen='sparziele';ui.goalEdit=null;ui.depositFor=null;ui.err='';render();focusForm('g-name');break;
    case 'goal-edit':ui.goalEdit=id;ui.goalNew=false;ui.depositFor=null;ui.err='';render();focusForm('g-name');break;
    case 'goal-cancel':ui.goalEdit=null;ui.goalNew=false;ui.err='';render();break;
    case 'goal-del':ui.confirmGoal=id;render();break;
    case 'goal-del-no':ui.confirmGoal=null;render();break;
    case 'goal-del-yes':state.goals=state.goals.filter(g=>g.id!==id);state.receipts.forEach(r=>{if(r.pot===id)delete r.pot});state.deposits=state.deposits.filter(d=>d.goalId!==id);ui.confirmGoal=null;persist();render();break;
    case 'goal-stop':{const g=state.goals.find(x=>x.id===id);if(g){const nx=addMonths(thisYM(),1);g.rates=(g.rates||[]).filter(r=>r.from!==nx);g.rates.push({from:nx,amount:0});persist()}render();break}
    case 'dep':ui.depositFor=id;ui.depositSign=+b.dataset.sign||1;ui.goalEdit=null;ui.goalNew=false;ui.err='';render();{const n=document.getElementById('dep-amount');if(n)n.focus()}break;
    case 'dep-cancel':ui.depositFor=null;ui.err='';render();break;
    case 'dep-del':state.deposits=state.deposits.filter(d=>d.id!==id);persist();render();break;
    case 'fedit':{const f=state.fixed.find(x=>x.id===id);if(!f)break;ui.fixedEdit=id;ui.fxForm='edit';ui.planOpen=f.kind==='in'?'ein':'fix';ui.err='';render();focusForm('fx-name');break}
    case 'fcancel':ui.fixedEdit=null;ui.fxForm=null;ui.err='';render();break;
    case 'fx-new':ui.fxForm='new';ui.fxKind=b.dataset.kind;ui.fixedEdit=null;ui.err='';render();focusForm('fx-name');break;
    case 'fx-toggle':ui.fxOpen=ui.fxOpen===id?null:id;render();break;
    case 'goal-toggle':ui.goalOpen=ui.goalOpen===id?null:id;ui.depositFor=null;ui.confirmGoal=null;render();break;
    case 'quick-cat':if(ui.quickAsk)saveQuick(ui.quickAsk.name,ui.quickAsk.amount,b.dataset.c);break;
    case 'quick-cancel':ui.quickAsk=null;render();{const n=document.getElementById('quick');if(n)n.focus()}break;
    case 'quick-undo':{const d=ui.quickDone;if(d){state.receipts=state.receipts.filter(r=>r.id!==d.id);persist();ui.quickText=`${d.name} ${fmtIn(d.amount)}`;ui.quickDone=null;render();const n=document.getElementById('quick');if(n)n.focus()}break}
    case 'tax-show':if(ui.draft&&ui.draft.items[i])ui.draft.items[i].taxShow=true;render();{const n=document.getElementById('t-'+i);if(n)n.focus()}break;
    case 'more-open':{const sec=b.dataset.sec;ui.moreOpen=ui.moreOpen===sec?null:sec;ui.catEdit=null;ui.confirmCat=null;ui.confirmClear=false;ui.err='';render();scrollToHead(sec);break}
    case 'cat-edit':ui.catEdit=ui.catEdit===id?null:id;ui.catColor=null;ui.confirmCat=null;ui.err='';render();break;
    case 'cat-color':ui.catColor=b.dataset.col;{const nm=document.getElementById('cat-ename');const v=nm?nm.value:null;render();const n2=document.getElementById('cat-ename');if(n2&&v!=null)n2.value=v}break;
    case 'cat-cancel':ui.catEdit=null;ui.catColor=null;ui.err='';render();break;
    case 'cat-save':{const c=state.categories.find(x=>x.id===ui.catEdit);if(!c)break;const nm=val('cat-ename').trim();
      if(!nm){ui.err='Bitte gib der Kategorie einen Namen.';render();break}
      if(state.categories.some(x=>x.id!==c.id&&x.name.toLowerCase()===nm.toLowerCase())){ui.err=`„${nm}“ gibt es schon.`;render();break}
      c.name=nm.slice(0,30);if(ui.catColor)c.color=ui.catColor;ui.catEdit=null;ui.catColor=null;ui.err='';persist();render();break}
    case 'dev-report':makeReport().then(n=>{if(n){ui.repDone=n;render()}}).catch(()=>{ui.err='Der Bericht ließ sich nicht speichern.';render()});break;
    case 'reports-share':shareReports();break;
    case 'reports-clear':ui.repClear=true;render();break;
    case 'reports-clear-no':ui.repClear=false;render();break;
    case 'reports-clear-yes':repClear().then(()=>{ui.repClear=false;ui.repCount=0;ui.flash='Alle Berichte gelöscht.';render()});break;
    case 'fix-del':{const m=state.rules[b.dataset.kind];if(m&&m[b.dataset.m]){delete m[b.dataset.m][b.dataset.k];if(!Object.keys(m[b.dataset.m]).length)delete m[b.dataset.m]}persist();render();break}
    case 'layout-del':delete state.rules.layout[b.dataset.m];persist();render();break;
    case 'hints-toggle':ui.hintsOpen=!ui.hintsOpen;render();break;
    case 'backup-go':ui.moreOpen='backup';ui.jumpTo='backup';go('mehr');break;
    case 'backup-snooze':state.prefs.backupSnooze=addDays(today(),7);persist();render();break;
    case 'rec-no':{state.prefs.recDismiss=state.prefs.recDismiss||{};state.prefs.recDismiss[b.dataset.k]=true;persist();render();break}
    case 'rec-take':{const x=recurring().find(y=>y.k===b.dataset.k);if(x){
      state.fixed.push({id:uid(),kind:'out',name:x.name,amount:x.amount,interval:1,start:x.thisMonth?addMonths(thisYM(),1):thisYM(),end:'',cat:x.cat});
      persist();ui.flash=`${x.name} ist jetzt monatliche Fixkosten. Erfasse den Betrag künftig nicht mehr als Beleg.`}render();break}
    case 'mon-open':ui.monOpen=ui.monOpen===b.dataset.sec?null:b.dataset.sec;render();break;
    case 'mon-goals':ui.monOpen=ui.monOpen==='goals'?null:'goals';render();break;
    case 'show-all':ui.showAll=!ui.showAll;render();break;
    case 'plan-go':ui.planOpen=b.dataset.sec;ui.jumpTo=b.dataset.sec;go('fixkosten');break;
    case 'plan-open':{const sec=b.dataset.sec;ui.planOpen=ui.planOpen===sec?null:sec;ui.fxForm=null;ui.fixedEdit=null;ui.fxOpen=null;ui.goalNew=false;ui.goalEdit=null;ui.depositFor=null;ui.err='';render();scrollToHead(sec);break}
    case 'fdel':state.fixed=state.fixed.filter(f=>f.id!==id);if(ui.fixedEdit===id)ui.fixedEdit=null;persist();render();break;
    case 'rdel':{const t=b.dataset.type==='p'?state.rules.products:state.rules.merchants;delete t[b.dataset.key];persist();render();break}
    case 'cdel':ui.confirmCat=id;render();break;
    case 'cdel-no':ui.confirmCat=null;render();break;
    case 'cdel-yes':{const cid=ui.confirmCat;ui.confirmCat=null;ui.catEdit=null;if(!cid||cid==='sonstiges'){render();break}
      state.categories=state.categories.filter(c=>c.id!==cid);
      const fix=o=>{if(o.cat===cid)o.cat='sonstiges'};state.fixed.forEach(fix);state.receipts.forEach(r=>r.items.forEach(fix));
      Object.keys(state.rules.products).forEach(k=>{if(state.rules.products[k]===cid)state.rules.products[k]='sonstiges'});
      Object.values(state.rules.merchants).forEach(fix);delete state.budgets[cid];persist();render();break}
    case 'csv-items':exportCsv('items');break;
    case 'csv-tax':exportCsv('tax',ui.taxYear);render();break;
    case 'year-csv':exportCsv('year',ui.taxYear);render();break;
    case 'year-backup':{ui.backupFor=ui.taxYear;ui.moreOpen='backup';render();scrollToHead('backup');const n=document.getElementById('bk-pw')||document.getElementById('bk-plain');if(n)n.focus({preventScroll:true});break}
    case 'year-done':markYear(ui.taxYear,'csv');markYear(ui.taxYear,'tax');markYear(ui.taxYear,'backup');render();break;
    case 'year-go':ui.taxYear=+b.dataset.y;ui.flashNext='';ui.moreOpen='steuer';ui.jumpTo='steuer';go('mehr');break;
    case 'year-later':ui.yearHide=true;render();break;
    case 'csv-months':exportCsv('months');break;
    case 'csv-fixed':exportCsv('fixed');break;
    case 'backup-share':makeBackupText().then(async r=>{if(!r)return;
      const f=new File([r.text],`kassensturz-backup-${today()}${r.enc?'-verschluesselt':''}.txt`,{type:'text/plain'});
      try{await navigator.share({files:[f],title:'Kassensturz-Backup'});state.lastBackup=Date.now();ui.backupErr='';markYear(ui.backupFor||yearDue(),'backup');ui.backupFor=null;persist();
        ui.flash=(r.enc?'Verschlüsseltes Backup':'Backup')+' geteilt.';render();window.scrollTo(0,0)}
      catch(e){if(e&&e.name==='AbortError')return;download(f.name,r.text,'text/plain');state.lastBackup=Date.now();persist();ui.flash='Teilen ging nicht, das Backup wurde stattdessen heruntergeladen (Ordner „Downloads“).';render();window.scrollTo(0,0)}});break;
    case 'backup-file':makeBackupText().then(r=>{if(!r)return;state.lastBackup=Date.now();ui.backupErr='';markYear(ui.backupFor||yearDue(),'backup');ui.backupFor=null;persist();
      download(`kassensturz-backup-${today()}${r.enc?'-verschluesselt':''}.json`,r.text,'application/json');
      ui.flash=(r.enc?'Verschlüsseltes Backup':'Backup')+' heruntergeladen. Du findest es im Ordner „Downloads“.';render();window.scrollTo(0,0)});break;
    case 'export':makeBackupText().then(r=>{if(!r)return;state.lastBackup=Date.now();persist();ui.backupErr='';ui.exportText=r.text;ui.exportEnc=r.enc;render()});break;
    case 'copy':{const ta=document.getElementById('export-text');const msg=document.getElementById('copy-msg');
      const fallback=()=>{ta.focus();ta.select();if(msg)msg.textContent='Text ist markiert, jetzt über das Menü kopieren.'};
      try{navigator.clipboard.writeText(ui.exportText).then(()=>{if(msg)msg.textContent='Kopiert.'},fallback)}catch(e){fallback()}break}
    case 'import':{const t=val('import-text').trim()||ui.pendingImport||'';if(!t){ui.importMsg='Wähle zuerst eine Backup-Datei oder füge den Backup-Text ein.';render();break}importAny(t,val('import-pw'));break}
    case 'lock-remove':{const old=val('lk-old');pinOk(old).then(ok=>{if(!ok||!old){ui.lockMsg='Die aktuelle PIN stimmt nicht.';render();return}setLock(null);ui.lockMsg='App-Sperre ausgeschaltet.';render()});break}
    case 'forgot':ui.forgot=1;render();break;
    case 'forgot-ask':ui.forgot=2;render();break;
    case 'forgot-no':ui.forgot=0;render();break;
    case 'forgot-yes':{const s=seed();s.receipts=[];s.fixed=[];state=s;persist();setLock(null);ui.forgot=0;ui.locked=false;ui.lockFails=0;ui.importMsg='Die App wurde zurückgesetzt. Hier kannst du ein Backup wiederherstellen.';go('mehr');render();break}
    case 'clear':ui.confirmClear=true;render();break;
    case 'clear-no':ui.confirmClear=false;render();break;
    case 'clear-yes':{const s=seed();s.receipts=[];s.fixed=[];state=s;persist();ui.confirmClear=false;ui.importMsg='Alle Daten gelöscht.';render();break}
    case 'install':if(ui.installEvt){ui.installEvt.prompt();ui.installEvt.userChoice.finally(()=>{ui.installEvt=null;render()})}break;
  }
});

function keepFocus(id){const n=document.getElementById(id);if(!n)return;const p=n.selectionStart;n.focus();try{n.setSelectionRange(p,p)}catch(e){}}
document.addEventListener('input',ev=>{
  const t=ev.target,d=ui.draft;
  if(t.id==='bon-text'){ui.paste=t.value;return}
  if(t.id==='quick'){ui.quickText=t.value;if(ui.quickErr){ui.quickErr='';const e=t.closest('.quickwrap')?.querySelector('.err');if(e)e.remove()}return}
  if(t.id==='rule-filter'){ui.ruleFilter=t.value;const c=document.getElementById('prod-list');if(c)c.innerHTML=prodList();return}
  if(t.id==='search'){ui.search=t.value;const c=document.getElementById('search-res');if(c)c.innerHTML=searchResults();return}
  if(!d)return;
  if(t.dataset.f==='merchant'){d.merchant=t.value;return}
  if(t.dataset.f==='date'){d.date=t.value;d.dateGuessed=false;return}
  if(t.dataset.f==='total'){const v=toNum(t.value);d.total=t.value.trim()&&!isNaN(v)?v:null;updateSums();return}
  if(t.dataset.row!=null&&t.dataset.k!=='cat'&&t.dataset.k!=='tax'){d.items[+t.dataset.row][t.dataset.k]=t.value;if(t.dataset.k==='amount'){d.items[+t.dataset.row].check=false;t.classList.remove('chk');updateSums()}return}
});
document.addEventListener('change',ev=>{
  const t=ev.target,d=ui.draft;
  if((t.id==='fx-name'||t.id==='fx-cat')&&document.getElementById('fx-tax')){
    const sel=document.getElementById('fx-tax'),hint=document.getElementById('fx-taxhint');
    if(!sel.value||sel.dataset.auto){const sg=taxSuggest(val('fx-name'),val('fx-cat'));
      if(sg){sel.value=sg;sel.dataset.auto='1';const box=document.getElementById('fx-taxbox');if(box)box.open=true;if(hint)hint.textContent=`Vorschlag: ${TAXKINDS[sg]}. Bitte prüfen.`}
      else if(sel.dataset.auto){sel.value='';delete sel.dataset.auto;if(hint)hint.textContent=''}}
    return}
  if(t.id==='fx-tax'){delete t.dataset.auto;const hint=document.getElementById('fx-taxhint');if(hint)hint.textContent='';return}
  if(t.dataset.tpl){const x=state.templates.find(q=>q.id===t.dataset.tpl);if(x&&t.value.trim()){x.name=t.value.trim().slice(0,40);persist()}return}
  if(t.id==='photo'){const fs=t.files?[...t.files]:[];t.value='';askMulti(fs);return}
  if(t.id==='tax-year'){ui.taxYear=+t.value;render();return}
  if(t.id==='chart-cat'){ui.chartCat=t.value;render();return}
  if(t.id==='use-budgets'){state.useBudgets=t.checked;persist();render();return}
  if(t.id==='use-ki'){state.prefs.ki=t.checked;persist();if(t.checked)kiPrefetch();render();return}
  if(t.id==='use-dev'){state.prefs.dev=t.checked;persist();if(t.checked)repCount().then(n=>{ui.repCount=n;render()}).catch(()=>{});render();return}
  if(t.id==='use-kasse'){state.prefs.kasse=t.checked;persist();render();return}
  if(t.id==='kasse-tol'){const v=t.value.trim()?toNum(t.value):10;if(!isNaN(v)&&v>=0){state.prefs.kasseTol=r2(v);persist()}t.value=fmtIn(kasseTol());return}
  if(t.name==='g-kind'){goalKindSwitch(t.value);return}
  if(t.id==='yr-sel'){ui.yr=+t.value;render();return}
  if(t.dataset.budget){const v=toNum(t.value);if(t.value.trim()&&!isNaN(v)&&v>0)state.budgets[t.dataset.budget]=r2(v);else delete state.budgets[t.dataset.budget];persist();t.value=state.budgets[t.dataset.budget]?fmtIn(state.budgets[t.dataset.budget]):'';return}
  if(t.dataset.rule){const k=t.dataset.key;if(t.dataset.rule==='p')state.rules.products[k]=t.value;else if(state.rules.merchants[k])state.rules.merchants[k].cat=t.value;persist();return}
  if(t.id==='bk-plain'){ui.plainBackup=t.checked;return}
  if(t.id==='import-file'&&t.files&&t.files[0]){const r=new FileReader();r.onload=()=>{const txt=String(r.result);let enc=false;try{enc=JSON.parse(txt).kassensturz==='backup-enc-1'}catch(e){}
    if(enc&&!val('import-pw')){ui.pendingImport=txt;ui.pendingEnc=true;ui.importMsg='Dieses Backup ist verschlüsselt. Gib das Passwort ein und tippe auf „Wiederherstellen“.';render();const n=document.getElementById('import-pw');if(n)n.focus()}
    else importAny(txt,val('import-pw'))};r.readAsText(t.files[0]);t.value='';return}
  if(!d)return;
  if(t.dataset.f==='merchant'){const before=JSON.stringify(d.items.map(i=>[i.cat,i.suggest]));reclassify();if(JSON.stringify(d.items.map(i=>[i.cat,i.suggest]))!==before)renderKeepFocus();return}
  if(t.dataset.f==='always'){d.always=t.checked;return}
  if(t.dataset.f==='pot'){d.pot=t.value;return}
  if(t.dataset.f==='asTemplate'){d.asTemplate=t.checked;return}
  if(t.dataset.f==='open'){d.open=t.checked;if(d.open&&!d.due)d.due=addDays(d.date||today(),14);renderKeepFocus();return}
  if(t.dataset.f==='due'){d.due=t.value;return}
  if(t.dataset.f==='refund'){d.refund=t.checked;render();return}
  if(t.dataset.row!=null&&t.dataset.k==='tax'){d.items[+t.dataset.row].tax=t.value;t.classList.toggle('on',!!t.value);return}
  if(t.dataset.row!=null&&t.dataset.k==='cat'){const it=d.items[+t.dataset.row];it.cat=t.value;it.src=t.value?'von dir gewählt':'';ui.err='';renderKeepFocus();return}
  if(t.dataset.row!=null&&t.dataset.k==='name'){const it=d.items[+t.dataset.row];if(!it.cat){const c=classify(it.name,merchantInfo(d.merchant));if(!c.flag){it.cat=c.cat;it.src=c.src;renderKeepFocus()}}}
});
document.addEventListener('submit',ev=>{
  const f=ev.target;ev.preventDefault();
  if(f.id==='quick-form'){submitQuick();return}
  if(f.id==='unlock-form'){
    if(ui.lockUntil>Date.now())return;
    const pin=val('unlock-pin');
    pinOk(pin).then(ok=>{
      if(ok&&pin){ui.locked=false;ui.lockFails=0;ui.lockErr='';render();maybeTutorial();focusAction();return}
      ui.lockFails++;ui.lockErr='Falsche PIN.';
      if(ui.lockFails>=5){ui.lockUntil=Date.now()+30000*Math.pow(2,Math.min(ui.lockFails-5,5));setTimeout(()=>{if(ui.locked)render()},ui.lockUntil-Date.now()+50)}
      render()});
    return}
  if(f.id==='lock-set-form'||f.id==='lock-change-form'){
    const nw=val('lk-new'),nw2=val('lk-new2'),old=val('lk-old');
    const msg=m=>{ui.lockMsg=m;const e=document.getElementById('lock-msg');if(e)e.textContent=m};
    if(!pinValid(nw)){msg('Die PIN muss aus 4 bis 8 Ziffern bestehen.');return}
    if(nw!==nw2){msg('Die beiden PINs stimmen nicht überein.');return}
    (f.id==='lock-change-form'?pinOk(old):Promise.resolve(true)).then(ok=>{
      if(!ok||(f.id==='lock-change-form'&&!old)){msg('Die aktuelle PIN stimmt nicht.');return}
      return makeLock(nw).then(l=>{if(!setLock(l)){msg('Die PIN konnte nicht gespeichert werden.');return}
        ui.lockMsg=f.id==='lock-change-form'?'PIN geändert.':'App-Sperre ist eingeschaltet.';render()})});
    return}
  if(f.id==='fixed-form'){
    const name=val('fx-name').trim();const amount=toNum(val('fx-amount'));
    const kind=val('fx-kind'),interval=+val('fx-int');
    let start=val('fx-start'),end=val('fx-end');
    if(!name||isNaN(amount)||amount<=0){ui.err='Bitte Bezeichnung und Betrag angeben, den Betrag z. B. als 12,99.';render();return}
    if(interval===0&&!start)start=ui.ym;
    if(interval===0)end='';
    if(start&&end&&end<start){ui.err='„Bis Monat“ liegt vor „Ab Monat“. Bitte prüfen.';render();return}
    const o={kind,name,amount:r2(amount),interval,start,end,cat:kind==='in'?'':val('fx-cat'),tax:kind==='in'?'':val('fx-tax')};
    const cend=kind==='in'?'':val('fx-cend');
    if(cend){const nv=parseInt(val('fx-nval'),10);if(isNaN(nv)||nv<0||nv>36){ui.err='Die Kündigungsfrist muss eine Zahl sein, z. B. 1 oder 3.';render();return}
      Object.assign(o,{contractEnd:cend,noticeVal:nv,noticeUnit:val('fx-nunit'),renew:+val('fx-renew')||1})}
    else Object.assign(o,{contractEnd:'',noticeVal:null,noticeUnit:'',renew:null});
    if(ui.fixedEdit){const e=state.fixed.find(x=>x.id===ui.fixedEdit);if(e){Object.assign(e,o);delete e.example}}else state.fixed.push({id:uid(),...o});
    ui.fixedEdit=null;ui.fxForm=null;ui.fixedKind=kind;ui.err='';persist();render();return}
  if(f.id==='kasse-form'){
    const ym=ui.ym,pm=addMonths(ym,-1),a=val('k-prev').trim(),b2=val('k-bal').trim(),na=a?toNum(a):null,nb=b2?toNum(b2):null;
    if((a&&isNaN(na))||(b2&&isNaN(nb))){ui.err='Kontostand bitte als Zahl angeben, z. B. 1.250,00.';render();return}
    const set=(m,v)=>{const e=state.kasse[m]=state.kasse[m]||{};if(v==null)delete e.bal;else e.bal=r2(v)};
    set(pm,na);set(ym,nb);
    if(document.getElementById('k-cash')){const c1=val('k-cprev').trim(),c2=val('k-cash').trim(),nc1=c1?toNum(c1):null,nc2=c2?toNum(c2):null;
      if((c1&&(isNaN(nc1)||nc1<0))||(c2&&(isNaN(nc2)||nc2<0))){ui.err='Bargeld bitte als Zahl angeben, z. B. 45,00.';render();return}
      const cs=(m,v)=>{const e=state.kasse[m]=state.kasse[m]||{};if(v==null)delete e.cash;else{e.cash=r2(v);delete e.noCash}};
      cs(pm,nc1);cs(ym,nc2);ui.kCash=false}
    state.kasse[ym].deb=[...f.querySelectorAll('[data-kdeb]')].filter(x=>x.checked).map(x=>x.dataset.kdeb);
    ui.err='';persist();render();return}
  if(f.id==='goal-form'){
    const name=val('g-name').trim(),tRaw=val('g-target').trim(),rRaw=val('g-rate').trim(),sRaw=val('g-start').trim();
    const target=tRaw?toNum(tRaw):0,rate=rRaw?toNum(rRaw):0,startAmt=sRaw?toNum(sRaw):0;
    const kr=f.querySelector('input[name=g-kind]:checked'),isPot=kr?kr.value==='pot':ui.goalNew==='pot';if(!name){ui.err='Bitte gib einen Namen an.';render();return}
    if(isNaN(target)||target<0||isNaN(rate)||rate<0||isNaN(startAmt)||startAmt<0){ui.err='Beträge bitte als Zahl angeben, z. B. 150,00.';render();return}
    const ym=thisYM();let g=ui.goalEdit&&state.goals.find(x=>x.id===ui.goalEdit);
    if(g){g.name=name;g.target=r2(target);if(!g.pot)g.due=val('g-due');delete g.example;
      if(r2(rateFor(g,ym))!==r2(rate)){g.rates=(g.rates||[]).filter(r=>r.from!==ym);g.rates.push({from:ym,amount:r2(rate)})}}
    else{g={id:'g'+uid(),name,target:r2(target),due:isPot?'':val('g-due'),rates:rate>0?[{from:ym,amount:r2(rate)}]:[]};if(isPot)g.pot=true;state.goals.push(g);
      if(startAmt>0)state.deposits.push({id:uid(),goalId:g.id,date:today(),amount:r2(startAmt),note:'Startguthaben',start:true})}
    ui.goalEdit=null;ui.goalNew=false;ui.err='';persist();render();return}
  if(f.id==='deposit-form'){
    const a=toNum(val('dep-amount')),dt=val('dep-date')||today();
    if(isNaN(a)||a<=0){ui.err='Bitte einen Betrag angeben, z. B. 50,00.';render();return}
    state.deposits.push({id:uid(),goalId:f.dataset.goal,date:dt,amount:r2(a*ui.depositSign),note:ui.depositSign>0?'Einzahlung':'Entnahme'});
    ui.depositFor=null;ui.err='';persist();render();return}
  if(f.id==='cat-form'){
    const n=document.getElementById('cat-name').value.trim();if(!n)return;
    if(state.categories.some(c=>c.name.toLowerCase()===n.toLowerCase())){ui.flash=`„${n}“ gibt es schon.`;render();return}
    const nc={id:'c'+uid(),name:n.slice(0,30),color:freeColor()};
    state.categories.splice(state.categories.length-1,0,nc);ui.catEdit=nc.id;ui.catColor=null;ui.flash='';
    persist();render();return}
});

/* ---------- App-Funktionen ---------- */
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();ui.installEvt=e;if(ui.tab==='mehr')render()});
window.addEventListener('appinstalled',()=>{ui.installed=true;ui.installEvt=null;render()});
if(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)ui.installed=true;
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){navigator.serviceWorker.register('./sw.js').catch(()=>{})}

async function checkShared(){
  if(!new URLSearchParams(location.search).has('shared')||!('caches' in window))return;
  history.replaceState(null,'',location.pathname+'#beleg');
  try{
    const c=await caches.open('kassensturz-share');
    const cntR=await c.match('shared-count'),n=cntR?parseInt(await cntR.text(),10)||0:0,files=[];
    for(let i=0;i<n;i++){const r=await c.match('shared-image-'+i);if(r){const blob=await r.blob();files.push(new File([blob],'geteilt-'+(i+1),{type:blob.type||'image/jpeg'}))}await c.delete('shared-image-'+i)}
    const img=await c.match('shared-image');if(img){const blob=await img.blob();files.push(new File([blob],'geteilt',{type:blob.type||'image/jpeg'}))}
    const txt=await c.match('shared-text');
    await c.delete('shared-image');await c.delete('shared-text');await c.delete('shared-count');
    if(files.length){askMulti(files);return}
    if(txt){ui.paste=await txt.text();ui.tab='beleg';parseNow()}
  }catch(e){}
}

function cmpVer(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0?1:-1}return 0}
let lastCheck=0;
async function checkUpdate(){
  if(ui.updateSnoozed||Date.now()-lastCheck<60000)return;lastCheck=Date.now();
  if(!/^https:$/.test(location.protocol)&&location.hostname!=='localhost')return;
  try{const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    if(j&&j.version&&cmpVer(j.version,APP_VERSION)>0&&ui.updateAvail!==j.version){ui.updateAvail=j.version;render()}}catch(e){}
}
setTimeout(checkUpdate,2500);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)checkUpdate();
  if(document.hidden){ui.hiddenAt=Date.now();return}
  if(!ui.locked&&getLock()&&ui.hiddenAt&&Date.now()-ui.hiddenAt>60000){ui.locked=true;ui.lockErr='';render()}
});
document.addEventListener('keydown',e=>{
  if(!ui.tut)return;
  if(e.key==='Escape')closeTut(false);
  else if(e.key==='ArrowRight'){const b=document.querySelector('[data-act=tut-next]');if(b)b.click()}
  else if(e.key==='ArrowLeft'){const b=document.querySelector('[data-act=tut-prev]');if(b&&!b.disabled)b.click()}
});
let swipeX=null;
document.addEventListener('touchstart',e=>{swipeX=ui.tut&&e.touches.length===1?e.touches[0].clientX:null},{passive:true});
document.addEventListener('touchend',e=>{
  if(swipeX==null||!ui.tut)return;const dx=e.changedTouches[0].clientX-swipeX;swipeX=null;
  if(Math.abs(dx)<60)return;const b=document.querySelector(dx<0?'[data-act=tut-next]':'[data-act=tut-prev]');if(b&&!b.disabled)b.click();
},{passive:true});
/* Wischen zwischen den Reitern */
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let tabSw=null;
document.addEventListener('touchstart',e=>{
  tabSw=null;
  if(ui.tut||ui.locked||ui.ocr||e.touches.length!==1)return;
  const t=e.touches[0],el=e.target;
  if(el.closest&&el.closest('select,.chart,.tut-back,[contenteditable]'))return;
  const fld=el.closest&&el.closest('input,textarea');if(fld&&document.activeElement===fld)return; // nur Felder, in denen du gerade schreibst
  if(t.clientX<28||t.clientX>window.innerWidth-28)return; // Rand frei lassen für die Zurück-Geste von Android
  tabSw={x:t.clientX,y:t.clientY,t:Date.now(),dir:null};
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!tabSw)return;const t=e.touches[0],dx=t.clientX-tabSw.x,dy=t.clientY-tabSw.y;
  if(!tabSw.dir&&(Math.abs(dx)>10||Math.abs(dy)>10))tabSw.dir=Math.abs(dx)>Math.abs(dy)*1.5?'h':'v';
  if(tabSw.dir==='v'){tabSw=null;main.style.transform='';return}
  if(tabSw.dir==='h'&&!reduceMotion()){
    const i=TABS.indexOf(ui.tab),edge=(dx>0&&i===0)||(dx<0&&i===TABS.length-1);
    main.style.transition='none';main.style.transform=`translateX(${dx*(edge?0.12:0.3)}px)`;
  }
},{passive:true});
document.addEventListener('touchend',e=>{
  const sw=tabSw;tabSw=null;
  if(main.style.transform){main.style.transition='transform .18s ease-out';main.style.transform='';}
  if(!sw||sw.dir!=='h')return;
  const t=e.changedTouches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y;
  if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.5||Date.now()-sw.t>800)return;
  const i=TABS.indexOf(ui.tab)+(dx<0?1:-1);
  if(i<0||i>=TABS.length)return;
  main.style.transition='none';main.style.transform='';
  ui.slideDir=dx<0?'l':'r';go(TABS[i]);
},{passive:true});
document.addEventListener('touchcancel',()=>{tabSw=null;main.style.transform=''},{passive:true});
function maybeTutorial(){if(loadBroken||ui.rescue)return;if(!state.prefs.tutorialDone&&!ui.locked&&!ui.tut){ui.tut={topic:'start',i:0};render()}}
// Start: erst die Daten laden, dann anzeigen
function focusAction(){if(!ui.action||ui.locked||ui.tut)return;const n=document.getElementById(ui.action==='photo'?'photo-btn':ui.action==='quick'?'quick':'bon-text');if(n)n.focus();if(ui.action==='quick')ui.action=''}
/* ---------- Entwickler-Werkzeuge: Erkennungsbericht ----------
   Enthält: den gelesenen Text, was die App daraus gemacht hat, und die korrigierte Fassung. Foto nur auf Wunsch. */
async function photoData(){
  if(!ui.photoUrl)return null;
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=ui.photoUrl});
  const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
  c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.8);
}
async function makeReport(){
  const d=ui.draft;if(!d||!d.orig)return 0;
  const withPhoto=!!(document.getElementById('dev-photo')||{}).checked;
  const o={app:APP_VERSION,erstellt:new Date().toISOString(),text:d.text||'',
    gelesen:d.orig,
    korrigiert:{merchant:d.merchant,date:d.date,total:d.total!=null&&d.total!==''?toNum(String(d.total)):null,items:d.items.map(i=>({name:i.name,gelesen:i.o||'',amount:toNum(i.amount),cat:i.cat}))},
    hinweise:(d.warn||[]).map(w=>w.t||w),q:d.q||null,leser:d.q&&d.q.engine?(d.q.engine==='ki'?'KI (PaddleOCR)'+(d.q.kiRows?', Kästen '+d.q.kiRows:''):'Tesseract'):'Text/PDF',seiten:d.pages||1};
  if(withPhoto)try{o.foto=await photoData()}catch(e){}
  await repAdd(o);const n=await repCount();ui.repCount=n;return n;
}
async function shareReports(){
  try{
    const all=await repAll();if(!all.length){ui.flash='Noch keine Berichte gesammelt.';render();return}
    const text=JSON.stringify({art:'kassensturz-erkennungsberichte',anzahl:all.length,berichte:all},null,1);
    const name=`kassensturz-berichte-${today()}.txt`,f=new File([text],name,{type:'text/plain'});
    if(canShareFiles()){try{await navigator.share({files:[f],title:'Kassensturz-Erkennungsberichte'});return}catch(e){if(e&&e.name==='AbortError')return}}
    download(name,text,'text/plain');ui.flash='Berichte heruntergeladen (Ordner „Downloads“).';render();
  }catch(e){ui.flash='Die Berichte ließen sich nicht laden.';render()}
}
async function boot(){
  main.innerHTML='<p class="muted" style="text-align:center;margin-top:40px">Lade …</p>';
  let loaded=null;try{loaded=await load()}catch(e){}
  state=migrate(loaded||seed());booted=true;
  // alter Stand nur im einfachen Speicher: gleich auch in die Datenbank übernehmen
  if(loaded&&!loadBroken)dbPut(lastJson||JSON.stringify(state));
  if(state.prefs.dev)repCount().then(n=>{ui.repCount=n}).catch(()=>{});
  ui.locked=!!getLock();
  {const q=new URLSearchParams(location.search);const a=q.get('action');
    if(a==='photo'||a==='text'){ui.action=a;history.replaceState(null,'',location.pathname+'#beleg')}
    if(a==='quick'){ui.action='quick';history.replaceState(null,'',location.pathname+'#monat')}}
  route();
  maybeTutorial();
  focusAction();
  checkShared();
  loadSnaps();
  kiPrefetch();
}
boot();
