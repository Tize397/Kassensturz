// Kassensturz – Ansichten (was auf dem Bildschirm steht)
// Die Dateien werden in dieser Reihenfolge geladen und teilen sich ihre Namen:
// daten.js → erkennung.js → ansichten.js → app.js
'use strict';
/* ---------- Ansichten ---------- */
function budgetBar(id,v,max){
  const c=cat(id);const b=state.useBudgets?(+state.budgets[id]||0):0;
  let cls='',w,bud='';
  if(b>0){const pc=v/b*100;w=Math.min(100,Math.max(0,pc));cls=pc>100?'over':pc>=80?'warn':'';
    bud=`<span class="bud">${fmt(v)} von ${fmt(b)} Budget · ${pc>100?`${fmt(v-b)} drüber`:`noch ${fmt(b-v)}`}</span>`}
  else w=max>0?Math.max(0,v/max*100):0;
  return `<div class="bar ${cls}" style="--c:${c.color}"><span class="lbl">${esc(c.name)}</span><span class="num">${fmt(v)}</span><div class="track"><i style="width:${w}%"></i></div>${bud}</div>`;
}
const pctTxt=f=>f>0&&f<0.005?'<1 %':Math.round(f*100)+' %';
function pieBlock(sl,act,sel,centerLbl){
  const total=sl.reduce((a,x)=>a+x.value,0);if(total<=0)return `<div class="list"><div class="empty">Keine Werte.</div></div>`;
  if(sel&&!sl.some(x=>x.id===sel))sel=null;
  const R=70,SW=26,C=2*Math.PI*R,gap=sl.length>1?1.4:0;let off=0;
  const arcs=sl.map(x=>{const len=x.value/total*C;const a=`<circle class="arc${sel===x.id?' on':''}${sel&&sel!==x.id?' dim':''}" cx="100" cy="100" r="${R}" style="stroke:${x.color}" stroke-width="${sel===x.id?SW+6:SW}" stroke-dasharray="${Math.max(0.1,len-gap).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)" data-act="${act}" data-id="${x.id}"><title>${esc(x.label)}: ${fmt(x.value)}</title></circle>`;off+=len;return a}).join('');
  const s=sel&&sl.find(x=>x.id===sel);
  const c1=s?esc(s.label):centerLbl,c2=fmt(s?s.value:total),c3=s?pctTxt(s.value/total):'';
  return `<div class="pie"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(centerLbl)}: ${sl.map(x=>esc(x.label)+' '+Math.round(x.value/total*100)+' Prozent').join(', ')}">${arcs}
    <text x="100" y="${c3?88:94}" text-anchor="middle" class="pc1">${c1.length>18?c1.slice(0,17)+'…':c1}</text>
    <text x="100" y="${c3?110:116}" text-anchor="middle" class="pc2">${c2}</text>${c3?`<text x="100" y="130" text-anchor="middle" class="pc1">${c3}</text>`:''}</svg>
    <div class="plegend">${sl.map(x=>`<button class="${sel===x.id?'on':''}${sel&&sel!==x.id?' dim':''}" data-act="${act}" data-id="${x.id}" aria-pressed="${sel===x.id}"><i class="dot" style="--c:${x.color}"></i><span class="n">${esc(x.label)}</span><span class="num">${fmt(x.value)}</span><span class="pct">${pctTxt(x.value/total)}</span></button>`).join('')}</div></div>`;
}
function dueDays(iso){return iso?Math.round((parseD(iso)-parseD(today()))/864e5):null}
function dueCls(iso){const n=dueDays(iso);return n==null?'soon':n<0?'due':n<=3?'due':'soon'}
function dueText(iso){const n=dueDays(iso);return n==null?'ohne Datum':n<0?`seit ${-n} ${-n===1?'Tag':'Tagen'} überfällig`:n===0?'heute fällig':`fällig in ${n} ${n===1?'Tag':'Tagen'}`}
const CHANGES={'2.10.0':['Die Belegerkennung lernt aus deinen Korrekturen: Verbesserst du einen verlesenen Namen, setzt die App ihn beim selben Händler künftig selbst ein. Gelöschte Störzeilen lässt sie beim nächsten Mal weg.','Sie merkt sich auch, wenn bei einem Händler der Name unter dem Preis steht.','Alle Korrekturen siehst und löschst du unter „Mehr → Kategorien & Gelerntes“.'],'2.9.0':['Sparziele und Rücklagen sind jetzt ein Bereich unter „Planen“. Beim Anlegen wählst du, was es sein soll.','Aufgeräumt: „Mehr“ hat weniger Bereiche, mehrere Hinweise im Monat sind zu einer Zeile gebündelt, die Anleitung ist auf dem neuesten Stand.','Wiederkehrende Ausgaben: Kommt derselbe Betrag drei Monate in Folge, schlägt die App vor, ihn als Fixkosten zu übernehmen.','Backup direkt an Google Drive teilen. Ist das letzte Backup älter als einen Monat, erinnert die App daran.','Deine Daten liegen jetzt in der Datenbank des Browsers, mit mehr Platz und einer zweiten Kopie. Genauso geschützt wie bisher.'],'2.8.1':['Kassensturz mit Rückfragen: Bei einer Differenz fragt die App nach Bargeld im Portemonnaie, zeigt Tage ohne Einträge und mögliche doppelte Belege.','Bargeld zählt beim Kassensturz mit: Abheben ist dann kein „nicht erfasst“ mehr.','Ab welcher Differenz die App nachfragt, stellst du unter „Mehr → Kassensturz“ ein (Standard 10 €).'],'2.8.0':['Belegerkennung gründlich überarbeitet: Schiefe, quer oder kopfüber fotografierte Bons dreht die App selbst gerade. Schatten, Stoff im Hintergrund und dunkle Screenshots gleicht sie aus.','Die App setzt Zeilen aus den Wortpositionen selbst zusammen, kombiniert zwei Lesedurchgänge und rechnet Summen, Mengen und Steuerzeilen nach. Bei einer falsch gelesenen Ziffer schlägt sie die Korrektur vor.','Verlesene Produktnamen gleicht die App mit deinen früheren Belegen ab. Neu: Knopf „Drehen und neu lesen“.','Automatische Sicherheitskopie: Die letzten drei Stände liegen unter „Mehr → Backup & Daten“.','Neu zum Einschalten unter „Mehr“: Kassensturz (Kontostand eintragen und sehen, was nicht erfasst ist) und Rücklagen (Töpfe für Unregelmäßiges).','Jahresrückblick unter „Verlauf“: Ausgaben, Kategorien im Vergleich zum Vorjahr, Händler und Produkte mit den höchsten Ausgaben.'],'2.7.1':['Bessere Fotos: Tisch oder Stoff neben dem Bon stören die Erkennung nicht mehr.','Bons, bei denen der Artikelname unter dem Preis steht, werden richtig zugeordnet.','Summen- und Steuerzeilen werden sicherer erkannt, auch bei Lesefehlern wie „gesant“ oder „EC-Cash mit PIN“.'],'2.7.0':['GiroCode auf Rechnungen: Die App liest den QR-Code für die Überweisung. Betrag und Empfänger stimmen damit sicher.','Kassen-Code auf Bons: Viele Kassenbons haben einen QR-Code der Kasse. Daraus übernimmt die App Summe, Datum und ob bar oder mit Karte bezahlt wurde.'],'2.6.1':['Rechnungen mit Tabelle (Menge, MwSt., Einzelpreis, Gesamt) wie vom REWE-Lieferservice werden vollständig gelesen.','Schlecht lesbare Preise wie „798€“ werden über Menge × Einzelpreis und die Belegsumme geprüft. Was sich nicht bestätigen lässt, ist gelb markiert.','Mehrere Screenshots einer langen Rechnung lassen sich zu einem Beleg zusammenfügen.','Pfand-Rückgaben werden abgezogen, Zahlungs- und Bankzeilen nicht mehr als Produkte gezählt.'],'2.6.0':['Mehrere Belege auf einmal: Fotos oder PDFs zusammen auswählen oder teilen, die App arbeitet sie nacheinander ab.','Steuer: neue Art „Vorsorge (Versicherungen)“ und eine Jahresübersicht, sortiert wie die Steuererklärung (Werbungskosten, Vorsorge, Handwerker, Krankheitskosten).','Bei Versicherungen unter Fixkosten schlägt die App die passende Steuer-Art vor.'],'2.5.0':['Schnelleingabe im Monat und unter „Beleg“: „Kaffee 3,50“ eintippen, fertig. Unbekanntes fragt die App einmal nach.','Planen aufgeräumt: Einnahmen, Fixkosten, Verträge und Sparziele zum Aufklappen, „+ Neu“ gleich oben.','Monat und Mehr kompakter: Details erst beim Antippen.','Kategorien: Name und Farbe änderbar, 24 Farben zur Auswahl.','Kurzbefehl „Schnelleingabe“: lange auf das App-Symbol drücken.'],'2.4.0':['Bessere Bon-Erkennung: Die App schneidet den Bon im Foto automatisch aus und liest ihn bei Bedarf zweimal.','Tankstellen-Bons wie von Aral werden erkannt.','PDF-Rechnungen öffnen, auch über „Teilen“ aus der Mail-App.','Netto-Rechnungen: MwSt. wird automatisch auf die Positionen verteilt.','Offene Rechnungen mit Zahlungsziel und Erinnerung.','Neue Steuer-Arten: Handwerkerleistungen und Krankheitskosten.','Hinweis, wenn eine Rechnung zu deinen Fixkosten passt.','Wischen nach links oder rechts wechselt zwischen den Reitern.','Kurze Anleitung: einmal beim Start und jederzeit unter „Mehr“, auch zu einzelnen Themen wie Sparzielen.']};
let newList=null;
function computeNew(){
  const seen=state.prefs.seenVersion;
  if(!seen&&!state.receipts.some(r=>!r.example)&&!state.fixed.some(f=>!f.example)){state.prefs.seenVersion=APP_VERSION;persist();newList=[];return}
  newList=Object.keys(CHANGES).filter(v=>cmpVer(v,APP_VERSION)<=0&&(!seen||cmpVer(v,seen)>0)).sort(cmpVer).reverse().flatMap(v=>CHANGES[v]);
}
function whatsNew(){
  if(newList==null)computeNew();
  if(!newList.length)return '';
  return `<div class="note update" role="status"><b>Neu in Version ${APP_VERSION}</b><ul class="steps">${newList.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="row" style="margin-top:8px"><button class="primary" data-act="seen">Alles klar</button></div></div>`;
}
function yearDue(){const t=today(),y=+t.slice(0,4),m=+t.slice(5,7),d=+t.slice(8,10);if(m===12&&d>=15)return y;if(m===1)return y-1;return null}
/* Wiederkehrende Ausgaben: derselbe Händler in drei Monaten nacheinander je einmal, mit (fast) gleichem Betrag */
function recurring(){
  const cur=thisYM(),dis=state.prefs.recDismiss||{};
  const fx=state.fixed.filter(f=>f.kind!=='in');
  const g=new Map();
  state.receipts.forEach(r=>{if(r.example||r.refund||r.open||r.pot)return;const ym=r.date.slice(0,7);if(ym>cur)return;
    const k=normKey(r.merchant||(r.items[0]&&r.items[0].name)||'');if(k.length<3)return;
    let e=g.get(k);if(!e){e={k,by:{}};g.set(k,e)}(e.by[ym]=e.by[ym]||[]).push(r)});
  const out=[];
  g.forEach(e=>{if(dis[e.k])return;
    for(const end of [cur,addMonths(cur,-1)]){
      const ms=[end,addMonths(end,-1),addMonths(end,-2)];
      if(!ms.every(m=>e.by[m]&&e.by[m].length===1))continue;
      const rs=ms.map(m=>e.by[m][0]),ts=rs.map(rTotal);
      const lo=Math.min(...ts),hi=Math.max(...ts);if(lo<2||hi>lo*1.1)continue;
      const last=rs[0],name=last.items.length===1&&letters(last.items[0].name)>=3&&!last.quick?last.merchant:(last.items.length===1?last.items[0].name:last.merchant);
      const amt=r2(ts[0]),nk=normKey(name);
      // schon als Fixkosten vorhanden?
      if(fx.some(f=>{const fk=normKey(f.name);return fk&&(fk.includes(e.k)||e.k.includes(fk)||fk.includes(nk))||Math.abs((+f.amount||0)-amt)<0.01&&f.interval===1}))break;
      const cc={};last.items.forEach(i=>cc[i.cat]=(cc[i.cat]||0)+Math.abs(i.amount));
      const c=Object.keys(cc).sort((a,b)=>cc[b]-cc[a])[0]||'sonstiges';
      out.push({k:e.k,name,amount:amt,cat:c,thisMonth:!!e.by[cur]});break}});
  return out;
}
function backupDue(){
  const n=state.receipts.filter(r=>!r.example).length;if(n<5)return null;
  if(state.prefs.backupSnooze&&state.prefs.backupSnooze>today())return null;
  if(!state.lastBackup){const first=state.receipts.filter(r=>!r.example).map(r=>r.date).sort()[0]||today();return first<=addDays(today(),-14)?-1:null}
  const d=Math.floor((Date.now()-state.lastBackup)/864e5);return d>=30?d:null;
}
function vMonat(){
  const ym=ui.ym;const st=monthStats(ym);
  const rs=st.rs.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const left=st.left;
  const ids=new Set(Object.keys(st.by).filter(k=>Math.abs(st.by[k])>0.004));
  if(state.useBudgets)Object.keys(state.budgets).forEach(k=>{if(+state.budgets[k]>0&&state.categories.some(c=>c.id===k))ids.add(k)});
  const cats=[...ids].map(id=>[id,st.by[id]||0]).sort((a,b)=>b[1]-a[1]);
  const max=cats.length?Math.max(...cats.map(c=>c[1])):1;
  const hasEx=state.receipts.some(r=>r.example)||state.fixed.some(f=>f.example)||state.goals.some(g=>g.example);
  let h='';
  if(ui.flash) h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;
  h+=vQuick();
  h+=whatsNew();
  const hints=[];const H=x=>hints.push(x);
  const yd=yearDue();
  if(yd&&!(state.yearExport[yd]&&state.yearExport[yd].done)&&!ui.yearHide) H(`<div class="note"><b>Jahresabschluss ${yd}:</b> Lade jetzt deinen Jahresexport herunter, mit Jahres-CSV, Steuerliste und Backup.<div class="row" style="margin-top:8px"><button class="primary" data-act="year-go" data-y="${yd}">Zum Jahresexport</button><button class="ghost" data-act="year-later">Später</button></div></div>`);
  const openInv=state.receipts.filter(r=>r.open).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
  if(openInv.length){const op=ui.monOpen==='inv',first=openInv[0];
    H(`<div class="note ${openInv.some(r=>dueCls(r.due)==='due')?'bad':'warn'} mini"><button class="mini-h" data-act="mon-open" data-sec="inv" aria-expanded="${op}"><span><b>${openInv.length===1?'1 offene Rechnung':openInv.length+' offene Rechnungen'}</b> · ${esc(first.merchant||'Rechnung')} ${dueText(first.due)}</span><span class="chev" aria-hidden="true">›</span></button>
    ${op?`<div class="openlist">${openInv.map(r=>`<div><span>${esc(r.merchant||'Rechnung')} · <b class="num">${fmt(rTotal(r))}</b> · ${r.due?fmtD(r.due)+', ':''}${dueText(r.due)}</span><button data-act="paid" data-id="${r.id}">Bezahlt</button></div>`).join('')}</div>`:''}</div>`)}
  const due=contracts().filter(x=>x.c.days<=42);
  if(due.length){const op=ui.monOpen==='kuend',first=due[0];
    H(`<div class="note ${due.some(x=>x.c.days<=14)?'bad':'warn'} mini"><button class="mini-h" data-act="mon-open" data-sec="kuend" aria-expanded="${op}"><span><b>Kündigungsfrist</b> · ${esc(first.f.name)} bis ${fmtD(first.c.deadline)}${due.length>1?` und ${due.length-1} weitere`:''}</span><span class="chev" aria-hidden="true">›</span></button>
    ${op?`<div class="openlist">${due.map(({f,c})=>`<div><span>${esc(f.name)} · bis ${fmtD(c.deadline)} (${deadlineText(c)})</span></div>`).join('')}<div><button data-act="plan-go" data-sec="vertraege">Verträge ansehen</button></div></div>`:''}</div>`)}
  if(hasEx) H(`<div class="note warn"><b>Das sind Beispieldaten.</b> Sie zeigen, wie die App gefüllt aussieht.<div class="row" style="margin-top:8px"><button data-act="remove-examples">Beispieldaten entfernen</button></div></div>`);
  if(state.useBudgets){
    const warn=cats.filter(([id,v])=>{const b=+state.budgets[id]||0;return b>0&&v>=b*.8});
    if(warn.length) H(`<div class="note ${warn.some(([id,v])=>v>+state.budgets[id])?'bad':'warn'}" role="status"><b>Budget-Hinweis:</b> ${warn.map(([id,v])=>`${esc(cat(id).name)} ${Math.round(v/state.budgets[id]*100)} %`).join(' · ')}</div>`);
  }
  if(ym===thisYM()){
    const bd=backupDue();
    if(bd!=null)H(`<div class="note warn"><b>${bd<0?'Noch kein Backup.':`Letztes Backup vor ${bd} Tagen.`}</b> Deine Daten liegen nur auf diesem Handy. Teile jetzt eine Sicherung, z. B. an Google Drive.<div class="row" style="margin-top:8px"><button class="primary" data-act="backup-go">Jetzt sichern</button><button class="ghost" data-act="backup-snooze">In 7 Tagen erinnern</button></div></div>`);
    recurring().forEach(x=>H(`<div class="note"><b>Wiederkehrend?</b> ${esc(x.name)} mit ${fmt(x.amount)} kam drei Monate in Folge. Als monatliche Fixkosten übernehmen?<p class="small muted" style="margin:4px 0 0">Danach zählt der Betrag jeden Monat automatisch${x.thisMonth?' ab nächstem Monat':''}. Erfasse ihn dann nicht mehr als Beleg.</p><div class="row" style="margin-top:8px"><button class="primary" data-act="rec-take" data-k="${esc(x.k)}">Übernehmen</button><button class="ghost" data-act="rec-no" data-k="${esc(x.k)}">Nein, ist einmalig</button></div></div>`));
  }
  // Hinweise: einer steht direkt da, mehrere werden gebündelt (dringende bleiben sichtbar)
  if(hints.length<=1)h+=hints.join('');
  else{const urgent=hints.filter(x=>x.startsWith('<div class="note bad')),rest=hints.filter(x=>!x.startsWith('<div class="note bad'));
    h+=urgent.join('');
    if(rest.length===1)h+=rest[0];
    else if(rest.length){const op=!!ui.hintsOpen,lab=rest.map(x=>((x.match(/<b>([^<]{1,40})<\/b>/)||[])[1]||'Hinweis').replace(/[.:]$/,'')).slice(0,3).join(' · ');
      h+=`<div class="note mini hintbox"><button class="mini-h" data-act="hints-toggle" aria-expanded="${op}"><span><b>${rest.length} Hinweise</b> · ${esc(lab)}</span><span class="chev" aria-hidden="true">›</span></button>${op?`<div class="hintlist">${rest.join('')}</div>`:''}</div>`}}
  h+=`<div class="figs">
    <div class="fig"><span>Einnahmen</span><b>${fmt(st.inc)}</b></div>
    <div class="fig"><span>Ausgaben</span><b>${fmt(st.out)}</b></div>
    <div class="fig main"><span>Übrig${st.saved>0?`<small>nach ${fmt(st.saved)} Sparen</small>`:''}${st.potPaid>0?`<small>${fmt(st.potPaid)} aus Rücklagen</small>`:''}</span><b class="${left<0?'minus':''}">${fmt(left)}</b></div></div>
    <div class="split" aria-hidden="true">${(()=>{const base=Math.max(st.out+Math.max(0,st.saved),st.inc,0.01);const w=v=>Math.max(0,v)/base*100;
      return `<i style="width:${w(st.fixOut)}%;background:var(--accent)"></i><i style="width:${w(st.varOut)}%;background:var(--var)"></i><i style="width:${w(st.saved)}%;background:var(--ok)"></i>`})()}</div>
    <div class="legend"><span style="--c:var(--accent)">Fixkosten <b class="num">${fmt(st.fixOut)}</b></span><span style="--c:var(--var)">Belege <b class="num">${fmt(st.varOut)}</b></span>${st.saved?`<span style="--c:var(--ok)">Gespart <b class="num">${fmt(st.saved)}</b></span>`:''}${st.inc>0?`<span style="--c:var(--line)">frei</span>`:''}</div>`;
  if(state.prefs.kasse)h+=vKasse(ym);
  const mode=state.prefs.chart==='pie'?'pie':'bar';
  h+=`<div class="sechead"><h2>Nach Kategorie</h2><div class="seg" role="group" aria-label="Darstellung"><button data-act="chart-mode" data-m="bar" aria-pressed="${mode==='bar'}">Balken</button><button data-act="chart-mode" data-m="pie" aria-pressed="${mode==='pie'}">Kuchen</button></div></div>`;
  if(!cats.length) h+=`<div class="list"><div class="empty">Noch keine Ausgaben in diesem Monat.</div></div>`;
  else if(mode==='bar') h+=`<div class="bars">${cats.map(([id,v])=>budgetBar(id,v,max)).join('')}</div>`;
  else{
    const sl=cats.filter(([,v])=>v>0.004).map(([id,v])=>({id,label:cat(id).name,value:v,color:cat(id).color}));
    h+=pieBlock(sl,'pie-sel',ui.pieSel,'Ausgaben');
    if(cats.some(([,v])=>v<-0.004)) h+=`<p class="muted small">Kategorien mit mehr Retouren als Ausgaben sind im Kuchen nicht enthalten.</p>`;
    if(st.inc>0){
      const fix=Math.max(0,st.fixOut),va=Math.max(0,st.varOut),sv=Math.max(0,st.saved),free=st.inc-fix-va-sv;
      const sl2=[{id:'fix',label:'Fixkosten',value:fix,color:'var(--accent)'},{id:'var',label:'Belege',value:va,color:'var(--var)'},{id:'sav',label:'Gespart',value:sv,color:'var(--ok)'},{id:'free',label:'Frei',value:Math.max(0,free),color:'var(--free)'}].filter(x=>x.value>0.004);
      h+=`<h2>Wohin dein Einkommen geht</h2>`+pieBlock(sl2,'pie-sel2',ui.pieSel2,free<0?'Ausgaben + Sparen':'Einnahmen');
      if(free<-0.004) h+=`<div class="note bad">Diesen Monat gehen ${fmt(-free)} mehr raus, als reinkommt.</div>`;
    }
  }
  if(state.goals.length){const op=ui.monOpen==='goals',tot=state.goals.reduce((a,g)=>a+goalBalance(g),0),tg=state.goals.reduce((a,g)=>a+(+g.target||0),0);
    h+=`<div class="acc" style="margin-top:22px">${accHead('mgoals',op,state.goals.some(g=>g.pot)?(state.goals.some(g=>!g.pot)?'Sparziele & Rücklagen':'Rücklagen'):'Sparziele',fmt(tot),`${state.goals.length===1?'1 Eintrag':state.goals.length+' Einträge'}${tg?` · Ziel ${fmt(tg)}`:''}`,'mon-goals')}
    ${op?`<div class="acc-p"><div class="bars">${state.goals.map(g=>{const i=goalInfo(g);return `<div class="bar" style="--c:var(--ok)"><span class="lbl">${esc(g.name)}${g.pot?'<small>Rücklage</small>':i.done?'<small>erreicht</small>':''}</span><span class="num">${fmt(i.bal)}${i.target?` / ${fmt(i.target)}`:''}</span>${i.target?`<div class="track"><i style="width:${i.pct}%"></i></div>`:''}</div>`}).join('')}</div>
    <button class="ghost" data-act="plan-go" data-sec="sparziele" style="margin-top:6px">Sparziele verwalten</button></div>`:''}</div>`;
  }
  h+=`<h2>Belege im ${MONTHS[+ym.slice(5)-1]}</h2>`;
  const LIM=5,shown=ui.showAll?rs:rs.slice(0,LIM);
  h+=rs.length?`<div class="list">${shown.map(receiptRow).join('')}</div>${rs.length>LIM?`<button class="ghost" data-act="show-all" style="margin-top:6px">${ui.showAll?'Weniger anzeigen':`Alle ${rs.length} Belege anzeigen`}</button>`:''}`
    :`<div class="list"><div class="empty">Noch keine Belege. Tippe oben z. B. „Kaffee 3,50“ ein oder fotografiere unter <a href="#beleg">Beleg</a> einen Bon.</div></div>`;
  h+=`<p class="muted small" style="margin-top:14px">Letzte Sicherung: ${state.lastBackup?new Date(state.lastBackup).toLocaleDateString('de-DE'):'noch keine'} · <a href="#mehr">Backup unter Mehr</a></p>`;
  return h;
}
/* Kassensturz: Kontostand am Monatsende mit dem vergleichen, was die App erwartet */
function lastDay(ym){const [y,m]=ym.split('-').map(Number);return ym+'-'+pad(new Date(y,m,0).getDate())}
function kasseInfo(ym){
  const k=state.kasse[ym]||{},pv=state.kasse[addMonths(ym,-1)]||{},deb=k.deb||[];
  const st=monthStats(ym);let inc=0,fix=0;const irr=[];
  // Nicht monatliche Einträge zählen hier nur, wenn sie in diesem Monat wirklich gebucht wurden (dann voll)
  state.fixed.forEach(f=>{if(!activeIn(f,ym))return;let v;
    if(f.interval>1){irr.push(f);v=deb.includes(f.id)?f.amount:0}else v=shareOf(f);
    if(f.kind==='in')inc+=v;else fix+=v});
  let open=0;st.rs.forEach(r=>{if(r.open)open+=rTotal(r)});
  const booked=r2(fix+st.varOut-open-st.potPaid+st.saved);
  const has=k.bal!=null&&pv.bal!=null;
  // Bargeld: Abheben ist nur Umschichten vom Konto ins Portemonnaie. Gerechnet wird mit Konto + Bargeld.
  const cash=k.cash!=null&&pv.cash!=null,cashD=cash?r2(pv.cash-k.cash):0;
  const actual=has?r2(pv.bal+inc-k.bal+cashD):null;
  return {k,pv,irr,deb,inc:r2(inc),booked,actual,diff:has?r2(actual-booked):null,has,saved:st.saved,cash,cashD,rs:st.rs};
}
const kasseTol=()=>{const t=+state.prefs.kasseTol;return t>=0&&isFinite(t)&&state.prefs.kasseTol!==''&&state.prefs.kasseTol!=null?t:10};
// Tage im Monat ohne einen einzigen Eintrag (bis heute)
function emptyDays(ym,rs){
  const last=ym===thisYM()?+today().slice(8):+lastDay(ym).slice(8),seen=new Set(rs.map(r=>+r.date.slice(8)));const out=[];
  for(let d=1;d<=last;d++)if(!seen.has(d))out.push(d);return out;
}
// Mögliche doppelte Belege: gleicher Tag, gleicher Händler, gleicher Betrag
function dupReceipts(rs){
  const m=new Map(),out=[];
  rs.forEach(r=>{if(r.example)return;const k=r.date+'|'+normKey(r.merchant)+'|'+rTotal(r).toFixed(2);if(m.has(k))out.push(r);else m.set(k,r)});
  return out;
}
function vKasse(ym){
  const i=kasseInfo(ym),op=ui.monOpen==='mkasse',mo=MONTHS[+ym.slice(5)-1],pm=MONTHS[+addMonths(ym,-1).slice(5)-1],tol=kasseTol();
  const ok=i.has&&Math.abs(i.diff)<0.5,acc=i.has&&i.k.accept!=null&&Math.abs(i.k.accept-i.diff)<0.005;
  const val=!i.has?null:ok?'passt':fmt(Math.abs(i.diff));
  const sub=!i.has?'Kontostand eintragen':ok?'Konto und App passen zusammen':acc?'Differenz so übernommen':i.diff>0?'nicht erfasst':'mehr Geld da als erwartet';
  let h=`<div class="acc" style="margin-top:14px">${accHead('mkasse',op,'Kassensturz',val,sub,'mon-open')}`;
  if(op){
    const showCash=i.k.cash!=null||i.pv.cash!=null||ui.kCash;
    const inp=(id,lab,v)=>`<label class="f" for="${id}">${lab}<input id="${id}" inputmode="decimal" value="${v!=null?fmtIn(v):''}" placeholder="0,00" style="font-family:var(--f-mono)"></label>`;
    h+=`<div class="acc-p"><form class="form inpanel" id="kasse-form" autocomplete="off">
      ${inp('k-prev','Kontostand Ende '+pm,i.pv.bal)}${inp('k-bal','Kontostand Ende '+mo,i.k.bal)}
      ${showCash?inp('k-cprev','Bargeld Ende '+pm+(i.pv.cash==null?' (ungefähr)':''),i.pv.cash)+inp('k-cash','Bargeld jetzt im Portemonnaie',i.k.cash):''}
      ${i.irr.length?`<div class="full"><p class="small" style="margin:0 0 4px;font-weight:600">Im ${mo} wirklich gebucht?</p>${i.irr.map(f=>`<label class="check small"><input type="checkbox" data-kdeb="${f.id}"${i.deb.includes(f.id)?' checked':''}> ${esc(f.name)} · ${fmt(f.amount)} ${INTERVALS[f.interval]||''}</label>`).join('')}</div>`:''}
      ${ui.err?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
      <div class="row full"><button class="primary" type="submit">Speichern</button></div></form>`;
    if(i.has){
      h+=`<div class="lines" style="margin-top:10px"><div><span class="n">Einnahmen</span><span class="num">${fmt(i.inc)}</span></div>
        <div><span class="n">Laut Konto${i.cash?' und Bargeld':''} ausgegeben</span><span class="num">${fmt(i.actual)}</span></div>
        <div><span class="n">In der App erfasst${i.saved>0?' (mit Sparen)':''}</span><span class="num">${fmt(i.booked)}</span></div>
        <div><span class="n"><b>${ok?'Differenz':i.diff>0?'Nicht erfasst':'Mehr Geld da als erwartet'}</b></span><span class="num"><b>${ok?'0,00 €':fmt(Math.abs(i.diff))}</b></span></div></div>`;
      if(ok)h+=`<div class="note" style="margin-top:10px"><b>Passt.</b> Konto${i.cash?', Bargeld':''} und App stimmen überein.</div>`;
      else if(acc)h+=`<p class="small muted" style="margin:8px 0 0">Du hast die Differenz so übernommen. <button type="button" class="linkbtn" data-act="kasse-reopen" data-ym="${ym}">Nochmal prüfen</button></p>`;
      else if(Math.abs(i.diff)>=tol)h+=kasseHelp(ym,i);
      else h+=`<p class="small muted" style="margin:8px 0 0">Kleine Abweichung unter ${fmt(tol)}.</p>${i.diff>0?`<div class="row" style="margin-top:6px"><button data-act="kasse-book" data-ym="${ym}">${fmt(i.diff)} als „nicht erfasst“ buchen</button></div>`:''}`;
    }
    h+=`<p class="small muted" style="margin:10px 0 0">Am besten am Monatsende eintragen. Die App rechnet so, als ob Sparraten und Rücklagen das Konto verlassen. Offene Rechnungen und aus Rücklagen bezahlte Belege zählen nicht mit.</p></div>`;
  }
  return h+`</div>`;
}
// Rückfragen bei einer Differenz: Woran könnte es liegen?
function kasseHelp(ym,i){
  const mo=MONTHS[+ym.slice(5)-1];let n=0;
  let h=`<div class="kassehelp"><p class="kh-t">Woran könnte es liegen?</p>`;
  const step=(t,body)=>`<div class="kh-s"><span class="kh-n">${++n}</span><div><p class="kh-q">${t}</p>${body}</div></div>`;
  // 1. Bargeld
  if(!i.cash&&!i.k.noCash)h+=step('Hast du Bargeld im Portemonnaie?',`<p class="small muted">Abgehobenes Geld sieht für das Konto wie ausgegeben aus. ${i.diff<0?'Und Bargeld vom Vormonat, das du jetzt ausgegeben hast, fehlt auf dem Konto nicht.':''}</p>
    <div class="row"><button type="button" class="primary" data-act="kasse-cash" data-ym="${ym}">Ja, Bargeld eintragen</button><button type="button" data-act="kasse-nocash" data-ym="${ym}">Nein</button></div>`);
  else if(i.cash)h+=step('Bargeld ist eingerechnet',`<p class="small muted">${i.cashD>0?`Dein Bargeld ist um ${fmt(i.cashD)} weniger geworden.`:i.cashD<0?`Du hast ${fmt(-i.cashD)} mehr Bargeld als Ende des Vormonats.`:'Dein Bargeld ist gleich geblieben.'} Stimmen die Beträge oben?</p>`);
  if(i.diff>0){
    // 2. Alles eingetragen?
    const ed=emptyDays(ym,i.rs.filter(r=>!r.example));
    const days=ed.length?(ed.length>12?`An ${ed.length} Tagen im ${mo} hast du nichts erfasst.`:`An diesen Tagen im ${mo} hast du nichts erfasst: ${ed.map(d=>d+'.').join(', ')}`):'';
    const notDeb=i.irr.filter(f=>!i.deb.includes(f.id)&&f.kind!=='in');
    h+=step('Hast du alles eingetragen?',`${days?`<p class="small">${days}</p>`:''}${notDeb.length?`<p class="small">Noch nicht als abgebucht angehakt: ${notDeb.map(f=>`${esc(f.name)} (${fmt(f.amount)})`).join(', ')}. Falls doch abgebucht, oben anhaken.</p>`:''}
      <p class="small muted">Typisch vergessen: Bäcker, Kantine, Automaten, Spenden, Online-Käufe, Abos.</p>
      <div class="row"><button type="button" data-act="photo">Beleg fotografieren</button><button type="button" data-act="kasse-quick">Schnelleingabe</button></div>`);
  }else{
    // 2. Zu viel erfasst?
    const du=dupReceipts(i.rs);
    h+=step('Ist etwas doppelt oder fehlt eine Einnahme?',`${du.length?`<p class="small"><b>Vielleicht doppelt:</b> ${du.map(r=>`${esc(r.merchant)} ${fmt(rTotal(r))} am ${fmtD(r.date)}`).join(', ')}. Du findest sie unten in der Liste und kannst sie dort löschen.</p>`:''}
      <p class="small muted">Weitere Gründe: eine Einnahme fehlt (z. B. Erstattung, Rückzahlung), eine Rücklage oder Sparrate liegt noch auf dem Konto${i.cash?'':', oder du hast Bargeld vom Vormonat ausgegeben'}.</p>`);
  }
  // 3. Rest
  h+=step('Und der Rest?',`<div class="row">${i.diff>0?`<button type="button" data-act="kasse-book" data-ym="${ym}">${fmt(i.diff)} als „nicht erfasst“ buchen</button>`:''}<button type="button" class="ghost" data-act="kasse-accept" data-ym="${ym}">So lassen</button></div>`);
  return h+`</div>`;
}
function receiptRow(r){
  const open=ui.open===r.id;const cs=[...new Set(r.items.map(i=>i.cat))];const t=rTotal(r);
  return `<div class="item"><button class="head" data-act="toggle" data-id="${r.id}" aria-expanded="${open}">
    <span class="d">${r.date.slice(8)}.${r.date.slice(5,7)}.</span>
    <span class="m">${esc(r.merchant||'Ohne Händler')}${r.open?` <span class="tag ${dueCls(r.due)}">offen${r.due?' · bis '+fmtD(r.due).slice(0,6):''}</span>`:''}${r.refund?' <span class="tag ret">Retoure</span>':''}${r.pot&&state.goals.some(g=>g.id===r.pot)?' <span class="tag">Rücklage</span>':''}${r.example?' <span class="tag ex">Beispiel</span>':''}<span class="dots">${cs.map(c=>`<i class="dot" style="--c:${cat(c).color}" title="${esc(cat(c).name)}"></i>`).join('')}</span></span>
    <span class="num${t<0?' neg':''}">${fmt(t)}</span></button>
    ${open?`<div class="detail"><div class="lines">${r.items.map(i=>`<div><span class="n">${esc(i.name)}${i.tax?` <span class="tag tax" title="${esc(TAXKINDS[i.tax]||'')}">§ absetzbar</span>`:''}</span><span class="c">${esc(cat(i.cat).name)}</span><span class="num">${fmt(i.amount)}</span></div>`).join('')}</div>
    <div class="row">${ui.confirmDel===r.id?`<span class="small">Beleg wirklich löschen?</span><button class="danger" data-act="del-yes" data-id="${r.id}">Ja, löschen</button><button data-act="del-no">Abbrechen</button>`
      :`${r.open?`<button class="primary" data-act="paid" data-id="${r.id}">Als bezahlt markieren</button>`:''}${r.refund?'':`<button class="${r.open?'':'primary'}" data-act="repeat" data-id="${r.id}">Nochmal erfassen</button>`}<button data-act="edit" data-id="${r.id}">Bearbeiten</button>${r.refund?'':`<button data-act="refund" data-id="${r.id}">Retoure erfassen</button><button data-act="tpl-from" data-id="${r.id}">Als Vorlage merken</button>`}<button class="ghost danger" data-act="del" data-id="${r.id}">Löschen</button>`}</div></div>`:''}</div>`;
}

/* Vorlagen und Wiederholen */
const tplTotal=t=>t.items.reduce((a,i)=>a+(+i.amount||0),0);
const tplSig=x=>normKey(x.merchant)+'|'+x.items.map(i=>normKey(i.name)+':'+r2(i.amount)).join(',');
function addTemplate(r){
  const t={id:'t'+uid(),name:(r.merchant||(r.items[0]&&r.items[0].name)||'Vorlage').slice(0,40),merchant:r.merchant||'',
    items:r.items.filter(i=>i.amount>0).map(i=>{const o={name:i.name,amount:r2(i.amount),cat:i.cat};if(i.tax)o.tax=i.tax;return o})};
  if(!t.items.length||state.templates.some(x=>tplSig(x)===tplSig(t)))return false;
  state.templates.push(t);return true;
}
function openPrefilled(src,from,isTpl){
  ui.draft={id:null,refund:false,merchant:src.merchant||'',date:today(),total:null,always:false,from,fromTpl:!!isTpl,
    items:src.items.filter(i=>i.amount>0).map(i=>({name:i.name,amount:fmtIn(i.amount),cat:state.categories.some(c=>c.id===i.cat)?i.cat:'',tax:i.tax||'',src:'übernommen',flag:false}))};
  if(!ui.draft.items.length)ui.draft.items.push({name:'',amount:'',cat:'',src:'',flag:true});
  ui.dupOk=true;ui.dup=null;ui.err='';
}
function vTemplates(){
  if(!state.templates.length) return '';
  if(ui.tplEdit) return `<div class="tpls"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Vorlagen bearbeiten</h3><button class="ghost" data-act="tpl-edit">Fertig</button></div>
    <div class="list">${state.templates.map(t=>`<div class="rule" style="grid-template-columns:minmax(0,1fr) auto auto"><input id="tn-${t.id}" data-tpl="${t.id}" value="${esc(t.name)}" aria-label="Name der Vorlage"><span class="num">${fmt(tplTotal(t))}</span><button class="icon ghost danger" data-act="tpl-del" data-id="${t.id}" aria-label="Vorlage ${esc(t.name)} löschen">×</button></div>`).join('')}</div></div>`;
  return `<div class="tpls"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Vorlagen</h3><button class="ghost" data-act="tpl-edit">Bearbeiten</button></div>
    <div class="chips">${state.templates.map(t=>`<button class="tpl" data-act="tpl-use" data-id="${t.id}"><span>${esc(t.name)}</span><span class="num">${fmt(tplTotal(t))}</span></button>`).join('')}</div></div>`;
}

/* Schnelleingabe: „Kaffee 3,50“ */
function parseQuick(t){
  t=String(t||'').trim().replace(/\s+/g,' ');
  let m=t.match(/^(.*\S)\s+(-?\d{1,5}(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)\s*(?:€|eur|euro)?$/i);
  let name,amt;
  if(m){name=m[1];amt=m[2]}
  else{m=t.match(/^(\d{1,5}(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)\s*(?:€|eur|euro)?\s+(.+)$/i);if(m){amt=m[1];name=m[2]}}
  if(!m)return null;
  name=name.replace(/\s*(€|eur|euro|für|fuer)$/i,'').trim();
  const a=toNum(amt);
  if(!(a>0)||letters(name)<2)return null;
  return {name:name.slice(0,60),amount:r2(a)};
}
function vQuick(){
  const q=ui.quickAsk,d=ui.quickDone;
  let h=`<form class="quick" id="quick-form" autocomplete="off"><label class="sr" for="quick">Schnelleingabe</label>
    <input id="quick" enterkeyhint="done" placeholder="Schnelleingabe, z. B. Kaffee 3,50" value="${esc(ui.quickText||'')}" autocapitalize="sentences">
    <button class="primary" type="submit" aria-label="Ausgabe speichern">+</button></form>`;
  if(ui.quickErr) h+=`<p class="err" role="alert" style="margin:6px 2px 0">${esc(ui.quickErr)}</p>`;
  if(q) h+=`<div class="quickask" role="group" aria-label="Kategorie wählen"><p style="margin:0"><b>Wohin gehört „${esc(q.name)}“?</b> <span class="num">${fmt(q.amount)}</span></p>
    <div class="chips">${state.categories.map(c=>`<button class="catchip" data-act="quick-cat" data-c="${c.id}"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>
    <div class="row"><button class="ghost" data-act="quick-cancel">Abbrechen</button><span class="muted small">Die App merkt sich deine Wahl.</span></div></div>`;
  else if(d) h+=`<div class="quickdone" role="status"><span>Gespeichert: ${esc(d.name)} <b class="num">${fmt(d.amount)}</b> · ${esc(cat(d.cat).name)}</span><button class="ghost" data-act="quick-undo">Rückgängig</button></div>`;
  return `<div class="quickwrap">${h}</div>`;
}
let quickTimer=null;
function saveQuick(name,amount,c){
  const rec={id:uid(),date:today(),merchant:name,quick:true,items:[{name,amount,cat:c}]};
  state.receipts.push(rec);
  const k=normKey(name);if(k.length>=3)state.rules.products[k]=c;
  persist();
  ui.quickAsk=null;ui.quickText='';ui.quickErr='';ui.quickDone={id:rec.id,name,amount,cat:c};
  if(ui.tab==='monat'&&ui.ym!==thisYM())ui.ym=thisYM();
  clearTimeout(quickTimer);quickTimer=setTimeout(()=>{if(ui.quickDone&&ui.quickDone.id===rec.id){ui.quickDone=null;if(!document.activeElement||document.activeElement.id!=='quick')render()}},8000);
  render();const n=document.getElementById('quick');if(n)n.focus({preventScroll:true});
}
function submitQuick(){
  const t=val('quick');ui.quickText=t;
  if(!t.trim()){ui.quickErr='';return}
  const p=parseQuick(t);
  if(!p){ui.quickErr='Schreib zuerst, was es war, und dann den Betrag, z. B. „Kaffee 3,50“.';ui.quickDone=null;render();const n=document.getElementById('quick');if(n)n.focus();return}
  const c=classify(p.name,{cat:null,single:false});
  if(c.flag||!c.cat){ui.quickAsk=p;ui.quickDone=null;ui.quickErr='';render();return}
  saveQuick(p.name,p.amount,c.cat);
}

/* Mehrere Belege nacheinander */
function qBar(){
  if(!(ui.qTotal>1))return '';const cur=ui.qTotal-(ui.queue?ui.queue.length:0);
  return `<div class="qbar" role="status"><span><b>Beleg ${cur} von ${ui.qTotal}</b>${ui.qSaved?` · ${ui.qSaved} gespeichert`:''}</span>${ui.queue&&ui.queue.length?'<button class="ghost" data-act="queue-stop">Restliche überspringen</button>':''}</div>`;
}
function startQueue(files){
  files=files.filter(Boolean);if(!files.length)return;
  ui.queue=files.slice(1);ui.qTotal=files.length;ui.qSaved=0;ui.flash='';
  runOCR(files[0]);
}
function queueNext(){
  if(ui.queue&&ui.queue.length){runOCR(ui.queue.shift());return true}
  const n=ui.qSaved,tot=ui.qTotal;ui.queue=null;ui.qTotal=0;ui.qSaved=0;
  if(tot>1){ui.draft=null;const msg=`${n} von ${tot} Belegen gespeichert.`;if(location.hash!=='#monat'){ui.flashNext=msg;location.hash='#monat'}else{ui.flash=msg;render()}return true}
  return false;
}

function vBeleg(){
  const d=ui.draft;
  if(ui.ocr) return `<h2>Bon wird gelesen</h2>${qBar()}<div class="drop"><b id="ocr-label">${esc(ui.ocr.label)}</b><div class="progress"><i id="ocr-bar" style="width:${Math.round((ui.ocr.p||0)*100)}%"></i></div>
    <p class="muted small" style="margin:0">Die Texterkennung läuft auf deinem Handy. Beim ersten Mal lädt sie einmalig die deutschen Sprachdaten (einige MB). Für ein sicheres Ergebnis liest sie den Bon bei Bedarf zweimal.</p></div>`;
  if(!d&&ui.pick){const n=ui.pick.length;
    return `<h2>${n} Dateien gewählt</h2><div class="pickbox">
      <p style="margin:0">Sind das <b>${n} verschiedene Belege</b> oder <b>Seiten einer einzigen Rechnung</b>, zum Beispiel mehrere Screenshots einer langen Online-Rechnung?</p>
      <button class="primary" data-act="pick-sep">${n} einzelne Belege</button>
      <button data-act="pick-merge">Seiten einer Rechnung zusammenfügen</button>
      <button class="ghost" data-act="pick-cancel">Abbrechen</button>
      <p class="muted small" style="margin:0">Tipp: Ist die Rechnung eine PDF-Datei, teile lieber die PDF direkt. Die liest die App ohne Lesefehler.</p></div>`}
  if(!d){
    return `${ui.flash?`<div class="flash" role="status">${esc(ui.flash)}</div>`:''}
    <h2>Neuer Beleg</h2>
    ${vQuick()}
    ${vTemplates()}
    <div class="drop${ui.action==='photo'?' hot':''}"><button id="photo-btn" class="primary" data-act="photo" style="justify-content:center">Fotos, Screenshots oder PDFs wählen</button>
      ${ui.action==='photo'?'<p class="small" style="margin:0;font-weight:600">Tippe auf den Knopf, dann „Kamera“ oder ein Bild aus der Galerie wählen.</p>':''}
      <p class="muted small" style="margin:0">Du kannst mehrere auf einmal auswählen, die App arbeitet sie nacheinander ab. Fotografiere Bons formatfüllend, gerade und gut beleuchtet. Fotos und PDF-Rechnungen kannst du auch aus Galerie oder Mail über „Teilen“ → Kassensturz schicken.</p></div>
    <details class="note"><summary><b>Erkennung klappt nicht gut? Text selbst kopieren</b></summary>
      <ul class="steps"><li>Foto in Google Fotos öffnen, „Lens“ antippen, „Text“ wählen, „Alles auswählen“ und kopieren, dann unten einfügen.</li>
      <li>Bei Online-Bestellungen den Text der Bestellbestätigung markieren und kopieren.</li></ul></details>
    <label class="f" for="bon-text">Text des Belegs
      <textarea id="bon-text" rows="8" placeholder="REWE Markt GmbH&#10;BIO BANANEN   1,78 B&#10;…&#10;SUMME   EUR   12,92">${esc(ui.paste)}</textarea></label>
    ${ui.err?`<p class="err" role="alert">${esc(ui.err)}</p>`:''}
    ${ui.err&&ui.lastFile?`<div class="row" style="margin:6px 0 10px"><button data-act="rot-reread">↻ Foto drehen und neu lesen</button></div>`:''}
    ${ui.err&&ui.queue&&ui.queue.length?`<div class="row" style="margin:6px 0 10px"><button class="primary" data-act="queue-next">Weiter mit dem nächsten Beleg</button><button class="ghost" data-act="queue-stop">Restliche überspringen</button></div>`:''}
    <div class="row" style="margin-top:10px"><button class="primary" data-act="parse">Text auswerten</button>
      <button data-act="sample">Beispielbon</button><button class="ghost" data-act="manual">Ohne Bon eintragen</button></div>`;
  }
  const sum=d.items.reduce((s,i)=>s+(toNum(i.amount)||0),0);
  const tot=d.total!=null&&!isNaN(d.total)?d.total:null;
  const diff=tot!=null?r2(tot-sum):0;
  const open=d.items.filter(i=>!i.cat).length;
  const cats=[...new Set(d.items.map(i=>i.cat).filter(Boolean))];
  const mk=normKey(d.merchant);
  const anySugg=d.items.some(i=>!i.cat&&i.suggest);
  let h=`<h2>${d.refund?(d.id?'Retoure bearbeiten':'Retoure erfassen'):(d.id?'Beleg bearbeiten':'Beleg prüfen')}</h2>${d.id?'':qBar()}`;
  if(d.from) h+=`<div class="note">Vorausgefüllt aus ${esc(d.from)}. Das Datum ist heute. Prüfe die Beträge und speichere.</div>`;
  if(d.collapsed) h+=`<div class="note">Die Einzelpositionen ließen sich nicht sicher lesen. Weil hier alles in eine Kategorie gehört, habe ich den Gesamtbetrag übernommen.<div class="row" style="margin-top:8px"><button data-act="show-items">Erkannte Einzelpositionen anzeigen</button></div></div>`;
  if(d.giro&&!d.id) h+=`<div class="note"><b>GiroCode gelesen:</b> ${d.giro.amount?fmt(d.giro.amount)+' an ':''}${esc(d.giro.name||'Empfänger')}${d.giro.ref?` · ${esc(d.giro.ref.slice(0,60))}`:''}. Der Betrag stammt aus dem Code und ist sicher.</div>`;
  if(d.tse&&!d.id) h+=`<div class="note"><b>Kassen-Code gelesen:</b> ${fmt(d.tse.total)}${d.tse.vat19&&d.tse.vat7?` (19&nbsp;%: ${fmt(d.tse.vat19)}, 7&nbsp;%: ${fmt(d.tse.vat7)})`:''}${d.tse.pay?`, bezahlt ${d.tse.pay==='bar'?'bar':d.tse.pay==='unbar'?'mit Karte':'bar und mit Karte'}`:''}. Summe und Datum stammen aus dem Code.</div>`;
  if(d.warn&&d.warn.length&&!d.id) h+=`<div class="note warn"><b>Das Foto ist ${d.warn.includes('unscharf')?'unscharf':d.warn.includes('sehr dunkel')?'sehr dunkel':'aus großem Abstand aufgenommen'}.</b> ${d.warn.includes('klein')&&d.warn.length===1?'Die Schrift ist im Bild sehr klein.':''} Prüfe die Beträge genau oder fotografiere den Bon noch einmal: näher ran, ruhig halten, gutes Licht.</div>`;
  if(d.fix&&!d.id&&d.items[d.fix.i]) h+=`<div class="note"><b>Die Summe geht nicht auf.</b> Sie stimmt genau, wenn „${esc(d.items[d.fix.i].name)}“ ${fmt(d.fix.amount)} statt ${esc(d.items[d.fix.i].amount)} € kostet. Vermutlich wurde eine Ziffer falsch gelesen.<div class="row" style="margin-top:8px"><button data-act="apply-fix">${fmt(d.fix.amount)} übernehmen</button></div></div>`;
  if(d.pages>1&&!d.id) h+=`<div class="note">${d.pages} Seiten zu einem Beleg zusammengefügt.</div>`;
  {const nc=d.items.filter(i=>i.check).length;if(nc&&!d.id)h+=`<div class="note warn"><b>${nc} ${nc===1?'Betrag war':'Beträge waren'} schwer lesbar</b> und ${nc===1?'ist':'sind'} gelb markiert. Bitte mit dem Beleg vergleichen.</div>`}
  if(d.gross) h+=`<div class="note">Netto-Rechnung erkannt: ${fmt(d.gross.vat)} MwSt. sind anteilig auf die Positionen verteilt.</div>`;
  if(d.fixHint&&!d.id){const f=state.fixed.find(x=>x.id===d.fixHint);if(f)h+=`<div class="note warn">Passt das zu deinen Fixkosten „${esc(f.name)}“ (${fmt(f.amount)} ${INTERVALS[f.interval]||''})? Dann würde es doppelt zählen. Erfasse hier nur eine Nachzahlung oder verwirf den Beleg.</div>`}
  if(d.refund&&!d.id) h+=`<div class="note">Entferne die Positionen, die du behalten hast. Gespeichert wird der Betrag als Gutschrift und von den Ausgaben abgezogen.</div>`;
  if(open) h+=`<div class="note warn" role="alert"><b>${open} ${open===1?'Position kennt':'Positionen kennt'} die App noch nicht.</b> Wähle die Kategorie einmal aus. Beim nächsten Mal ordnet die App sie selbst zu.${anySugg?`<div class="row" style="margin-top:8px"><button data-act="accept-all">Alle Vorschläge übernehmen</button></div>`:''}</div>`;
  h+=`<form class="bon" id="draft" autocomplete="off">
    ${ui.photoUrl&&!d.id?`<details class="photo" style="margin-bottom:12px"><summary class="small" style="cursor:pointer;font-weight:600">Foto zum Vergleich anzeigen</summary><img src="${ui.photoUrl}" alt="Foto des Belegs" style="margin-top:8px"></details>`:''}
    ${ui.lastFile&&!d.id&&!(d.pages>1)?`<div class="row" style="margin:-4px 0 12px"><button type="button" class="ghost" data-act="rot-reread">↻ Drehen und neu lesen</button></div>`:''}
    <div class="meta"><label class="f merchant" for="d-merchant">Händler<input id="d-merchant" data-f="merchant" value="${esc(d.merchant)}" placeholder="z. B. REWE"></label>
      <label class="f" for="d-date">Datum<input id="d-date" type="date" data-f="date" value="${esc(d.date)}"></label>
      <label class="f" for="d-total">Bon-Summe<input id="d-total" inputmode="decimal" data-f="total" value="${tot!=null?fmtIn(tot):''}" placeholder="optional" style="font-family:var(--f-mono)"></label></div>
    ${d.dateGuessed?`<p class="hint">Kein Datum auf dem Bon gefunden, heute eingetragen. Bitte prüfen.</p>`:''}
    <label class="check"><input id="d-refund" type="checkbox" data-f="refund"${d.refund?' checked':''}> Retoure oder Erstattung (wird abgezogen)</label>
    <div class="pos">${d.items.map((it,i)=>`<div class="p${!it.cat?' needs':''}${it.check?' chk':''}">
      <input id="n-${i}" data-row="${i}" data-k="name" value="${esc(it.name)}" aria-label="Bezeichnung Position ${i+1}" placeholder="Bezeichnung">
      <input id="a-${i}" class="amt${it.check?' chk':''}" ${it.check?'title="Unsicher gelesen, bitte prüfen" ':''}data-row="${i}" data-k="amount" inputmode="decimal" value="${esc(it.amount)}" aria-label="Betrag Position ${i+1}" placeholder="0,00">
      <button type="button" class="icon ghost" data-act="del-row" data-i="${i}" aria-label="Position ${i+1} entfernen">×</button>
      <div class="catline"><select id="c-${i}" data-row="${i}" data-k="cat" aria-label="Kategorie Position ${i+1}">${catOpts(it.cat,'– Kategorie wählen –')}</select>
      ${!it.cat?(it.suggest?`<button type="button" class="ghost" data-act="accept" data-i="${i}">Vorschlag: ${esc(cat(it.suggest).name)}</button>`:`<span class="why">Unbekannt</span>`)
        :`<span class="src">${it.src?esc(it.src):'von dir gewählt'}</span>`}${it.tax||it.taxShow?'':`<button type="button" class="taxbtn" data-act="tax-show" data-i="${i}" aria-label="Position ${i+1} als steuerlich absetzbar markieren" title="Steuerlich absetzbar">§</button>`}</div>
      ${it.tax||it.taxShow?`<select id="t-${i}" class="taxsel${it.tax?' on':''}" data-row="${i}" data-k="tax" aria-label="Steuerlich absetzbar, Position ${i+1}">${taxOpts(it.tax)}</select>`:''}</div>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button type="button" class="ghost" data-act="add-row">+ Position</button>
      ${tot!=null&&Math.abs(diff)>=0.01?`<button type="button" class="ghost" data-act="add-diff">Differenz als Position</button><button type="button" class="ghost" data-act="total-only">Nur Gesamtbetrag verwenden</button>`:''}</div>
    <div class="sumline"><span>Summe Positionen</span><b id="sum">${fmt(d.refund?-sum:sum)}</b></div>
    <p id="diff" class="small" style="margin:6px 0 0;color:var(--warn)">${diffText(tot,sum)}</p>
    ${!d.refund?`<div class="openbox"><label class="check small"><input id="d-open" type="checkbox" data-f="open"${d.open?' checked':''}> Rechnung noch nicht bezahlt</label>
      ${d.open?`<label class="f" for="d-due" style="margin-top:6px">Zahlbar bis<input id="d-due" type="date" data-f="due" value="${esc(d.due||'')}"></label>`:''}</div>`:''}
    ${!d.refund&&state.goals.some(g=>g.pot)?`<label class="f" for="d-pot" style="margin-top:12px">Bezahlt aus<select id="d-pot" data-f="pot"><option value="">dem laufenden Monat</option>${state.goals.filter(g=>g.pot).map(g=>`<option value="${g.id}"${d.pot===g.id?' selected':''}>Rücklage „${esc(g.name)}“ (${fmt(goalBalance(g))})</option>`).join('')}</select></label>`:''}
    ${!d.refund&&!d.fromTpl?`<label class="check small" style="margin-top:12px"><input id="d-tpl" type="checkbox" data-f="asTemplate"${d.asTemplate?' checked':''}> Als Vorlage merken (für wiederkehrende Käufe)</label>`:''}
    ${mk&&!d.refund?`<label class="check small" style="margin-top:12px"><input id="d-always" type="checkbox" data-f="always"${d.always?' checked':''}> Bei „${esc(d.merchant)}“ immer ${cats.length===1?`„${esc(cat(cats[0]).name)}“`:'die Kategorie der ersten Position'} verwenden</label>`:''}
  </form>
  ${ui.dup?`<div class="note warn" role="alert"><b>Diesen Bon hast du vermutlich schon gespeichert:</b> ${esc(ui.dup.merchant)}, ${ui.dup.date.split('-').reverse().join('.')}, ${fmt(rTotal(ui.dup))}.<div class="row" style="margin-top:8px"><button data-act="save-dup">Trotzdem speichern</button><button data-act="cancel">Verwerfen</button></div></div>`:''}
  ${ui.err?`<p class="err" role="alert">${esc(ui.err)}</p>`:''}
  ${state.prefs.dev&&d.orig&&!d.id?`<div class="devbox"><b>Entwickler:</b> Schlecht erkannt? Erst alles korrigieren, dann den Bericht speichern.
    ${ui.photoUrl?`<label class="check small"><input id="dev-photo" type="checkbox"> Foto anhängen</label>`:''}
    <div class="row"><button type="button" data-act="dev-report">${ui.repDone?'Bericht erneut speichern':'Bericht speichern'}</button></div>
    ${ui.repDone?`<p class="small" role="status" style="margin:0;color:var(--ok, inherit)"><b>✓ Bericht gespeichert</b> (${ui.repDone} gesammelt). Teilen unter „Mehr → Entwickler-Werkzeuge“.</p>`:''}</div>`:''}
  <div class="row"><button class="primary" data-act="save">${d.refund?'Retoure speichern':'Beleg speichern'}</button><button data-act="cancel">Verwerfen</button></div>`;
  return h;
}
function diffText(tot,sum){
  if(tot==null||isNaN(tot))return '';const diff=r2(tot-sum);
  return Math.abs(diff)>=0.01?`Der Bon nennt ${fmt(tot)}, ${diff>0?'es fehlen':'zu viel sind'} ${fmt(Math.abs(diff))}. Prüfe, ob eine Position fehlt.`:'';
}

/* Aufklappbare Bereiche: immer nur einer offen */
function accHead(sec,open,title,value,sub,act){
  return `<button class="acc-h${open?' open':''}" id="${sec}" data-act="${act}" data-sec="${sec}" aria-expanded="${open}">
    <span class="acc-t"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${value!=null?`<span class="num acc-v">${value}</span>`:''}<span class="chev" aria-hidden="true">›</span></button>`;
}
const PER={0:'einmalig',1:'/ Monat',3:'/ Quartal',6:'/ Halbjahr',12:'/ Jahr'};
function fixedRow(f){
  const act=activeIn(f,ui.ym),open=ui.fxOpen===f.id;
  let when=INTERVALS[f.interval]||'monatlich';
  if(f.interval===0) when+=f.start?` im ${ymLabel(f.start)}`:'';
  else{if(f.start)when+=` ab ${ymShort(f.start)}`;if(f.end)when+=` bis ${ymShort(f.end)}`}
  const status=!act?(f.interval===0?'':f.start&&f.start>ui.ym?'<span class="tag off">startet später</span>':'<span class="tag off">beendet</span>'):'';
  const c=f.kind!=='in'&&contractInfo(f);
  return `<div class="frow2${act?'':' inactive'}"><button class="fr-h" data-act="fx-toggle" data-id="${f.id}" aria-expanded="${open}">
    <span class="t">${f.kind==='out'?`<i class="dot" style="--c:${cat(f.cat).color}"></i>`:''}<span class="nm">${esc(f.name)}</span>${f.example?' <span class="tag ex">Beispiel</span>':''}${status}</span>
    <span class="num">${fmt(f.amount)} <small class="muted">${PER[f.interval]||''}</small></span></button>
    ${open?`<div class="fr-d"><span class="s">${f.kind==='out'?esc(cat(f.cat).name)+' · ':''}${when}${f.interval>1?` · ${fmt(shareOf(f))} pro Monat`:''}${f.tax?' · § '+esc(TAXKINDS[f.tax]||''):''}${c?` · kündbar bis ${fmtD(c.deadline)}`:''}</span>
      <span class="row"><button data-act="fedit" data-id="${f.id}">Bearbeiten</button><button class="ghost danger" data-act="fdel" data-id="${f.id}">Löschen</button></span></div>`:''}</div>`;
}
function fxFormHtml(kind,e){
  const hasC=e&&e.contractEnd;
  return `<form class="form inpanel" id="fixed-form" autocomplete="off">
    <b class="full">${e?'Eintrag bearbeiten':kind==='in'?'Neue Einnahme':'Neue Fixkosten'}</b>
    <input type="hidden" id="fx-kind" value="${kind}">
    <label class="f full" for="fx-name">Bezeichnung<input id="fx-name" value="${esc(e?e.name:'')}" placeholder="${kind==='in'?'z. B. Gehalt':'z. B. Streaming-Abo'}"></label>
    <label class="f" for="fx-amount">Betrag<input id="fx-amount" inputmode="decimal" value="${e?fmtIn(e.amount):''}" placeholder="12,99" style="font-family:var(--f-mono)"></label>
    <label class="f" for="fx-int">Rhythmus<select id="fx-int">${[1,3,6,12,0].map(k=>`<option value="${k}"${(e?e.interval:1)===k?' selected':''}>${INTERVALS[k]}</option>`).join('')}</select></label>
    ${kind==='in'?'':`<label class="f full" for="fx-cat">Kategorie<select id="fx-cat">${catOpts(e&&e.cat?e.cat:'vertraege')}</select></label>`}
    <details class="full"${e&&(e.start||e.end)?' open':''}><summary class="small" style="cursor:pointer;font-weight:600">Zeitraum (optional)</summary>
      <div class="form" style="margin:8px 0 0;padding:0;border:0">
        <label class="f" for="fx-start">Ab Monat<input id="fx-start" type="month" value="${esc(e?e.start:'')}"></label>
        <label class="f" for="fx-end">Bis Monat<input id="fx-end" type="month" value="${esc(e?e.end:'')}"></label>
        <p class="muted small full" style="margin:0">Ohne „Ab Monat“ zählt der Eintrag in allen Monaten. „Einmalig“ zählt nur im gewählten Monat.</p></div></details>
    ${kind==='in'?'':`<details class="full" id="fx-taxbox"${e&&e.tax?' open':''}><summary class="small" style="cursor:pointer;font-weight:600">§ Steuerlich absetzbar (optional)</summary>
      <label class="f" for="fx-tax" style="margin-top:8px">Art<select id="fx-tax">${taxOpts(e?e.tax:'')}</select></label>
      <p id="fx-taxhint" class="small" style="margin:6px 0 0;color:var(--accent)"></p></details>
    <details class="full"${hasC?' open':''}><summary class="small" style="cursor:pointer;font-weight:600">Vertrag & Kündigung (optional)</summary>
      <div class="form" style="margin:8px 0 0;padding:0;border:0">
        <label class="f full" for="fx-cend">Mindestlaufzeit endet am<input id="fx-cend" type="date" value="${esc(e&&e.contractEnd||'')}"></label>
        <label class="f" for="fx-nval">Kündigungsfrist<input id="fx-nval" inputmode="numeric" value="${e&&e.noticeVal!=null?esc(e.noticeVal):'1'}" style="font-family:var(--f-mono)"></label>
        <label class="f" for="fx-nunit">Einheit<select id="fx-nunit"><option value="monate"${!e||e.noticeUnit!=='wochen'?' selected':''}>Monate</option><option value="wochen"${e&&e.noticeUnit==='wochen'?' selected':''}>Wochen</option></select></label>
        <label class="f full" for="fx-renew">Danach verlängert um<select id="fx-renew">${[1,3,6,12,24].map(k=>`<option value="${k}"${(e&&+e.renew||1)===k?' selected':''}>${k===1?'1 Monat (monatlich kündbar)':k+' Monate'}</option>`).join('')}</select></label>
        <p class="muted small full" style="margin:0">Bei vielen Verträgen ab März 2022 gilt nach der Mindestlaufzeit: monatlich kündbar. Im Zweifel im Vertrag nachsehen.</p></div></details>`}
    ${ui.err?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
    <div class="row full"><button class="primary" type="submit">${e?'Änderung speichern':'Hinzufügen'}</button><button type="button" data-act="fcancel">Abbrechen</button></div>
  </form>`;
}
function fxPanel(kind,list){
  const e=ui.fixedEdit&&state.fixed.find(f=>f.id===ui.fixedEdit);
  const formHere=ui.fxForm&&((e&&e.kind===kind)||(!e&&ui.fxKind===kind));
  let h=formHere?fxFormHtml(kind,e):`<button class="addbtn" data-act="fx-new" data-kind="${kind}">+ ${kind==='in'?'Neue Einnahme':'Neue Fixkosten'}</button>`;
  h+=list.length?`<div class="sublist">${list.map(fixedRow).join('')}</div>`
    :`<p class="muted small" style="margin:8px 2px 0">${kind==='in'?'Noch keine Einnahmen, z. B. dein Gehalt.':'Noch keine Fixkosten, z. B. Miete, Strom oder Abos.'}</p>`;
  return h;
}
function deadlineText(c){return c.days<=0?'heute letzter Tag':c.days===1?'noch 1 Tag':`noch ${c.days} Tage`}
function vContracts(){
  const cs=contracts();
  if(!cs.length) return `<p class="muted small" style="margin:4px 2px">Noch keine Verträge mit Laufzeit. Öffne unter „Fixkosten“ einen Eintrag, tippe „Bearbeiten“ und dann „Vertrag & Kündigung“.</p>`;
  return `<div class="sublist">${cs.map(({f,c})=>`<div class="frow"><span class="t">${esc(f.name)}${c.days<=14?' <span class="tag due">bald kündigen</span>':c.days<=42?' <span class="tag soon">Frist naht</span>':''}</span>
    <span class="num">${fmtD(c.deadline)}</span>
    <span class="s">letzter Kündigungstag · ${deadlineText(c)} · läuft sonst bis ${fmtD(c.end)}, dann ${(+f.renew||1)===1?'monatlich weiter':`+${f.renew} Monate`}</span></div>`).join('')}</div>`;
}
const GOALHELP={goal:'Die Sparrate zählt ab diesem Monat jeden Monat als gespart und verringert dein „Übrig“. Mit Ziel und Datum rechnet die App aus, wie viel du monatlich brauchst.',
  pot:'Eine Rücklage ist ein Topf für Unregelmäßiges wie Autoreparatur, Geschenke oder Nachzahlungen. Der Betrag fließt jeden Monat hinein und verringert dein „Übrig“. Zahlst du später einen Beleg „aus der Rücklage“, belastet er den Monat nicht.'};
function goalForm(e){
  const pot=e?!!e.pot:ui.goalNew==='pot',W=pot?'Rücklage':'Sparziel';
  return `<form class="form inpanel" id="goal-form" autocomplete="off">
    <b class="full">${e?W+' bearbeiten':'Neu anlegen'}</b>
    ${e?'':`<div class="seg full" role="radiogroup" aria-label="Art"><label><input type="radio" name="g-kind" value="goal"${pot?'':' checked'}> Sparziel</label><label><input type="radio" name="g-kind" value="pot"${pot?' checked':''}> Rücklage</label></div>`}
    <label class="f full" for="g-name">Name<input id="g-name" value="${esc(e?e.name:'')}" placeholder="${pot?'z. B. Auto, Geschenke, Nachzahlungen':'z. B. Notgroschen, Urlaub'}" data-ph-goal="z. B. Notgroschen, Urlaub" data-ph-pot="z. B. Auto, Geschenke, Nachzahlungen"></label>
    <label class="f" for="g-target">Zielbetrag (optional)<input id="g-target" inputmode="decimal" value="${e&&e.target?fmtIn(e.target):''}" placeholder="1.500,00" style="font-family:var(--f-mono)"></label>
    <label class="f only-goal" for="g-due"${pot?' hidden':''}>Ziel bis (optional)<input id="g-due" type="month" value="${esc(e?e.due||'':'')}"></label>
    <label class="f" for="g-rate"><span class="g-ratelab">${pot?'Betrag pro Monat':'Sparrate pro Monat'}</span><input id="g-rate" inputmode="decimal" value="${e&&rateFor(e,thisYM())?fmtIn(rateFor(e,thisYM())):''}" placeholder="0,00" style="font-family:var(--f-mono)"></label>
    ${e?'':`<label class="f" for="g-start">Startguthaben (optional, schon vorhandenes Geld)<input id="g-start" inputmode="decimal" placeholder="0,00" style="font-family:var(--f-mono)"></label>`}
    <p class="muted small full g-help" style="margin:0">${GOALHELP[pot?'pot':'goal']}</p>
    ${ui.err?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
    <div class="row full"><button class="primary" type="submit">${e?'Änderung speichern':'Anlegen'}</button><button type="button" data-act="goal-cancel">Abbrechen</button></div></form>`;
}
// Art im Formular umschalten, ohne Eingaben zu verlieren
function goalKindSwitch(kind){
  const f=document.getElementById('goal-form');if(!f)return;ui.goalNew=kind;const pot=kind==='pot';
  f.querySelectorAll('.only-goal').forEach(x=>x.hidden=pot);
  const l=f.querySelector('.g-ratelab');if(l)l.textContent=pot?'Betrag pro Monat':'Sparrate pro Monat';
  const h=f.querySelector('.g-help');if(h)h.textContent=GOALHELP[kind];
  const n=document.getElementById('g-name');if(n)n.placeholder=n.dataset[pot?'phPot':'phGoal'];
}
function vGoals(){
  const list=state.goals.slice().sort((a,b)=>(!!a.pot)-(!!b.pot));
  const e=ui.goalEdit&&list.find(g=>g.id===ui.goalEdit);
  let h=(e||ui.goalNew)?goalForm(e):`<button class="addbtn" data-act="goal-new">+ Neues Sparziel oder neue Rücklage</button>`;
  if(!list.length) return h+`<p class="muted small" style="margin:8px 2px 0">Noch nichts angelegt. Ein <b>Sparziel</b> ist Geld, das du ansparst, z. B. „Notgroschen“ oder „Urlaub“. Eine <b>Rücklage</b> ist ein Topf für Unregelmäßiges wie Autoreparatur oder Geschenke, aus dem du später Belege bezahlst.</p>`;
  h+=`<div class="sublist">${list.map(g=>{const pot=!!g.pot,i=goalInfo(g),open=ui.goalOpen===g.id;
    const deps=state.deposits.filter(d=>d.goalId===g.id).sort((a,b)=>b.date.localeCompare(a.date));
    const lines=[];
    if(i.rate>0)lines.push(`${pot?'':'Sparrate '}${fmt(i.rate)} / Monat`);else lines.push(pot?'kein Monatsbetrag':'keine Sparrate');
    if(pot){const used=state.receipts.filter(r=>r.pot===g.id).reduce((a,r)=>a+rTotal(r),0);if(used>0)lines.push(`bisher ${fmt(used)} daraus bezahlt`)}
    if(i.done&&!pot)lines.push('<b style="color:var(--ok)">Ziel erreicht</b>');
    else{if(i.need!=null)lines.push(`für ${ymShort(g.due)} nötig: ${fmt(i.need)} / Monat`);else if(g.due)lines.push(`Ziel ${ymShort(g.due)}`);
      if(i.eta)lines.push(`mit aktueller Rate erreicht im ${ymLabel(i.eta)}`)}
    const df=ui.depositFor===g.id;
    return `<div class="goal"><button class="fr-h" data-act="goal-toggle" data-id="${g.id}" aria-expanded="${open}"><span class="t"><span class="nm">${esc(g.name)}</span>${pot?' <span class="tag">Rücklage</span>':''}${g.example?' <span class="tag ex">Beispiel</span>':''}${i.done&&!pot?' <span class="tag ret">erreicht</span>':''}</span>
      <span class="num${i.bal<0?' minus':''}">${fmt(i.bal)}${i.target?` <small class="muted">/ ${fmt(i.target)}</small>`:''}</span></button>
      ${i.target?`<div class="track gtrack"><i style="width:${i.pct}%"></i></div>`:''}
      ${open?`<p class="small muted" style="margin:0">${lines.join(' · ')}</p>
      ${i.done&&i.rate>0&&!pot?`<div class="row"><button data-act="goal-stop" data-id="${g.id}">Sparrate ab nächstem Monat beenden</button></div>`:''}
      ${df?`<form class="row" id="deposit-form" data-goal="${g.id}" autocomplete="off" style="margin-top:4px">
        <input id="dep-amount" inputmode="decimal" placeholder="Betrag" style="flex:1 1 7em;width:auto;font-family:var(--f-mono)">
        <input id="dep-date" type="date" value="${today()}" style="flex:1 1 9em;width:auto">
        <button class="primary" type="submit">${ui.depositSign>0?'Einzahlen':'Entnehmen'}</button><button type="button" data-act="dep-cancel">Abbrechen</button>
        ${ui.err?`<p class="err" role="alert" style="flex-basis:100%;margin:0">${esc(ui.err)}</p>`:''}</form>`
      :`<div class="row"><button class="ghost" data-act="dep" data-id="${g.id}" data-sign="1">+ Einzahlen</button><button class="ghost" data-act="dep" data-id="${g.id}" data-sign="-1">− Entnehmen</button><button class="ghost" data-act="goal-edit" data-id="${g.id}">Bearbeiten</button><button class="ghost danger" data-act="goal-del" data-id="${g.id}">Löschen</button></div>`}
      ${ui.confirmGoal===g.id?`<div class="note warn" style="margin:0">„${esc(g.name)}“ mit allen Einzahlungen löschen?<div class="row" style="margin-top:8px"><button class="danger" data-act="goal-del-yes" data-id="${g.id}">Ja, löschen</button><button data-act="goal-del-no">Abbrechen</button></div></div>`:''}
      ${deps.length?`<details class="small"><summary class="muted" style="cursor:pointer">Einzahlungen (${deps.length})</summary><div class="lines" style="margin-top:6px">${deps.map(d=>`<div><span class="n"><span class="num muted">${fmtD(d.date)}</span> ${esc(d.note||(d.amount<0?'Entnahme':'Einzahlung'))}</span><span class="num">${fmt(d.amount)}</span><button class="icon ghost danger" data-act="dep-del" data-id="${d.id}" aria-label="Eintrag löschen">×</button></div>`).join('')}</div></details>`:''}`:''}
    </div>`}).join('')}</div>`;
  return h;
}
function vFixed(){
  const st=monthStats(ui.ym),o=ui.planOpen,mo=ymLabel(ui.ym);
  const ins=state.fixed.filter(f=>f.kind==='in').sort((a,b)=>shareOf(b)-shareOf(a));
  const outs=state.fixed.filter(f=>f.kind!=='in').sort((a,b)=>shareOf(b)-shareOf(a));
  const cs=contracts(),GL=state.goals.filter(g=>!g.pot),PL=state.goals.filter(g=>g.pot),gTotal=GL.reduce((a,g)=>a+goalBalance(g),0),gRate=GL.reduce((a,g)=>a+rateFor(g,thisYM()),0),pTotal=PL.reduce((a,g)=>a+goalBalance(g),0),pRate=PL.reduce((a,g)=>a+rateFor(g,thisYM()),0);
  const n=(k,one,many)=>`${k} ${k===1?one:many}`;
  const rest=st.inc-st.fixOut;
  let h=`<h2>Planen</h2><div class="acc">`;
  h+=accHead('ein',o==='ein','Einnahmen',fmt(st.inc),n(ins.length,'Eintrag','Einträge'),'plan-open');
  if(o==='ein')h+=`<div class="acc-p">${fxPanel('in',ins)}</div>`;
  h+=accHead('fix',o==='fix','Fixkosten',fmt(st.fixOut),n(outs.length,'Eintrag','Einträge'),'plan-open');
  if(o==='fix')h+=`<div class="acc-p">${fxPanel('out',outs)}</div>`;
  h+=`<div class="acc-sum"><span>Bleibt nach Fixkosten</span><b class="num${rest<0?' minus':''}">${fmt(rest)}</b></div>`;
  h+=accHead('vertraege',o==='vertraege','Verträge',null,cs.length?`${cs.length} · nächste Frist ${fmtD(cs[0].c.deadline)}`:'keine mit Kündigungsfrist','plan-open');
  if(o==='vertraege')h+=`<div class="acc-p">${vContracts()}</div>`;
  {const parts=[];if(GL.length)parts.push(n(GL.length,'Sparziel','Sparziele'));if(PL.length)parts.push(n(PL.length,'Rücklage','Rücklagen'));if(gRate+pRate)parts.push(fmt(gRate+pRate)+' / Monat');
  h+=accHead('sparziele',o==='sparziele','Sparziele & Rücklagen',GL.length+PL.length?fmt(gTotal+pTotal):null,parts.length?parts.join(' · '):'noch nichts angelegt','plan-open');
  if(o==='sparziele')h+=`<div class="acc-p">${vGoals()}</div>`}
  h+=`</div><p class="muted small" style="margin-top:10px">Beträge für ${mo}. Jährliche Kosten sind auf den Monat umgerechnet.</p>`;
  return h;
}
function vVerlauf(){
  const months=[];for(let i=11;i>=0;i--)months.push(addMonths(ui.ym,-i));
  const data=months.map(ym=>({ym,...monthStats(ym,ui.chartCat)}));
  const top=Math.max(1,...data.map(d=>Math.max(d.out,d.inc)));
  const step=niceStep(top/3);const ymax=step*Math.ceil(top/step);
  const W=360,H=200,L=40,R=6,T=10,B=24,cw=(W-L-R)/12,bw=cw*.62;
  const y=v=>T+(H-T-B)*(1-Math.max(0,v)/ymax);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Einnahmen und Ausgaben der letzten 12 Monate">`;
  for(let v=0;v<=ymax+0.01;v+=step){svg+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-5}" y="${y(v)+3}" text-anchor="end">${v>=1000?(v/1000).toLocaleString('de-DE')+'k':Math.round(v)}</text>`}
  data.forEach((d,i)=>{
    const x=L+i*cw+(cw-bw)/2;const fy=y(d.fixOut),vy=y(d.fixOut+Math.max(0,d.varOut));
    svg+=`<g data-act="goto" data-ym="${d.ym}">`;
    if(d.ym===ui.ym)svg+=`<rect class="sel" x="${L+i*cw}" y="${T}" width="${cw}" height="${H-T-B}" rx="3"/>`;
    else svg+=`<rect x="${L+i*cw}" y="${T}" width="${cw}" height="${H-T-B}" fill="transparent"/>`;
    if(d.fixOut>0)svg+=`<rect class="fix" x="${x}" y="${fy}" width="${bw}" height="${Math.max(0,y(0)-fy)}"/>`;
    if(d.varOut>0)svg+=`<rect class="var" x="${x}" y="${vy}" width="${bw}" height="${Math.max(0,fy-vy)}"/>`;
    if(d.inc>0)svg+=`<line class="inc" x1="${L+i*cw+2}" x2="${L+(i+1)*cw-2}" y1="${y(d.inc)}" y2="${y(d.inc)}"/>`;
    svg+=`<text x="${L+i*cw+cw/2}" y="${H-8}" text-anchor="middle">${MSHORT[+d.ym.slice(5)-1]}</text></g>`;
  });
  svg+=`</svg>`;
  const withData=data.filter(d=>d.out>0||d.inc>0);
  const avgOut=withData.length?withData.reduce((s,d)=>s+d.out,0)/withData.length:0;
  const avgInc=withData.length?withData.reduce((s,d)=>s+d.inc,0)/withData.length:0;
  let h=`<h2>Verlauf</h2>
  <label class="f" for="chart-cat" style="margin-bottom:10px">Anzeigen<select id="chart-cat"><option value="">Alle Ausgaben und Einnahmen</option>${state.categories.map(c=>`<option value="${c.id}"${c.id===ui.chartCat?' selected':''}>Nur ${esc(c.name)}</option>`).join('')}</select></label>
  <div class="chart">${svg}</div>
  <div class="legend" style="margin-top:8px"><span style="--c:var(--accent)">Fixkosten</span><span style="--c:var(--var)">Belege</span>${ui.chartCat?'':'<span style="--c:var(--ok)">Einnahmen (Linie)</span>'}</div>
  <p class="muted small" style="margin-top:8px">Tippe auf einen Monat, um ihn zu öffnen. Durchschnitt (Monate mit Daten): Ausgaben <b class="num">${fmt(avgOut)}</b>${ui.chartCat?'':` · Einnahmen <b class="num">${fmt(avgInc)}</b>`}</p>`;
  h+=vYear();
  h+=`<h2>Suche</h2><label class="f" for="search">In allen Belegen suchen<input id="search" type="search" value="${esc(ui.search)}" placeholder="z. B. Kaffee, Zalando, Bananen"></label>`;
  h+=`<div id="search-res">${searchResults()}</div>`;
  return h;
}
function yearStats(y){
  const ys=String(y),now=thisYM();let inc=0,out=0,saved=0,nM=0;const by={},months=[];
  for(let m=1;m<=12;m++){const ym=ys+'-'+pad(m);if(ym>now)break;const st=monthStats(ym);
    if(!(st.out>0||st.inc>0))continue;nM++;inc+=st.inc;out+=st.out;saved+=st.saved;months.push({ym,out:st.out});
    Object.keys(st.by).forEach(k=>by[k]=(by[k]||0)+st.by[k])}
  const mer={},prod={};
  state.receipts.forEach(r=>{if(!r.date||!r.date.startsWith(ys))return;
    const mk=(r.merchant||'Ohne Händler').trim();const e=mer[mk]=mer[mk]||{name:mk,sum:0,n:0};e.sum+=rTotal(r);e.n++;
    r.items.forEach(i=>{const k=normKey(i.name);if(!k)return;const q=prod[k]=prod[k]||{name:i.name,sum:0,n:0};q.sum+=+i.amount||0;q.n++})});
  return {inc,out,saved,nM,by,months,mer:Object.values(mer).sort((a,b)=>b.sum-a.sum),prod:Object.values(prod).sort((a,b)=>b.sum-a.sum)};
}
function vYear(){
  const years=dataYears();if(!ui.yr||!years.includes(ui.yr))ui.yr=years[0];
  const y=ui.yr,s=yearStats(y),p=yearStats(y-1),op=!!ui.yrOpen;
  let h=`<div class="acc" style="margin-top:22px">${accHead('jahr',op,'Jahresrückblick',s.nM?fmt(s.out):null,s.nM?`${y} · ${s.nM} ${s.nM===1?'Monat':'Monate'} mit Daten`:'noch keine Daten','yr-open')}`;
  if(!op)return h+`</div>`;
  h+=`<div class="acc-p"><label class="f" for="yr-sel" style="margin-bottom:10px">Jahr<select id="yr-sel">${years.map(v=>`<option value="${v}"${v===y?' selected':''}>${v}</option>`).join('')}</select></label>`;
  if(!s.nM)return h+`<div class="list"><div class="empty">Für ${y} gibt es noch keine Daten.</div></div></div></div>`;
  const kept=s.inc-s.out,quote=s.inc>0?kept/s.inc*100:null;
  h+=`<div class="figs"><div class="fig"><span>Einnahmen</span><b>${fmt(s.inc)}</b></div><div class="fig"><span>Ausgaben</span><b>${fmt(s.out)}</b></div>
    <div class="fig main"><span>Nicht ausgegeben${quote!=null?`<small>${Math.round(quote)} % der Einnahmen</small>`:''}</span><b class="${kept<0?'minus':''}">${fmt(kept)}</b></div></div>
    <p class="small muted" style="margin:8px 0 0">${s.saved>0?`Davon gezielt zurückgelegt (Sparziele und Rücklagen): <b class="num">${fmt(s.saved)}</b>. `:''}Im Schnitt ${fmt(s.out/s.nM)} Ausgaben pro Monat${p.nM?`, im Vorjahr ${fmt(p.out/p.nM)}`:''}.</p>`;
  const hi=s.months.slice().sort((a,b)=>b.out-a.out)[0],lo=s.months.slice().sort((a,b)=>a.out-b.out)[0];
  if(s.months.length>1)h+=`<div class="lines" style="margin-top:10px"><div><span class="n">Teuerster Monat</span><span class="c">${MONTHS[+hi.ym.slice(5)-1]}</span><span class="num">${fmt(hi.out)}</span></div><div><span class="n">Günstigster Monat</span><span class="c">${MONTHS[+lo.ym.slice(5)-1]}</span><span class="num">${fmt(lo.out)}</span></div></div>`;
  const cats=Object.entries(s.by).filter(([,v])=>Math.abs(v)>0.004).sort((a,b)=>b[1]-a[1]),max=cats.length?Math.max(...cats.map(c=>c[1])):1;
  h+=`<h3>Kategorien ${y}</h3><div class="bars">${cats.map(([id,v])=>{const c=cat(id),av=v/s.nM,pa=p.nM&&p.by[id]?p.by[id]/p.nM:0;
    const ch=pa>0.5?Math.round((av-pa)/pa*100):null;
    return `<div class="bar" style="--c:${c.color}"><span class="lbl">${esc(c.name)}</span><span class="num">${fmt(v)}</span><div class="track"><i style="width:${Math.max(0,v/max*100)}%"></i></div><span class="bud">Ø ${fmt(av)} im Monat${ch!=null?` · ${ch>0?'+':''}${ch} % zum Vorjahr`:''}</span></div>`}).join('')}</div>`;
  if(s.mer.length)h+=`<h3>Wo du am meisten ausgibst</h3><div class="list lines" style="padding:6px 14px">${s.mer.slice(0,5).map(m=>`<div style="padding:4px 0"><span class="n">${esc(m.name)}</span><span class="c">${m.n} ${m.n===1?'Beleg':'Belege'}</span><span class="num">${fmt(m.sum)}</span></div>`).join('')}</div>`;
  if(s.prod.length)h+=`<h3>Wofür du am meisten ausgibst</h3><div class="list lines" style="padding:6px 14px">${s.prod.slice(0,10).map(m=>`<div style="padding:4px 0"><span class="n">${esc(m.name)}</span><span class="c">${m.n}×</span><span class="num">${fmt(m.sum)}</span></div>`).join('')}</div>`;
  return h+`</div></div>`;
}
function searchResults(){
  let h='';const q=ui.search.trim().toLowerCase();
  if(q.length>=2){
    const hits=[];
    state.receipts.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(r=>{
      const mHit=(r.merchant||'').toLowerCase().includes(q);
      r.items.forEach(i=>{if(mHit||i.name.toLowerCase().includes(q)||cat(i.cat).name.toLowerCase().includes(q))hits.push({r,i})})});
    const sum=hits.reduce((s,x)=>s+(+x.i.amount||0),0);
    h+=`<p class="small" style="margin-top:10px">${hits.length} ${hits.length===1?'Treffer':'Treffer'} · zusammen <b class="num">${fmt(sum)}</b></p>`;
    h+=hits.length?`<div class="list lines" style="padding:6px 14px">${hits.slice(0,150).map(x=>`<div style="padding:4px 0"><span class="n"><span class="muted num">${x.r.date.slice(8)}.${x.r.date.slice(5,7)}.${x.r.date.slice(2,4)}</span> ${esc(x.i.name)} <span class="muted">· ${esc(x.r.merchant)}</span></span><span class="c">${esc(cat(x.i.cat).name)}</span><span class="num">${fmt(x.i.amount)}</span></div>`).join('')}</div>`
      :`<div class="list"><div class="empty">Nichts gefunden.</div></div>`;
  }
  return h;
}
function niceStep(x){if(x<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(x)));const f=x/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}

function prodList(){
  const f=normKey(ui.ruleFilter);
  const prods=Object.entries(state.rules.products).filter(([k])=>!f||k.includes(f)).sort((a,b)=>a[0].localeCompare(b[0]));
  return `<h3>Produkte (${prods.length})</h3>`+(prods.length?`<div class="list">${prods.slice(0,200).map(([k,c])=>`<div class="rule"><span class="k">${esc(k)}</span>
    <select id="rp-${esc(k)}" data-rule="p" data-key="${esc(k)}" aria-label="Kategorie für ${esc(k)}">${catOpts(c)}</select>
    <button class="icon ghost danger" data-act="rdel" data-type="p" data-key="${esc(k)}" aria-label="Regel löschen">×</button></div>`).join('')}</div>`
    :`<div class="list"><div class="empty">${f?'Kein Treffer.':'Noch nichts gelernt. Speichere deinen ersten Beleg, dann erscheinen die Produkte hier.'}</div></div>`);
}
const PALETTE=['#2f9e6f','#5a9e3a','#4c7a34','#8a9a2b','#c9a227','#b08a2e','#e0891c','#e0662b','#d1513d','#a15c3a','#8a6e5c','#d6457a','#c2569b','#e06c9f','#a35fd6','#7b5dc9','#3c4f9c','#2a62c9','#3a8fd3','#69b3e7','#1aa3a3','#0e7c86','#5d6f8c','#8e95a3'];
const freeColor=()=>PALETTE.find(c=>!state.categories.some(x=>x.color.toLowerCase()===c))||PALETTE[state.categories.length%PALETTE.length];
const noH2=html=>html.replace(/^\s*<h2[^>]*>[\s\S]*?<\/h2>/,'');
function catPanel(){
  const e=ui.catEdit&&state.categories.find(c=>c.id===ui.catEdit);
  let h=`<p class="muted small" style="margin:0 2px 8px">Tippe eine Kategorie an, um Namen oder Farbe zu ändern.</p>
  <div class="chips">${state.categories.map(c=>`<button class="catchip${e&&e.id===c.id?' sel':''}" data-act="cat-edit" data-id="${c.id}" aria-pressed="${!!(e&&e.id===c.id)}"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>`;
  if(e){const col=ui.catColor||e.color;
    h+=`<div class="box catedit" style="margin-top:10px">
      <label class="f" for="cat-ename">Name<input id="cat-ename" value="${esc(e.name)}" maxlength="30"></label>
      <div class="f">Farbe<div class="swatches" role="radiogroup" aria-label="Farbe">${PALETTE.map(c=>`<button class="sw${c.toLowerCase()===col.toLowerCase()?' on':''}" style="--c:${c}" data-act="cat-color" data-col="${c}" role="radio" aria-checked="${c.toLowerCase()===col.toLowerCase()}" aria-label="Farbe ${c}"></button>`).join('')}</div></div>
      ${ui.err?`<p class="err" role="alert" style="margin:0">${esc(ui.err)}</p>`:''}
      <div class="row"><button class="primary" data-act="cat-save">Speichern</button><button data-act="cat-cancel">Abbrechen</button>${e.id!=='sonstiges'?`<button class="ghost danger" data-act="cdel" data-id="${e.id}">Löschen</button>`:''}</div>
      ${ui.confirmCat===e.id?`<div class="note warn" style="margin:0">„${esc(e.name)}“ löschen? Alle Einträge und Regeln dieser Kategorie wandern zu „Sonstiges“.<div class="row" style="margin-top:8px"><button class="danger" data-act="cdel-yes">Ja, löschen</button><button data-act="cdel-no">Abbrechen</button></div></div>`:''}
    </div>`}
  h+=`<form class="row" id="cat-form" style="margin-top:12px" autocomplete="off"><input id="cat-name" placeholder="Neue Kategorie, z. B. Haustier" maxlength="30" style="flex:1 1 14em;width:auto"><button type="submit">Hinzufügen</button></form>`;
  return h;
}
// Gelernte Lesekorrekturen je Händler, einzeln löschbar
function fixList(){
  const R=state.rules,names={};state.receipts.forEach(r=>{names[normKey(r.merchant)]=r.merchant});
  const rows=[];
  Object.entries(R.fix||{}).forEach(([m,o])=>Object.entries(o).forEach(([k,v])=>rows.push(`<div class="fixrow"><span><b>${esc(names[m]||m)}:</b> „${esc(k.toLowerCase())}“ → ${esc(v)}</span><button class="ghost" data-act="fix-del" data-kind="fix" data-m="${esc(m)}" data-k="${esc(k)}" aria-label="Korrektur löschen">✕</button></div>`)));
  Object.entries(R.drop||{}).forEach(([m,o])=>Object.keys(o).forEach(k=>rows.push(`<div class="fixrow"><span><b>${esc(names[m]||m)}:</b> „${esc(k.toLowerCase())}“ wird weggelassen</span><button class="ghost" data-act="fix-del" data-kind="drop" data-m="${esc(m)}" data-k="${esc(k)}" aria-label="Löschen">✕</button></div>`)));
  Object.keys(R.layout||{}).forEach(m=>rows.push(`<div class="fixrow"><span><b>${esc(names[m]||m)}:</b> Name steht unter dem Preis</span><button class="ghost" data-act="layout-del" data-m="${esc(m)}" aria-label="Löschen">✕</button></div>`));
  if(!rows.length)return '';
  return `<h3>Lesekorrekturen</h3><p class="muted small" style="margin:0 2px 8px">Was du bei Belegen korrigiert hast, setzt die App beim selben Händler künftig selbst ein.</p><div class="fixlist">${rows.join('')}</div>`;
}
function vMehr(){
  const mers=Object.entries(state.rules.merchants).sort((a,b)=>a[0].localeCompare(b[0]));
  const o=ui.moreOpen,sec=(id,title,sub,html)=>accHead(id,o===id,title,null,sub,'more-open')+(o===id?`<div class="acc-p">${html()}</div>`:'');
  const tx=taxYear(ui.taxYear),nB=Object.values(state.budgets).filter(v=>+v>0).length;
  const lb=state.lastBackup?Math.floor((Date.now()-state.lastBackup)/864e5):null;
  let h='';
  if(ui.flash) h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;
  if(!ui.installed&&ui.installEvt) h+=`<div class="note"><b>Als App installieren</b><p class="small" style="margin:4px 0 8px">Dann startet Kassensturz vom Startbildschirm, ohne Browserleiste und auch offline.</p><button class="primary" data-act="install">App installieren</button></div>`;
  h+=`<h2>Mehr</h2><div class="acc">`;
  h+=sec('anleitung','Anleitung',`Kurze Tour und ${TUT_ORDER.length} Themen`,()=>noH2(vGuide()));
  h+=sec('steuer','Steuer & Jahresexport',`${ui.taxYear}: ${fmt(tx.total)} absetzbar`,()=>noH2(vTaxYear()));
  h+=sec('sperre','App-Sperre',getLock()?'an':'aus',()=>noH2(vLockSettings()));
  h+=sec('budgets','Budgets',state.useBudgets?`an · ${nB} ${nB===1?'Budget':'Budgets'}`:'aus',()=>`<div class="box"><label class="check"><input id="use-budgets" type="checkbox"${state.useBudgets?' checked':''}> Monatsbudgets verwenden</label>
    ${state.useBudgets?`<p class="muted small" style="margin:0">Leer lassen = kein Budget. Ab 80 % warnt die App, über 100 % wird es rot.</p><div class="list">${state.categories.map(c=>`<div class="rule" style="grid-template-columns:minmax(0,1fr) 8em"><span><i class="dot" style="--c:${c.color}"></i> ${esc(c.name)}</span><input id="bud-${c.id}" data-budget="${c.id}" inputmode="decimal" value="${+state.budgets[c.id]>0?fmtIn(state.budgets[c.id]):''}" placeholder="–" aria-label="Budget ${esc(c.name)}"></div>`).join('')}</div>`:''}</div>`);
  h+=sec('kasse','Kassensturz',state.prefs.kasse?'an':'aus',()=>`<div class="box"><label class="check"><input id="use-kasse" type="checkbox"${state.prefs.kasse?' checked':''}> Kassensturz verwenden</label>
    <p class="muted small" style="margin:0">Du trägst einmal im Monat deinen Kontostand ein. Die App vergleicht ihn mit Einnahmen und erfassten Ausgaben und zeigt, wie viel Geld du nicht erfasst hast. Die Eingabe erscheint dann im Reiter „Monat“.</p>
    ${state.prefs.kasse?`<label class="f" for="kasse-tol" style="max-width:16em">Rückfragen ab einer Differenz von<input id="kasse-tol" inputmode="decimal" value="${fmtIn(kasseTol())}" style="font-family:var(--f-mono)"></label><p class="muted small" style="margin:0">Ab diesem Betrag fragt die App nach Bargeld und vergessenen Einträgen. Standard: 10,00 €.</p>`:''}</div>`);
  h+=sec('kategorien','Kategorien & Gelerntes',`${state.categories.length} Kategorien · ${Object.keys(state.rules.products).length} Produkte gelernt`,()=>catPanel()+fixList()+`<h3>Gelernte Zuordnungen</h3>`+(`<p class="muted small" style="margin:0 2px 8px">Beim Speichern merkt sich die App Produkt und Kategorie. Hier korrigierst du Fehler.</p>
    <label class="f" for="rule-filter">Produkte durchsuchen<input id="rule-filter" value="${esc(ui.ruleFilter)}" placeholder="z. B. Milch"></label>
    <div id="prod-list">${prodList()}</div><h3>Händler (${mers.length})</h3>`+(mers.length?`<div class="list">${mers.map(([k,m])=>`<div class="rule"><span class="k">${esc(k)}${m.always?' <span class="tag">immer</span>':''}</span>
    <select id="rm-${esc(k)}" data-rule="m" data-key="${esc(k)}" aria-label="Kategorie für ${esc(k)}">${catOpts(m.cat)}</select>
    <button class="icon ghost danger" data-act="rdel" data-type="m" data-key="${esc(k)}" aria-label="Regel löschen">×</button></div>`).join('')}</div>`:`<div class="list"><div class="empty">Noch keine Händler gespeichert.</div></div>`)));
  h+=sec('backup','Backup & Export',lb==null?'noch kein Backup':lb===0?'letztes Backup heute':`letztes Backup vor ${lb} ${lb===1?'Tag':'Tagen'}`,()=>`<p class="muted">Deine Daten liegen nur auf diesem Handy. Lade ab und zu ein Backup herunter und leg es z. B. in Google Drive ab.${persistGranted?' Der Browser hat dauerhaften Speicher zugesagt.':''}</p>
  <div class="box">
    ${cryptoOk?`<p class="small" style="margin:0">Mit Passwort ist die Datei verschlüsselt. Ohne das Passwort kann sie niemand lesen, auch du nicht. Notiere es dir gut.</p>
    <label class="f" for="bk-pw">Backup-Passwort (mind. 8 Zeichen)<input id="bk-pw" type="password" autocomplete="new-password"></label>
    <label class="f" for="bk-pw2">Passwort wiederholen<input id="bk-pw2" type="password" autocomplete="new-password"></label>
    <label class="check small"><input id="bk-plain" type="checkbox"${ui.plainBackup?' checked':''}> Ohne Passwort sichern (nicht empfohlen)</label>`
    :`<p class="small" style="margin:0">Verschlüsselte Backups gehen nur, wenn die App über https geöffnet ist (z. B. GitHub Pages).</p>`}
    <div class="row">${canShareFiles()?`<button class="primary" data-act="backup-share">Backup teilen (z. B. Google Drive)</button><button data-act="backup-file">Herunterladen</button>`:`<button class="primary" data-act="backup-file">Backup herunterladen</button>`}<button data-act="export">Als Text anzeigen</button></div>
    <p id="bk-err" class="err" role="alert" style="margin:0">${esc(ui.backupErr)}</p>
  </div>
  ${ui.exportText?`<label class="f" for="export-text" style="margin-top:10px">Backup-Text${ui.exportEnc?' (verschlüsselt)':' (unverschlüsselt)'}<textarea id="export-text" rows="4" readonly>${esc(ui.exportText)}</textarea></label>
  <div class="row" style="margin-top:8px"><button data-act="copy">Kopieren</button><span id="copy-msg" class="small muted"></span></div>`:''}
  ${snapHtml()}
  <h3>Export für Excel</h3>
  <p class="muted small" style="margin:0 2px 8px">CSV-Dateien mit Semikolon und Komma-Beträgen, öffnen direkt in Excel. Die Jahresliste für die Steuer findest du unter „Steuer“.</p>
  <div class="row"><button data-act="csv-items">Alle Belegpositionen</button><button data-act="csv-months">Monatsübersicht</button><button data-act="csv-fixed">Planung</button></div>
  <h3>Backup wiederherstellen</h3>
  <p class="muted small">Auch ein Backup aus der Browser-Version von Kassensturz funktioniert hier.</p>
  <div class="box">
    <div class="row"><label class="btn" for="import-file">Backup-Datei wählen</label><input id="import-file" type="file" accept=".json,.txt,application/json,text/plain" hidden>${ui.pendingImport?`<span class="small">Datei geladen${ui.pendingEnc?', verschlüsselt':''}</span>`:''}</div>
    <label class="f" for="import-text">Oder Backup-Text einfügen<textarea id="import-text" rows="3" placeholder='{"v":2,…}'></textarea></label>
    <label class="f" for="import-pw">Passwort (nur bei verschlüsseltem Backup)<input id="import-pw" type="password" autocomplete="current-password"></label>
    <div class="row"><button data-act="import">Wiederherstellen</button></div>
    ${ui.importMsg?`<p class="small" style="margin:0" role="status">${esc(ui.importMsg)}</p>`:''}
  </div>
  <h3>Alles löschen</h3>
  <div class="row">${ui.confirmClear?`<span class="small">Wirklich alle Belege, Fixkosten, Einnahmen und Regeln löschen?</span><button class="danger" data-act="clear-yes">Ja, alles löschen</button><button data-act="clear-no">Abbrechen</button>`:`<button class="danger" data-act="clear">Alle Daten löschen</button>`}</div>
`);
  h+=sec('entwickler','Entwickler-Werkzeuge',state.prefs.dev?`an${ui.repCount?` · ${ui.repCount} ${ui.repCount===1?'Bericht':'Berichte'}`:''}`:'aus',()=>`<div class="box"><label class="check"><input id="use-dev" type="checkbox"${state.prefs.dev?' checked':''}> Entwickler-Werkzeuge anzeigen</label>
    <p class="muted small" style="margin:0">Nur für die Weiterentwicklung der Belegerkennung. Eingeschaltet erscheint beim Prüfen eines Belegs der Knopf „Bericht speichern“. Ein Bericht enthält den gelesenen Text, das Ergebnis der App und deine korrigierte Fassung, auf Wunsch auch das Foto.</p>
    ${state.prefs.dev?`<p class="small" style="margin:0"><b>${ui.repCount||0} ${ui.repCount===1?'Bericht':'Berichte'} gesammelt.</b> Berichte enthalten den vollständigen Belegtext. Teile sie nur mit Personen, denen du vertraust.</p>
    <div class="row"><button class="primary" data-act="reports-share">Berichte teilen</button>${ui.repClear?`<button class="danger" data-act="reports-clear-yes">Wirklich alle löschen</button><button data-act="reports-clear-no">Abbrechen</button>`:`<button data-act="reports-clear">Alle löschen</button>`}</div>
    <p class="small" style="margin:0"><a href="tests/pruefen.html" target="_blank" rel="noopener">Testseite der Belegerkennung öffnen</a></p>`:''}</div>`);
  h+=`</div><p class="muted small" style="margin-top:20px">Kassensturz ${APP_VERSION} · Daten nur auf diesem Gerät</p>`;
  return h;
}
/* ---------- Verschlüsselung (Web Crypto, alles auf dem Gerät) ---------- */
const cryptoOk=!!(window.crypto&&crypto.subtle&&window.isSecureContext);
const LOCKKEY='kassensturz-lock';
const tenc=new TextEncoder(),tdec=new TextDecoder();
const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hashPin(pin,salt,iter){
  const k=await crypto.subtle.importKey('raw',tenc.encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},k,256);
  return b64(new Uint8Array(bits));
}
async function aesKey(pw,salt,iter){
  const k=await crypto.subtle.importKey('raw',tenc.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBackup(obj,pw){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iter=250000;
  const key=await aesKey(pw,salt,iter);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,tenc.encode(JSON.stringify(obj)));
  return JSON.stringify({kassensturz:'backup-enc-1',kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iter,salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(ct))});
}
async function decryptBackup(o,pw){
  const key=await aesKey(pw,unb64(o.salt),o.iter||250000);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.data));
  return tdec.decode(pt);
}
function getLock(){try{return JSON.parse(localStorage.getItem(LOCKKEY)||'null')}catch(e){return null}}
function setLock(v){try{if(v)localStorage.setItem(LOCKKEY,JSON.stringify(v));else localStorage.removeItem(LOCKKEY);return true}catch(e){return false}}
async function makeLock(pin){const salt=crypto.getRandomValues(new Uint8Array(16)),iter=150000;return {salt:b64(salt),iter,hash:await hashPin(pin,salt,iter)}}
async function pinOk(pin){const l=getLock();if(!l)return true;return (await hashPin(pin,unb64(l.salt),l.iter))===l.hash}
const pinValid=p=>/^\d{4,8}$/.test(p);
const val=id=>{const n=document.getElementById(id);return n?n.value:''};

function vLock(){
  const wait=ui.lockUntil>Date.now()?Math.ceil((ui.lockUntil-Date.now())/1000):0;
  if(ui.forgot) return `<div class="lock"><h1>Kassen<span>sturz</span></h1>
    <p>Ohne PIN lässt sich die App nur zurücksetzen. Dabei werden <b>alle Daten auf diesem Handy gelöscht</b>. Danach kannst du ein Backup wiederherstellen.</p>
    ${ui.forgot===2?`<p class="err">Wirklich alles löschen?</p><div class="row" style="justify-content:center"><button class="danger" data-act="forgot-yes">Ja, alles löschen</button><button data-act="forgot-no">Abbrechen</button></div>`
      :`<div class="row" style="justify-content:center"><button class="danger" data-act="forgot-ask">App zurücksetzen</button><button data-act="forgot-no">Zurück</button></div>`}</div>`;
  return `<div class="lock"><h1>Kassen<span>sturz</span></h1>
    ${cryptoOk?`<form id="unlock-form" class="lockform" autocomplete="off">
      <label class="f" for="unlock-pin">PIN eingeben<input id="unlock-pin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off"${wait?' disabled':''}></label>
      <button class="primary" type="submit"${wait?' disabled':''} style="justify-content:center">Entsperren</button></form>
      ${ui.lockErr?`<p class="err" role="alert">${esc(ui.lockErr)}${wait?` Noch ${wait} Sekunden warten.`:''}</p>`:''}
      <button class="ghost" data-act="forgot">PIN vergessen?</button>`
    :`<p class="err">Die App-Sperre funktioniert nur, wenn die App über https geöffnet wird.</p>`}</div>`;
}
function vLockSettings(){
  const on=!!getLock();
  let h=`<h2>App-Sperre</h2><div class="box">`;
  if(!cryptoOk) return h+`<p class="small" style="margin:0">Die App-Sperre funktioniert nur, wenn die App über https geöffnet ist (z. B. GitHub Pages).</p></div>`;
  if(on) h+=`<p class="small" style="margin:0"><b>Aktiv.</b> Die App fragt beim Start nach der PIN und sperrt sich nach 1 Minute im Hintergrund.</p>
    <form id="lock-change-form" class="form" style="margin:0;border:0;padding:0" autocomplete="off">
      <label class="f full" for="lk-old">Aktuelle PIN<input id="lk-old" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"></label>
      <label class="f" for="lk-new">Neue PIN<input id="lk-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"></label>
      <label class="f" for="lk-new2">Neue PIN wiederholen<input id="lk-new2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"></label>
      <div class="row full"><button class="primary" type="submit">PIN ändern</button><button type="button" class="danger" data-act="lock-remove">Sperre ausschalten</button></div></form>`;
  else h+=`<p class="small" style="margin:0">Schützt vor neugierigen Blicken, wenn jemand dein Handy in der Hand hat. Die App fragt dann beim Start nach einer PIN.</p>
    <form id="lock-set-form" class="form" style="margin:0;border:0;padding:0" autocomplete="off">
      <label class="f" for="lk-new">PIN (4–8 Ziffern)<input id="lk-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"></label>
      <label class="f" for="lk-new2">PIN wiederholen<input id="lk-new2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8"></label>
      <div class="row full"><button class="primary" type="submit">Sperre einschalten</button></div></form>`;
  h+=`<p id="lock-msg" class="small" role="status" style="margin:0">${esc(ui.lockMsg)}</p>
    <p class="muted small" style="margin:0">Die Sperre ersetzt nicht die Bildschirmsperre deines Handys. Wer technisches Wissen und dein entsperrtes Handy hat, könnte die gespeicherten Daten trotzdem auslesen.</p></div>`;
  return h;
}
async function makeBackupText(){
  const errEl=document.getElementById('bk-err');const fail=m=>{ui.backupErr=m;if(errEl)errEl.textContent=m;else render();return null};
  if(!cryptoOk||ui.plainBackup) return {text:JSON.stringify(state),enc:false};
  const pw=val('bk-pw'),pw2=val('bk-pw2');
  if(pw.length<8) return fail('Das Passwort braucht mindestens 8 Zeichen. Oder setze den Haken bei „Ohne Passwort sichern“.');
  if(pw!==pw2) return fail('Die beiden Passwörter stimmen nicht überein.');
  return {text:await encryptBackup(state,pw),enc:true};
}
async function importAny(text,pw){
  let o;try{o=JSON.parse(text)}catch(e){ui.importMsg='Das ist kein gültiges Kassensturz-Backup. Wähle die heruntergeladene Datei oder kopiere den kompletten Backup-Text.';render();return}
  if(o&&o.kassensturz==='backup-enc-1'){
    if(!cryptoOk){ui.importMsg='Verschlüsselte Backups lassen sich nur über https öffnen.';render();return}
    if(!pw){ui.pendingImport=text;ui.pendingEnc=true;ui.importMsg='Dieses Backup ist verschlüsselt. Gib das Passwort ein und tippe auf „Wiederherstellen“.';render();return}
    try{text=await decryptBackup(o,pw)}catch(e){ui.pendingImport=text;ui.pendingEnc=true;ui.importMsg='Das Passwort ist falsch oder die Datei ist beschädigt.';render();return}
  }
  ui.pendingImport=null;ui.pendingEnc=false;doImport(text);
}

/* ---------- Anleitung (Erklär-Karten) ---------- */
// Kleine Skizzen, gezeichnet mit den Farben der App (hell und dunkel)
const ART={
  welcome:`<rect class="il-paper" x="80" y="10" width="60" height="100" rx="9"/><rect class="il-soft" x="88" y="22" width="44" height="58" rx="3"/><rect class="il-ink" x="94" y="30" width="26" height="4" rx="2"/><rect class="il-muted" x="94" y="40" width="32" height="3" rx="1.5"/><rect class="il-muted" x="94" y="48" width="24" height="3" rx="1.5"/><rect class="il-acc" x="106" y="62" width="20" height="6" rx="3"/><circle class="il-ok" cx="152" cy="86" r="15"/><path class="il-wline" d="M145 86l5 5 9-10"/>`,
  receipt:`<path class="il-paper" d="M70 12h60v86l-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5z"/><rect class="il-ink" x="80" y="24" width="30" height="4" rx="2"/><rect class="il-muted" x="80" y="36" width="24" height="3" rx="1.5"/><rect class="il-muted" x="112" y="36" width="10" height="3" rx="1.5"/><rect class="il-muted" x="80" y="45" width="28" height="3" rx="1.5"/><rect class="il-muted" x="112" y="45" width="10" height="3" rx="1.5"/><rect class="il-muted" x="80" y="54" width="20" height="3" rx="1.5"/><rect class="il-muted" x="112" y="54" width="10" height="3" rx="1.5"/><rect class="il-acc" x="80" y="70" width="42" height="5" rx="2.5"/><rect class="il-acc" x="140" y="44" width="40" height="30" rx="6"/><circle class="il-wfill" cx="160" cy="59" r="8"/><circle class="il-acc" cx="160" cy="59" r="4"/>`,
  pdf:`<path class="il-paper" d="M74 10h44l16 16v84H74z"/><path class="il-soft" d="M118 10v16h16"/><rect class="il-bad" x="82" y="34" width="30" height="14" rx="3"/><text class="il-wtext" x="97" y="45" text-anchor="middle">PDF</text><rect class="il-muted" x="82" y="58" width="44" height="3" rx="1.5"/><rect class="il-muted" x="82" y="66" width="36" height="3" rx="1.5"/><rect class="il-acc" x="82" y="86" width="44" height="5" rx="2.5"/><path class="il-aline" d="M146 60h26m-8-8 8 8-8 8"/>`,
  learn:`<rect class="il-warnbg" x="22" y="22" width="70" height="24" rx="12"/><text class="il-text" x="57" y="38" text-anchor="middle">Matcha?</text><rect class="il-soft" x="22" y="70" width="70" height="24" rx="12"/><text class="il-text" x="57" y="86" text-anchor="middle">Matcha</text><path class="il-aline" d="M100 82h26m-8-8 8 8-8 8"/><rect class="il-okbg" x="134" y="70" width="70" height="24" rx="12"/><text class="il-text" x="169" y="86" text-anchor="middle">Essen</text><path class="il-mline" d="M57 48v18"/>`,
  repeat:`<path class="il-paper" d="M50 20h50v70l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4z"/><path class="il-paper" d="M120 20h50v70l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4z"/><rect class="il-ink" x="58" y="32" width="26" height="4" rx="2"/><rect class="il-ink" x="128" y="32" width="26" height="4" rx="2"/><rect class="il-acc" x="58" y="62" width="34" height="5" rx="2.5"/><rect class="il-acc" x="128" y="62" width="34" height="5" rx="2.5"/><path class="il-aline" d="M98 46c6-8 18-8 24 0m0 0-1-8m1 8-8 0"/>`,
  cats:`<rect class="il-c1" x="20" y="24" width="56" height="20" rx="10"/><rect class="il-c2" x="82" y="24" width="64" height="20" rx="10"/><rect class="il-c3" x="152" y="24" width="48" height="20" rx="10"/><rect class="il-c4" x="40" y="54" width="60" height="20" rx="10"/><rect class="il-c5" x="106" y="54" width="70" height="20" rx="10"/><rect class="il-c6" x="64" y="84" width="54" height="20" rx="10"/><rect class="il-c7" x="124" y="84" width="40" height="20" rx="10"/>`,
  plan:`<rect class="il-paper" x="54" y="14" width="112" height="92" rx="8"/><rect class="il-acc" x="54" y="14" width="112" height="18" rx="8"/><rect class="il-acc" x="54" y="24" width="112" height="8"/>${[0,1,2,3].map(r=>[0,1,2,3,4,5].map(c=>`<rect class="${(r*6+c)%7===2?'il-acc':(r*6+c)%5===0?'il-ok':'il-soft'}" x="${62+c*16}" y="${40+r*15}" width="12" height="10" rx="2"/>`).join('')).join('')}`,
  pie:`<circle class="il-ring1" cx="80" cy="60" r="32"/><circle class="il-ring2" cx="80" cy="60" r="32" stroke-dasharray="70 201" transform="rotate(-90 80 60)"/><circle class="il-ring3" cx="80" cy="60" r="32" stroke-dasharray="40 201" stroke-dashoffset="-70" transform="rotate(-90 80 60)"/><rect class="il-c1" x="132" y="30" width="60" height="8" rx="4"/><rect class="il-c2" x="132" y="50" width="42" height="8" rx="4"/><rect class="il-c3" x="132" y="70" width="28" height="8" rx="4"/>`,
  chart:`${[38,52,44,60,48,70,56].map((v,i)=>`<rect class="${i===6?'il-acc':'il-soft'}" x="${40+i*21}" y="${100-v}" width="14" height="${v}" rx="3"/>`).join('')}<path class="il-okline" d="M36 46h150"/>`,
  contract:`<path class="il-paper" d="M58 12h56l14 14v84H58z"/><rect class="il-muted" x="68" y="34" width="44" height="3" rx="1.5"/><rect class="il-muted" x="68" y="44" width="38" height="3" rx="1.5"/><rect class="il-muted" x="68" y="54" width="42" height="3" rx="1.5"/><path class="il-mline" d="M68 92c6-6 10 4 16-2s8 2 12-2"/><circle class="il-warnbg" cx="152" cy="62" r="24"/><path class="il-warnline" d="M152 48v14l9 6"/>`,
  goal:`<rect class="il-soft" x="30" y="70" width="160" height="14" rx="7"/><rect class="il-ok" x="30" y="70" width="104" height="14" rx="7"/><path class="il-mline" d="M190 66V28"/><path class="il-acc" d="M190 28h-22l6 8-6 8h22z"/>${[0,1,2,3].map(i=>`<ellipse class="il-varfill" cx="62" cy="${58-i*8}" rx="16" ry="5"/>`).join('')}<text class="il-text" x="110" y="104" text-anchor="middle">65 %</text>`,
  budget:`<rect class="il-soft" x="40" y="24" width="140" height="10" rx="5"/><rect class="il-ok" x="40" y="24" width="70" height="10" rx="5"/><rect class="il-soft" x="40" y="54" width="140" height="10" rx="5"/><rect class="il-varfill" x="40" y="54" width="120" height="10" rx="5"/><rect class="il-soft" x="40" y="84" width="140" height="10" rx="5"/><rect class="il-bad" x="40" y="84" width="140" height="10" rx="5"/><path class="il-mline" d="M152 18v84" stroke-dasharray="3 3"/>`,
  invoice:`<path class="il-paper" d="M60 12h70v96H60z"/><rect class="il-ink" x="70" y="24" width="34" height="5" rx="2.5"/><rect class="il-muted" x="70" y="40" width="48" height="3" rx="1.5"/><rect class="il-muted" x="70" y="48" width="40" height="3" rx="1.5"/><rect class="il-acc" x="70" y="80" width="48" height="5" rx="2.5"/><rect class="il-warnbg" x="120" y="54" width="62" height="24" rx="12"/><text class="il-text" x="151" y="70" text-anchor="middle">offen</text>`,
  tax:`<path class="il-paper" d="M66 12h62v96H66z"/><rect class="il-muted" x="76" y="26" width="42" height="3" rx="1.5"/><rect class="il-muted" x="76" y="34" width="34" height="3" rx="1.5"/><circle class="il-soft" cx="97" cy="72" r="22"/><text class="il-bigtext" x="97" y="82" text-anchor="middle">§</text><path class="il-aline" d="M140 60h26m-8-8 8 8-8 8"/><rect class="il-ok" x="172" y="50" width="22" height="20" rx="4"/>`,
  backup:`<rect class="il-paper" x="36" y="18" width="46" height="84" rx="8"/><rect class="il-soft" x="43" y="30" width="32" height="50" rx="3"/><path class="il-aline" d="M92 60h30m-8-8 8 8-8 8"/><path class="il-paper" d="M134 30h38l12 12v58h-50z"/><rect class="il-acc" x="146" y="64" width="26" height="22" rx="4"/><path class="il-mline" d="M151 64v-6a8 8 0 0 1 16 0v6"/>`,
  lock:`<rect class="il-acc" x="80" y="50" width="60" height="50" rx="8"/><path class="il-mline thick" d="M92 50V38a18 18 0 0 1 36 0v12"/><circle class="il-wfill" cx="110" cy="72" r="6"/><rect class="il-wfill" x="108" y="74" width="4" height="12" rx="2"/>`,
  update:`<circle class="il-soft" cx="110" cy="60" r="40"/><path class="il-aline thick" d="M88 54a24 24 0 0 1 42-10m0 0v-12m0 12h-12M132 66a24 24 0 0 1-42 10m0 0v12m0-12h12"/>`,
  done:`<circle class="il-ok" cx="110" cy="60" r="38"/><path class="il-wline thick" d="M92 60l12 12 24-26"/>`
};
const TUT={
  start:{title:'Kurze Tour',goto:'monat',steps:[
    {t:'Willkommen bei Kassensturz',x:'Dein Haushaltsbuch, das nur auf deinem Handy speichert. Kein Konto, keine Bankverbindung, kein Server.',a:'welcome'},
    {t:'Ausgaben erfassen',x:'Kleine Ausgaben tippst du oben ins Schnelleingabe-Feld, etwa „Kaffee 3,50“. Bons fotografierst du unter „Beleg“, dort öffnest du auch PDF-Rechnungen. Die App ordnet alles einer Kategorie zu.',a:'receipt'},
    {t:'Die App lernt mit',x:'Kennt sie ein Produkt noch nicht, wählst du die Kategorie einmal aus. Beim nächsten Bon weiß sie es.',a:'learn'},
    {t:'Planen',x:'Unter „Planen“ siehst du Einnahmen, Fixkosten, Verträge sowie Sparziele und Rücklagen mit ihren Summen. Tippe einen Bereich an, um ihn aufzuklappen und Einträge hinzuzufügen.',a:'plan'},
    {t:'Der Monat auf einen Blick',x:'„Monat“ zeigt Einnahmen, Ausgaben und was übrig bleibt, nach Kategorien als Balken oder Kuchen. Mit den Pfeilen oben wechselst du den Monat, durch Wischen nach links oder rechts den Reiter.',a:'pie'},
    {t:'Deine Daten sichern',x:'Alles liegt nur auf diesem Handy. Teile unter „Mehr → Backup & Export“ ab und zu ein Backup an Google Drive, am besten mit Passwort. Die App erinnert dich einmal im Monat daran.',a:'backup'},
    {t:'Bereit',x:'Mit den Beispieldaten kannst du dich in Ruhe umsehen und sie entfernen, sobald du startest. Diese Anleitung findest du jederzeit unter „Mehr“.',a:'done'}]},
  beleg:{title:'Ausgaben und Belege erfassen',goto:'beleg',steps:[
    {t:'Schnelleingabe',x:'Tippe oben im Monat oder unter „Beleg“ etwa „Kaffee 3,50“ ein und bestätige. Das Datum ist immer heute. Kennt die App das Wort noch nicht, fragt sie einmal nach der Kategorie.',a:'learn'},
    {t:'Fotos oder PDFs',x:'Tippe unter „Beleg“ auf „Fotos, Screenshots oder PDFs wählen“. Du kannst mehrere auf einmal auswählen, die App zeigt sie nacheinander zum Prüfen. Aus Galerie oder Mail geht es auch über „Teilen → Kassensturz“.',a:'receipt'},
    {t:'Schiefe Fotos und QR-Codes',x:'Schief oder quer fotografierte Bons dreht die App selbst gerade, sonst hilft „Drehen und neu lesen“. Hat ein Bon einen QR-Code der Kasse oder eine Rechnung einen GiroCode, übernimmt sie Summe und Datum fehlerfrei daraus. Gelb markierte Beträge bitte mit dem Bon vergleichen.',a:'receipt'},
    {t:'Prüfen und speichern',x:'Die App zeigt Händler, Datum und Positionen. Passt die Summe nicht zum Bon, siehst du einen Hinweis und gleichst ihn mit „Differenz als Position“ oder „Nur Gesamtbetrag verwenden“ aus.',a:'pdf'},
    {t:'Ohne Bon',x:'Mit „Ohne Bon eintragen“ erfasst du Ausgaben von Hand. Text aus Google Lens fügst du ins Textfeld ein und tippst auf „Text auswerten“.',a:'learn'},
    {t:'Nochmal und Vorlagen',x:'Kaufst du etwas öfter, etwa ein Ticket: Beleg im Monat antippen und „Nochmal erfassen“. Oder ihn „Als Vorlage merken“, dann liegt er unter „Beleg“ ganz oben als Knopf.',a:'repeat'},
    {t:'Retouren',x:'Schickst du etwas zurück, öffne den Originalbeleg und tippe auf „Retoure erfassen“. Der Betrag wird von den Ausgaben abgezogen.',a:'repeat'}]},
  kategorien:{title:'Kategorien und Lernen',goto:'mehr',anchor:'kategorien',steps:[
    {t:'Automatisch zuordnen',x:'Jede Position bekommt eine Kategorie: über den Händler (Zalando → Kleidung), über Stichwörter (Milch → Essen) oder über das, was du der App beigebracht hast.',a:'cats'},
    {t:'Unbekannte Produkte',x:'Gelb markierte Positionen kennt die App noch nicht. Wähle einmal die Kategorie, beim Speichern merkt sie sich das.',a:'learn'},
    {t:'Ganzer Händler',x:'Mit dem Haken „Bei … immer … verwenden“ landet alles von diesem Händler in einer Kategorie.',a:'cats'},
    {t:'Namen und Farben',x:'Unter „Mehr → Kategorien & Gelerntes“ tippst du eine Kategorie an und änderst Namen oder Farbe. Dort legst du auch eigene Kategorien an.',a:'cats'},
    {t:'Korrigieren',x:'Unter „Mehr → Kategorien & Gelerntes“ siehst und änderst du auch alles, was die App gelernt hat. Verlesene Produktnamen gleicht sie mit deinen früheren Belegen ab.',a:'learn'}]},
  fix:{title:'Einnahmen und Fixkosten',goto:'fixkosten',anchor:'fix',steps:[
    {t:'Einmal eintragen',x:'Unter „Planen“ tippst du auf „Einnahmen“ oder „Fixkosten“. Ganz oben steht „+ Neue …“. Einmal eingetragen, zählen Gehalt, Miete oder Abos jeden Monat automatisch.',a:'plan'},
    {t:'Rhythmus',x:'Wähle monatlich, vierteljährlich, halbjährlich oder jährlich. Jährliche Beträge rechnet die App auf den Monat um: 60 € Haftpflicht im Jahr sind 5 € pro Monat.',a:'plan'},
    {t:'Start und Ende',x:'Mit „Ab Monat“ und „Bis Monat“ zählt ein Eintrag nur in diesem Zeitraum. „Einmalig“ zählt nur im gewählten Monat, etwa ein Bonus.',a:'plan'},
    {t:'Was übrig bleibt',x:'Einnahmen minus Fixkosten, Belege und Sparrate ergibt im Monat „Übrig“, also das, was du noch frei ausgeben kannst.',a:'pie'}]},
  vertraege:{title:'Verträge und Kündigungsfristen',goto:'fixkosten',anchor:'vertraege',steps:[
    {t:'Vertrag anlegen',x:'Tippe unter „Planen → Fixkosten“ einen Eintrag an, dann „Bearbeiten“ und „Vertrag & Kündigung“. Trage ein, wann die Mindestlaufzeit endet, die Kündigungsfrist und die Verlängerung.',a:'contract'},
    {t:'Die App rechnet',x:'Daraus berechnet sie den letzten Tag, an dem du noch kündigen kannst. Verlängert sich der Vertrag, rechnet sie automatisch weiter.',a:'contract'},
    {t:'Rechtzeitig erinnert',x:'Ab 6 Wochen vor der Frist erscheint im Monat ein Hinweis, ab 2 Wochen in Rot. Alle Fristen stehen unter „Planen → Verträge“.',a:'contract'}]},
  sparen:{title:'Sparziele und Rücklagen',goto:'fixkosten',anchor:'sparziele',steps:[
    {t:'Anlegen',x:'Unter „Planen“ tippst du auf „Sparziele & Rücklagen“ und dann ganz oben auf „+ Neu“. Wähle „Sparziel“, gib einen Namen ein, etwa „Urlaub“, und optional Zielbetrag und Datum.',a:'goal'},
    {t:'Rücklagen',x:'Wählst du beim Anlegen „Rücklage“, entsteht ein Topf für Unregelmäßiges wie Autoreparatur oder Geschenke. Beim Beleg wählst du dann „Bezahlt aus“ und die Rücklage. So belastet die Reparatur nicht den Monat.',a:'goal'},
    {t:'Die Sparrate',x:'Die Sparrate ist der Betrag, den du jeden Monat zurücklegst. Sie wird ab dem aktuellen Monat automatisch gutgeschrieben. Änderst du sie, gilt die neue Rate ab diesem Monat.',a:'goal'},
    {t:'Ein- und auszahlen',x:'Tippe ein Sparziel an. Mit „+ Einzahlen“ buchst du Extra-Beträge, etwa Weihnachtsgeld. Mit „− Entnehmen“ nimmst du Geld heraus, zum Beispiel wenn du den Urlaub bezahlst. Ein Startguthaben gibst du beim Anlegen an.',a:'goal'},
    {t:'Fortschritt',x:'Die App zeigt deinen Stand, wie viel du pro Monat brauchst, um das Ziel rechtzeitig zu erreichen, und wann du es mit der aktuellen Rate schaffst.',a:'goal'},
    {t:'Warum „Übrig“ kleiner wird',x:'Gespartes ist keine Ausgabe, aber auch nicht mehr frei verfügbar. Deshalb zieht die App die Sparrate von „Übrig“ ab. Ist ein Ziel erreicht, kannst du die Rate mit einem Tipp beenden.',a:'pie'}]},
  budgets:{title:'Budgets',goto:'mehr',anchor:'budgets',steps:[
    {t:'Einschalten',x:'Unter „Mehr → Budgets“ schaltest du Monatsbudgets ein und trägst pro Kategorie einen Betrag ein, etwa 300 € für Essen.',a:'budget'},
    {t:'Rechtzeitig gewarnt',x:'Im Monat zeigt jede Kategorie, wie viel noch übrig ist. Ab 80 % wird sie gelb, über 100 % rot, und oben erscheint ein Hinweis.',a:'budget'},
    {t:'Balken oder Kuchen',x:'Budgets siehst du in der Balkenansicht. Der Kuchen zeigt dafür die Anteile der Kategorien.',a:'pie'}]},
  kasse:{title:'Kassensturz',goto:'mehr',anchor:'kasse',steps:[
    {t:'Einschalten',x:'Unter „Mehr → Kassensturz“ schaltest du ihn ein. Danach erscheint er im Reiter „Monat“.',a:'budget'},
    {t:'Kontostand eintragen',x:'Am Monatsende trägst du den Kontostand vom Vormonat und von jetzt ein. Die App vergleicht, was laut Konto weggegangen ist, mit dem, was du erfasst hast.',a:'chart'},
    {t:'Woran liegt es?',x:'Ist die Differenz größer als 10 €, fragt die App nach Bargeld im Portemonnaie, zeigt Tage ohne Einträge und mögliche doppelte Belege. Die Schwelle stellst du unter „Mehr → Kassensturz“ ein.',a:'learn'},
    {t:'Der Rest',x:'Was übrig bleibt, buchst du als „nicht erfasst“ oder lässt es so stehen.',a:'done'}]},
  rechnungen:{title:'Offene Rechnungen',goto:'monat',steps:[
    {t:'Zahlungsziel',x:'Steht auf einer Rechnung „Zahlbar bis …“, markiert die App sie beim Prüfen als „noch nicht bezahlt“ mit Datum. Den Haken kannst du auch selbst setzen.',a:'invoice'},
    {t:'Erinnerung',x:'Offene Rechnungen stehen im Monat ganz oben, kurz vor und nach der Fälligkeit in Rot.',a:'invoice'},
    {t:'Bezahlt',x:'Hast du überwiesen, tippe auf „Bezahlt“. Als Ausgabe zählt die Rechnung im Monat ihres Rechnungsdatums.',a:'done'}]},
  steuer:{title:'Steuer und Jahresexport',goto:'mehr',anchor:'steuer',steps:[
    {t:'Markieren',x:'Beim Prüfen eines Belegs tippst du neben einer Position auf „§“ und wählst etwa Arbeitsmittel oder Fachliteratur. Die App merkt sich das für das Produkt. Auch Fixkosten wie ein Gewerkschaftsbeitrag lassen sich markieren.',a:'tax'},
    {t:'Versicherungen',x:'Berufsunfähigkeit, Unfall oder Haftpflicht zählen als „Vorsorge“. Dafür gilt ein Höchstbetrag, den oft schon die Krankenversicherung ausschöpft. Eine Diensthaftpflicht zählt zu den Werbungskosten. Unter Fixkosten macht die App einen Vorschlag.',a:'tax'},
    {t:'Handwerker und Arzt',x:'Bei Handwerkerrechnungen schlägt die App für Arbeitslohn und Anfahrt „Handwerkerleistungen“ vor, bei Arztrechnungen „Krankheitskosten“.',a:'tax'},
    {t:'Jahresliste',x:'Unter „Mehr → Steuer & Jahresexport“ siehst du die Summen so sortiert wie in der Steuererklärung: Werbungskosten, Vorsorge, Handwerker, Krankheitskosten. Die Steuerliste lädst du als CSV. Sie ist eine Sammelhilfe, keine Steuerberatung.',a:'chart'},
    {t:'Jahresabschluss',x:'Ab dem 15. Dezember erinnert dich die App an den Jahresexport: Jahres-CSV, Steuerliste und Backup.',a:'backup'}]},
  verlauf:{title:'Verlauf und Suche',goto:'verlauf',steps:[
    {t:'12 Monate im Blick',x:'„Verlauf“ zeigt Fixkosten, Belege und Einnahmen der letzten 12 Monate. Tippe auf einen Monat, um ihn zu öffnen.',a:'chart'},
    {t:'Nach Kategorie',x:'Über „Anzeigen“ siehst du nur eine Kategorie, etwa wie sich deine Ausgaben für Essen entwickeln.',a:'chart'},
    {t:'Jahresrückblick',x:'Unter dem Diagramm öffnest du den Jahresrückblick: Einnahmen, Ausgaben, Sparquote, Kategorien im Vergleich zum Vorjahr und wo du am meisten ausgibst.',a:'chart'},
    {t:'Suchen',x:'Die Suche findet Positionen in allen Belegen und rechnet die Treffer zusammen, etwa: Wie viel habe ich dieses Jahr für Kaffee ausgegeben?',a:'learn'}]},
  sicherheit:{title:'Backup, Sperre und Updates',goto:'mehr',anchor:'backup',steps:[
    {t:'Nur auf dem Handy',x:'Alle Daten liegen ausschließlich auf diesem Handy. Löschst du die App oder die Browserdaten, sind sie weg.',a:'welcome'},
    {t:'Backup',x:'Unter „Mehr → Backup & Export“ teilst du eine Sicherung direkt an Google Drive oder lädst sie herunter, am besten mit Passwort verschlüsselt. Ohne das Passwort lässt sie sich nicht öffnen. Ist das letzte Backup älter als einen Monat, erinnert dich die App.',a:'backup'},
    {t:'Sicherheitskopien',x:'Zusätzlich legt die App selbst die letzten drei Tagesstände ab. Die helfen bei Fehlern, nicht aber bei verlorenem Handy. Dafür ist das Backup da.',a:'backup'},
    {t:'App-Sperre',x:'Mit einer PIN unter „Mehr → App-Sperre“ fragt die App beim Start und nach 1 Minute im Hintergrund nach der PIN.',a:'lock'},
    {t:'Updates',x:'Gibt es eine neue Version, erscheint oben „Neue Version verfügbar“. Ein Tipp auf „Jetzt laden“ genügt, deine Daten bleiben erhalten.',a:'update'}]}
};
const TUT_ORDER=['beleg','kategorien','fix','vertraege','sparen','budgets','kasse','rechnungen','steuer','verlauf','sicherheit'];
function openTut(topic){ui.tut={topic,i:0};render()}
function closeTut(goto){
  const t=ui.tut&&TUT[ui.tut.topic];ui.tut=null;
  if(!state.prefs.tutorialDone){state.prefs.tutorialDone=true;persist()}
  setTimeout(focusAction,0);
  if(goto&&t){if(t.anchor){ui.jumpTo=t.anchor;if(t.goto==='fixkosten')ui.planOpen=t.anchor;if(t.goto==='mehr')ui.moreOpen=t.anchor}if(ui.tab!==t.goto)go(t.goto);else{render();if(t.anchor){ui.jumpTo='';scrollToHead(t.anchor)}}}
  else render();
}
function vTut(){
  const t=TUT[ui.tut.topic],n=t.steps.length,i=ui.tut.i,st=t.steps[i],last=i===n-1,first=ui.tut.topic==='start';
  return `<div class="tut-back" data-act="tut-back"><div class="tut" role="dialog" aria-modal="true" aria-labelledby="tut-h" tabindex="-1" id="tut-card">
    <div class="tut-top"><span class="eyebrow">${esc(t.title)} · ${i+1}/${n}</span><button class="ghost" data-act="tut-close">${first&&!last?'Überspringen':'Schließen'}</button></div>
    <div class="tut-art" aria-hidden="true"><svg viewBox="0 0 220 120">${ART[st.a]||''}</svg></div>
    <h2 id="tut-h">${esc(st.t)}</h2><p>${esc(st.x)}</p>
    <div class="tut-dots" aria-hidden="true">${t.steps.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
    <div class="tut-nav"><button class="ghost" data-act="tut-prev"${i===0?' disabled':''}>Zurück</button>
      ${last?(first?`<button class="primary" data-act="tut-close">Los geht's</button>`:`<span class="row" style="gap:6px"><button data-act="tut-go">Ausprobieren</button><button class="primary" data-act="tut-close">Fertig</button></span>`)
        :`<button class="primary" data-act="tut-next">Weiter</button>`}</div>
  </div></div>`;
}
function vGuide(){
  return `<h2>Anleitung</h2><div class="list guide">
    <button class="grow" data-act="tut-open" data-t="start"><b>Komplette Tour</b><span class="muted small">${TUT.start.steps.length} Schritte</span><span class="chev" aria-hidden="true">›</span></button>
    ${TUT_ORDER.map(k=>`<button class="grow" data-act="tut-open" data-t="${k}"><span>${esc(TUT[k].title)}</span><span class="muted small">${TUT[k].steps.length} Schritte</span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>`;
}

