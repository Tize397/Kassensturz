// Kassensturz – Grundlagen, Kategorien, Speicher und Berechnungen
// Die Dateien werden in dieser Reihenfolge geladen und teilen sich ihre Namen:
// daten.js → erkennung.js → ansichten.js → app.js
'use strict';
const KEY='kassensturz-v1';
const APP_VERSION='2.10.0'; // zusammen mit version.json und sw.js hochzählen
const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MSHORT=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const thisYM=()=>today().slice(0,7);
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EUR=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const r2=n=>Math.round((n||0)*100)/100;
const fmt=n=>EUR.format(r2(n));
const fmtIn=n=>(r2(n)).toFixed(2).replace('.',',');
const ymLabel=ym=>MONTHS[+ym.slice(5)-1]+' '+ym.slice(0,4);
const ymShort=ym=>MSHORT[+ym.slice(5)-1]+' '+ym.slice(2,4);
function addMonths(ym,n){let [y,m]=ym.split('-').map(Number);m+=n;while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+'-'+pad(m)}
function toNum(s){
  s=String(s??'').replace(/\s|€|EUR/gi,'');
  if(!s) return NaN;
  if(/,\d{1,2}$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  else s=s.replace(/,/g,'');
  return parseFloat(s);
}

const DEFAULT_CATS=[
  {id:'essen',name:'Essen & Trinken',color:'#2f9e6f'},
  {id:'kleidung',name:'Kleidung & Schuhe',color:'#c2569b'},
  {id:'freizeit',name:'Freizeit & Spaß',color:'#e0891c'},
  {id:'drogerie',name:'Drogerie & Haushalt',color:'#3a8fd3'},
  {id:'wohnen',name:'Wohnen',color:'#7b5dc9'},
  {id:'mobil',name:'Mobilität',color:'#d1513d'},
  {id:'vertraege',name:'Abos & Verträge',color:'#b08a2e'},
  {id:'versich',name:'Versicherungen',color:'#8a6e5c'},
  {id:'gesund',name:'Gesundheit',color:'#1aa3a3'},
  {id:'technik',name:'Technik',color:'#5d6f8c'},
  {id:'sonstiges',name:'Sonstiges',color:'#8e95a3'}
];

/* Händler. single: alles dort gehört in eine Kategorie. generic: Name aus der Bonzeile übernehmen. */
const MERCHANTS=[
  ['REWE',/\brewe\b/i,'essen'],['EDEKA',/\bedeka\b/i,'essen'],['Lidl',/\blidl\b/i,'essen'],
  ['Aldi',/\baldi\b/i,'essen'],['Kaufland',/\bkaufland\b/i,'essen'],['Netto',/\bnetto\s*(marken|city|filial)|^netto\b/im,'essen'],
  ['Penny',/\bpenny\b/i,'essen'],['Norma',/\bnorma\b/i,'essen'],['Globus',/\bglobus\b/i,'essen'],['tegut',/\btegut\b/i,'essen'],
  ['dm',/\bdm[- ]drogerie|\bdm-markt|^dm\b/im,'drogerie'],['Rossmann',/\brossmann\b/i,'drogerie'],['Müller',/\bm(ü|ue)ller\b/i,'drogerie'],
  ['Amazon',/\bamazon\b/i,null],['Otto',/\botto\.de\b/i,null],['Decathlon',/\bdecathlon\b/i,'freizeit'],['IKEA',/\bikea\b/i,'wohnen'],
  ['Zalando',/\bzalando\b/i,'kleidung',1],['About You',/\babout\s?you\b/i,'kleidung',1],['H&M',/\bh\s?&\s?m\b/i,'kleidung',1],
  ['Zara',/\bzara\b/i,'kleidung',1],['Deichmann',/\bdeichmann\b/i,'kleidung',1],['Snipes',/\bsnipes\b/i,'kleidung',1],
  ['C&A',/\bc\s?&\s?a\b/i,'kleidung',1],['Primark',/\bprimark\b/i,'kleidung',1],
  ['MediaMarkt',/\bmedia\s?markt\b/i,'technik',1],['Saturn',/\bsaturn\b/i,'technik',1],['Cyberport',/\bcyberport\b/i,'technik',1],
  ['Deutsche Bahn',/\b(deutsche bahn|db fernverkehr|bahn\.de)\b/i,'mobil',1],
  ['McDonald\'s',/\bmc\s?donald/i,'essen',1],['Burger King',/\bburger king\b/i,'essen',1],
  ['Lieferando',/\blieferando\b/i,'essen',1],['Starbucks',/\bstarbucks\b/i,'essen',1],
  ['Buchhandlung',/\b(thalia|hugendubel|osiander|buchhandlung|weltbild)\b/i,'freizeit',0,1],
  ['Stadtwerke',/\b(stadtwerke|enbw|e\.on|vattenfall|eprimo|yello|stromio|energieversorg\w*|gasversorg\w*|wasserversorg\w*|energie\s?gmbh)/i,'wohnen',1,1,'utility'],
  ['Arztpraxis',/(\bdr\.?\s*med\b|\bzahnarzt\w*|\barztpraxis|\bpraxis\s+(f(ü|ue)r|dr)|privat(ä|ae)rztlich\w*|\bgo(ä|ae)\b|\bgoz\b|physiotherap\w*|heilpraktik\w*)/i,'gesund',1,1,'medical'],
  ['Handwerker',/\b(elektro\w*|sanit(ä|ae)r\w*|heizungsbau|malerbetrieb|malermeister|maler\s?gmbh|schreinerei|tischlerei|installateur\w*|dachdecker\w*|fliesenleger\w*|handwerk\w*|haustechnik|schl(ü|ue)sseldienst)/i,'wohnen',1,1,'craft'],
  ['Kino',/\b(cinemaxx|kinopolis|uci|cineplex|kino)\b/i,'freizeit',1,1],
  ['Tankstelle',/\b(aral|shell|esso|jet|totalenergies|avia|tankstelle)\b/i,'mobil',1,1],
  ['Apotheke',/\bapotheke\b/i,'gesund',1,1],
  ['Bäckerei',/\b(b(ä|ae)ckerei|backhaus|bäcker)\b/i,'essen',1,1],
  ['Restaurant',/\b(pizzeria|ristorante|restaurant|gasthaus|gastst(ä|ae)tte|imbiss|d(ö|oe)ner|bistro|trattoria|caf(é|e)(?![a-zäöüß])|sushi|burger|kebap|kebab)/i,'essen',1,1]
].map(([name,re,cat,single,generic,type])=>({name,re,cat,single:!!single,generic:!!generic,type:type||''}));

/* Stichwörter: c = als Wortteil, w = als ganzes Wort */
const KW={
  essen:{c:['MILCH','BROT','BRÖTCH','BROETCH','KÄSE','KAESE','GOUDA','BUTTER','JOGH','QUARK','SAHNE','EIER','BANANE','APFEL','ÄPFEL','TOMATE','GURKE','PAPRIKA','KARTOFF','ZWIEBEL','SALAT','NUDEL','SPAGH','PASTA','MEHL','ZUCKER','HÄHNCH','HAEHNCH','HACKFL','WURST','SCHINKEN','SALAMI','LACHS','THUNF','PIZZA','MÜSLI','MUESLI','SCHOKO','CHIPS','KEKS','KAFFEE','WASSER','SPRUDEL','SAFT','COLA','FANTA','SPRITE','LIMO','BIER','WEIN','SEKT','RADLER','MATE','PFAND','OBST','GEMÜSE','GEMUESE','BAGUETTE','CROISS','MARMEL','NUTELLA','HONIG','KETCHUP','MAYO','SOSSE','SAUCE','TOFU','HAFER','STUDENTENF','NÜSSE','NUESSE','BREZ','KUCHEN','TIEFKÜHL','ERDBEER','TRAUBE','ORANGE','ZITRONE','BEERE','MÖHRE','KAROTTE','BROKKOLI','AVOCADO','JOGURT','TIRAMISU','BURGER','DÖNER','DOENER','SCHNITZEL','ESPRESSO','CAPPUCC','LATTE','MENÜ','MENUE','GERICHT','SUPPE','POMMES','LAKRITZ','GUMMIB','BONBON','SNACK','ENERGY','EISTEE','SCHORLE','KEBAB','SUSHI','DESSERT','PANNA','FRAICHE','FRAÎCHE','SCHLAGSAHNE','BÄCKER','BAECKER','MITTAGESSEN','ABENDESSEN','FRÜHSTÜCK','FRUEHSTUECK','MENSA','KANTINE','RESTAURANT','PIZZERIA','IMBISS','LIEFERANDO','EINKAUF','SUPERMARKT','LEBENSMITTEL','GETRÄNK','GETRAENK','KAKAO','SMOOTHIE','BRATWURST','CURRYWURST','EISDIELE','CAFÉ','MCDONALD','BURGER KING'],w:['TEE','REIS','ÖL','OEL','EI','SALZ','EIS','MAIS']},
  drogerie:{c:['SHAMPOO','DUSCH','ZAHNPASTA','ZAHNCREME','ZAHNBÜRSTE','ZAHNP','ZAHNB','ZAHNC','ZAHNS','DEO','SEIFE','CREME','TOILETTENP','KLOPAP','KÜCHENR','KUECHENR','TASCHENT','SPÜLM','SPUELM','SPÜLT','WASCHM','WASCHP','WEICHSP','REINIG','MÜLLB','MUELLB','SCHWAMM','RASIER','WATTE','KOSMET','MASCARA','LIPP','TAMPON','BINDEN','WINDEL','ALUFOL','FRISCHHALT','BACKPAP','KERZE','BATTERIE','HAARGEL','SPÜLUNG','SPUELUNG','BALEA','NIVEA','ELKOS','FRISEUR','FRISÖR','HAARSCHNITT','WASCHPULVER','PUTZMITTEL'],w:[]},
  kleidung:{c:['SHIRT','HEMD','HOSE','JEANS','PULLI','PULLOVER','HOODIE','JACKE','MANTEL','SOCKE','STRUMPF','UNTERHOSE','BOXER','KLEID','SCHUH','SNEAKER','STIEFEL','SANDAL','MÜTZE','MUETZE','SCHAL','GÜRTEL','GUERTEL','BLUSE','LEGGINGS','SHORTS','AIR MAX','SWEATSHIRT','CHINO'],w:['ROCK','TOP','BH']},
  freizeit:{c:['TICKET','KINO','EINTRITT','SPIEL','LEGO','BUCH','KONZERT','BOWLING','FESTIVAL','MUSEUM','KLETTER','POPCORN','SCHWIMMBAD','FREIBAD','THEATER','ZOO','MINIGOLF','PADEL','SQUASH','BOULDER','VINYL','SCHALLPLATTE'],w:['BAR','PUB','CLUB','PARTY']},
  gesund:{c:['IBUPROF','PARACET','ASPIRIN','PFLASTER','VITAMIN','NASENSPR','TABLETT','MAGNESIUM','APOTHEKE','ARZT','PHYSIO','MEDIKAMENT','ZAHNARZT','REZEPT','BRILLE','KONTAKTLINSE'],w:[]},
  technik:{c:['KABEL','LADEGER','USB','HDMI','KOPFHÖR','KOPFHOER','TASTATUR','AKKU','ADAPTER','SPEICHERK','POWERBANK','HÜLLE','PANZERGLAS'],w:['MAUS']},
  mobil:{c:['DIESEL','BENZIN','SUPER E','FAHRKARTE','PARKEN','PARKHAUS','PARKSCHEIN','TANKEN','TANKSTELLE','TAXI','BAHNTICKET','BUSTICKET','FAHRSCHEIN','DEUTSCHLANDTICKET','MAUT','WASCHANLAGE','AUTOWÄSCHE','LADESÄULE','E-SCOOTER','LEIHRAD'],w:['BUS','BAHN','ZUG','UBER','SPRIT','ÖPNV','OPNV','VVS','MVV','HVV','BVG','RMV','KVV']}
};

/* ---------- Speicher ----------
   Hauptspeicher ist die Browser-Datenbank (IndexedDB): viel Platz, auch für spätere Belegfotos.
   Zusätzlich eine zweite Kopie im einfachen Browser-Speicher (localStorage), solange sie hineinpasst.
   Beide gehören nur zu dieser App-Adresse; andere Webseiten und Apps kommen nicht heran.
   Beim Start gewinnt die neuere lesbare Kopie (Zeitstempel savedAt). */
let storageOk=true,loadBroken=false,booted=false,lastJson=null,lsFull=false;
function dataDb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('kassensturz-daten',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('reports'))d.createObjectStore('reports',{autoIncrement:true})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'))}catch(e){rej(e)}})}
let dbConn=null;
// Erkennungsberichte (nur mit Entwickler-Werkzeugen): eigene Ablage in derselben Datenbank
async function repStore(mode){if(!dbConn)dbConn=await dataDb();return dbConn.transaction('reports',mode).objectStore('reports')}
const reqP=q=>new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
async function repAdd(o){return reqP((await repStore('readwrite')).add(o))}
async function repAll(){return reqP((await repStore('readonly')).getAll())}
async function repCount(){return reqP((await repStore('readonly')).count())}
async function repClear(){return reqP((await repStore('readwrite')).clear())}
async function dbGet(){if(!dbConn)dbConn=await dataDb();return new Promise((res,rej)=>{const q=dbConn.transaction('kv','readonly').objectStore('kv').get('state');q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}
let dbQueue=Promise.resolve(),dbOk=null;
function dbPut(json){
  // Schreibvorgänge nacheinander, immer der neueste Stand
  dbQueue=dbQueue.then(async()=>{if(!dbConn)dbConn=await dataDb();await new Promise((res,rej)=>{const tx=dbConn.transaction('kv','readwrite');tx.objectStore('kv').put({json,at:Date.now()},'state');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})})
    .then(()=>{dbOk=true;storageOk=true},()=>{dbOk=false;storageOk=!lsFull;dbConn=null});
  return dbQueue;
}
const withTimeoutP=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r('timeout'),ms))]);
async function load(){
  let ls=null,db=null;
  try{ls=localStorage.getItem(KEY)}catch(e){}
  try{const r=await withTimeoutP(dbGet(),2500);if(r&&r!=='timeout')db=r.json}catch(e){}
  const parse=t=>{try{const o=JSON.parse(t);return o&&typeof o==='object'?o:null}catch(e){return null}};
  const a=ls?parse(ls):null,b=db?parse(db):null;
  if(a||b){
    const pick=!b?a:!a?b:((b.savedAt||0)>=(a.savedAt||0)?b:a);
    lastJson=pick===a?ls:db;return pick}
  // Nichts lesbar: unlesbare Daten nicht überschreiben lassen, beiseitelegen und Sicherheitskopie anbieten
  const raw=ls||db;
  if(raw){loadBroken=true;storageOk=false;try{localStorage.setItem(KEY+'-defekt',raw)}catch(e2){}}
  return null;
}
function persist(){
  if(!booted)return;   // vor dem Laden nie speichern, sonst würde der Startzustand echte Daten überschreiben
  try{
    // Beim ersten Speichern am Tag den bisherigen Stand als Sicherheitskopie ablegen (die letzten drei bleiben)
    const day=today();let last=null;try{last=localStorage.getItem(SNAPDAY)}catch(e){}
    if(last!==day){try{localStorage.setItem(SNAPDAY,day)}catch(e){}
      if(lastJson&&lastJson.length>2)snapPut(last||addDays(day,-1),lastJson).then(loadSnaps).catch(()=>{})}
  }catch(e){}
  state.savedAt=Date.now();
  const json=JSON.stringify(state);lastJson=json;
  dbPut(json);
  try{localStorage.setItem(KEY,json);lsFull=false;storageOk=true}
  catch(e){lsFull=true;if(dbOk===false)storageOk=false;
    // passt nicht mehr hinein: alte zweite Kopie entfernen, damit sie beim Start nicht für aktuell gehalten wird
    if(dbOk!==false)try{localStorage.removeItem(KEY)}catch(e2){}}
  requestPersist()}
/* Sicherheitskopien liegen getrennt vom normalen Speicher (IndexedDB) */
const SNAPDAY='kassensturz-snapday';
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('kassensturz-safe',1);r.onupgradeneeded=()=>r.result.createObjectStore('snaps');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function idbDo(db,mode,fn){return new Promise((res,rej)=>{const tx=db.transaction('snaps',mode),q=fn(tx.objectStore('snaps'));tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error)})}
async function snapPut(day,json){
  const db=await idb();await idbDo(db,'readwrite',st=>st.put({day,json,at:Date.now()},day));
  const keys=(await idbDo(db,'readonly',st=>st.getAllKeys())).sort();
  for(const k of keys.slice(0,-3))await idbDo(db,'readwrite',st=>st.delete(k));
  db.close()}
async function snapGet(day){const db=await idb();const r=await idbDo(db,'readonly',st=>st.get(day));db.close();return r}
async function loadSnaps(){
  try{const db=await idb();const all=await idbDo(db,'readonly',st=>st.getAll());db.close();
    ui.snaps=all.sort((a,b)=>b.day.localeCompare(a.day)).map(x=>{let n=0;try{n=(JSON.parse(x.json).receipts||[]).filter(r=>!r.example).length}catch(e){}return {day:x.day,n}});
    if(loadBroken&&ui.snaps.length&&!ui.rescueDone){ui.rescue=true;render()}
    else if(ui.tab==='mehr'&&ui.moreOpen==='backup')render()}
  catch(e){ui.snaps=[]}}
async function snapRestore(day){
  try{const r=await snapGet(day);if(!r)throw 0;const obj=JSON.parse(r.json);
    // den jetzigen Stand vorher selbst sichern, damit nichts verloren geht
    try{const cur=lastJson;if(cur&&!loadBroken)await snapPut(today()+' (vor Zurückholen)',cur)}catch(e){}
    state=migrate(obj);loadBroken=false;ui.rescue=false;ui.rescueDone=true;ui.snapConfirm=null;persist();
    ui.flash=`Stand vom ${fmtD(day.slice(0,10))} zurückgeholt.`;await loadSnaps();render()}
  catch(e){ui.snapConfirm=null;ui.flash='Die Sicherheitskopie ließ sich nicht lesen.';render()}}
function snapHtml(){
  const sn=ui.snaps||[];
  return `<h3>Automatische Sicherheitskopien</h3>
  <p class="muted small">Die App legt beim ersten Ändern am Tag den vorherigen Stand ab und behält die letzten drei. Das hilft bei Fehlern, aber nicht bei verlorenem Handy oder gelöschten Browserdaten. Dafür brauchst du das Backup oben.</p>
  ${sn.length?`<div class="list">${sn.map(x=>`<div class="rule" style="grid-template-columns:minmax(0,1fr) auto"><span>Stand vom <b>${esc(fmtD(x.day.slice(0,10)))}</b>${x.day.length>10?esc(x.day.slice(10)):''} · ${x.n} ${x.n===1?'Beleg':'Belege'}</span>
    ${ui.snapConfirm===x.day?`<span class="row"><button class="danger" data-act="snap-yes" data-day="${esc(x.day)}">Ja, zurückholen</button><button data-act="snap-no">Abbrechen</button></span>`:`<button data-act="snap-ask" data-day="${esc(x.day)}">Zurückholen</button>`}</div>`).join('')}</div>
    ${ui.snapConfirm?`<p class="small" style="color:var(--warn);font-weight:600">Der jetzige Stand wird durch den älteren ersetzt. Er wird vorher selbst als Sicherheitskopie abgelegt.</p>`:''}`
  :`<div class="list"><div class="empty">Noch keine Sicherheitskopie. Die erste entsteht morgen beim ersten Ändern.</div></div>`}`;
}
let persistAsked=false,persistGranted=null;
function requestPersist(){
  if(persistAsked||!navigator.storage||!navigator.storage.persist)return;persistAsked=true;
  navigator.storage.persisted().then(p=>p||navigator.storage.persist()).then(g=>{persistGranted=!!g}).catch(()=>{});
}

function seed(){
  const ym=thisYM();const d=n=>ym+'-'+pad(Math.min(n,28));
  return {v:2,categories:DEFAULT_CATS.map(c=>({...c})),
    receipts:[
      {id:uid(),example:true,date:d(3),merchant:'REWE',items:[
        {name:'Ja! Vollmilch 3,5%',amount:1.09,cat:'essen'},{name:'Bio Bananen',amount:1.78,cat:'essen'},
        {name:'Roggenbrot 750g',amount:1.79,cat:'essen'},{name:'Balea Shampoo',amount:0.95,cat:'drogerie'},
        {name:'Küchenrolle 4er',amount:2.49,cat:'drogerie'}]},
      {id:uid(),example:true,date:d(5),merchant:'Zalando',items:[
        {name:'Nike Air Max SC',amount:79.95,cat:'kleidung'},{name:'Basic T-Shirt 2er-Pack',amount:19.99,cat:'kleidung'}]},
      {id:uid(),example:true,date:d(8),merchant:'Zalando',refund:true,items:[{name:'Basic T-Shirt 2er-Pack',amount:-19.99,cat:'kleidung'}]},
      {id:uid(),example:true,date:d(7),merchant:'Kino Cinemaxx',items:[
        {name:'Ticket Parkett',amount:11.50,cat:'freizeit'},{name:'Popcorn mittel',amount:5.90,cat:'freizeit'}]}
    ],
    fixed:[
      {id:uid(),example:true,kind:'in',name:'Gehalt (netto)',amount:2600,interval:1,start:'',end:'',cat:''},
      {id:uid(),example:true,kind:'out',name:'Miete (warm)',amount:750,interval:1,start:'',end:'',cat:'wohnen'},
      {id:uid(),example:true,kind:'out',name:'Strom',amount:65,interval:1,start:'',end:'',cat:'wohnen'},
      {id:uid(),example:true,kind:'out',name:'Internet',amount:34.99,interval:1,start:'',end:'',cat:'vertraege',contractEnd:addDays(today(),75),noticeVal:1,noticeUnit:'monate',renew:1},
      {id:uid(),example:true,kind:'out',name:'GEW-Mitgliedsbeitrag',amount:24,interval:1,start:'',end:'',cat:'vertraege',tax:'sonstiges'},
      {id:uid(),example:true,kind:'out',name:'Deutschlandticket',amount:63,interval:1,start:'',end:'',cat:'mobil'},
      {id:uid(),example:true,kind:'out',name:'Haftpflichtversicherung',amount:60,interval:12,start:'',end:'',cat:'versich'}
    ],
    goals:[{id:'g-ex',example:true,name:'Urlaub Sommer',target:1500,due:addMonths(ym,8),rates:[{from:addMonths(ym,-3),amount:150}]}],
    deposits:[{id:uid(),example:true,goalId:'g-ex',date:d(2),amount:200,note:'Startguthaben'}],
    rules:{products:{},merchants:{},tax:{}},budgets:{},useBudgets:false,lastBackup:null,yearExport:{}};
}
function migrate(s){
  if(!s||typeof s!=='object')return seed();
  s.categories=Array.isArray(s.categories)&&s.categories.length?s.categories:DEFAULT_CATS.map(c=>({...c}));
  if(!s.categories.some(c=>c.id==='sonstiges'))s.categories.push({id:'sonstiges',name:'Sonstiges',color:'#8e95a3'});
  s.receipts=Array.isArray(s.receipts)?s.receipts:[];
  s.fixed=(Array.isArray(s.fixed)?s.fixed:[]).map(f=>({kind:'out',start:'',end:'',...f,interval:f.interval==null?1:+f.interval}));
  s.rules=s.rules||{};s.rules.products=s.rules.products||{};s.rules.merchants=s.rules.merchants||{};
  s.rules.tax=s.rules.tax||{};s.rules.fix=s.rules.fix||{};s.rules.drop=s.rules.drop||{};s.rules.layout=s.rules.layout||{};
  s.goals=Array.isArray(s.goals)?s.goals.map(g=>({rates:[],...g})):[];s.deposits=Array.isArray(s.deposits)?s.deposits:[];
  s.yearExport=s.yearExport||{};
  s.templates=Array.isArray(s.templates)?s.templates:[];s.prefs=s.prefs||{};
  s.budgets=s.budgets||{};s.useBudgets=!!s.useBudgets;s.v=3;
  s.kasse=s.kasse&&typeof s.kasse==='object'?s.kasse:{};
  return s;
}
let state=migrate(seed());   // Platzhalter, der echte Stand wird beim Start geladen (boot)

const ui={tab:'monat',ym:thisYM(),draft:null,paste:'',open:null,confirmDel:null,confirmCat:null,
  fixedEdit:null,fixedKind:'out',ruleFilter:'',search:'',chartCat:'',flash:'',exportText:'',importMsg:'',confirmClear:false,
  err:'',dup:null,dupOk:false,ocr:null,photoUrl:null,installEvt:null,installed:false,
  locked:false,lockFails:0,lockUntil:0,lockErr:'',lockMsg:'',forgot:0,hiddenAt:0,
  plainBackup:false,backupErr:'',exportEnc:false,pendingImport:null,pendingEnc:false,
  goalEdit:null,goalNew:false,depositFor:null,depositSign:1,confirmGoal:null,taxYear:+thisYM().slice(0,4),yearHide:false,action:'',
  tplEdit:false,pieSel:null,pieSel2:null,updateAvail:null,
  planOpen:null,fxForm:null,fxKind:'out',fxOpen:null,goalOpen:null,moreOpen:null,monOpen:null,showAll:false,catEdit:null,quickAsk:null,quickDone:null,quickErr:''};

const cat=id=>state.categories.find(c=>c.id===id)||{id:'sonstiges',name:'Sonstiges',color:'#8e95a3'};
const catOpts=(sel,placeholder)=>(placeholder?`<option value="">${placeholder}</option>`:'')+
  state.categories.map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${esc(c.name)}</option>`).join('');
const rTotal=r=>r.items.reduce((s,i)=>s+(+i.amount||0),0);
const INTERVALS={0:'einmalig',1:'monatlich',3:'vierteljährlich',6:'halbjährlich',12:'jährlich'};
const activeIn=(f,ym)=>f.interval===0?f.start===ym:((!f.start||f.start<=ym)&&(!f.end||f.end>=ym));
const shareOf=f=>f.interval===0?f.amount:f.amount/(f.interval||1);

/* Steuer */
const TAXKINDS={arbeitsmittel:'Arbeitsmittel',fachliteratur:'Fachliteratur',fortbildung:'Fortbildung',sonstiges:'Sonstige Werbungskosten',vorsorge:'Vorsorge (Versicherungen)',handwerker:'Handwerkerleistungen (Arbeitskosten)',krankheit:'Krankheitskosten'};
// Gruppen so, wie sie in der Steuererklärung stehen
const TAXGROUPS=[
  {id:'wk',name:'Werbungskosten',where:'Anlage N',kinds:['arbeitsmittel','fachliteratur','fortbildung','sonstiges']},
  {id:'vs',name:'Vorsorgeaufwendungen',where:'Anlage Vorsorgeaufwand',kinds:['vorsorge']},
  {id:'hw',name:'Handwerkerleistungen (§ 35a)',where:'Haushaltsnahe Aufwendungen',kinds:['handwerker']},
  {id:'ab',name:'Außergewöhnliche Belastungen',where:'Krankheitskosten',kinds:['krankheit']}];
// Versicherungen: beruflich → Werbungskosten, private Vorsorge → Vorsorgeaufwendungen, Sachversicherungen → nicht absetzbar
function taxSuggest(name,catId){
  const n=String(name||'');
  if(/(dienst|berufs?|amts)\s*-?\s*haftpflicht|diensthaftpflicht|berufshaftpflicht|schl(ü|ue)ssel\w*.*dienst|berufs-?rechtsschutz/i.test(n))return 'sonstiges';
  if(/kasko|hausrat|handy|reise|glas|geb(ä|ae)ude|tier|fahrrad|elektronik|garantie/i.test(n))return '';
  if(/berufsunf(ä|ae)hig|\bbu\b|\bbuz\b|erwerbsunf|unfall|haftpflicht|risikoleben|lebensversicherung|pflege|kranken|zahnzusatz|krankenzusatz/i.test(n))return 'vorsorge';
  if(catId==='versich'&&/versicherung/i.test(n))return '';
  return '';
}
const taxOpts=sel=>`<option value="">nicht absetzbar</option>`+TAXGROUPS.map(g=>`<optgroup label="${g.name}">${g.kinds.map(k=>`<option value="${k}"${k===sel?' selected':''}>§ ${TAXKINDS[k]}</option>`).join('')}</optgroup>`).join('');
function taxYear(y){
  const ys=String(y),rows=[],by={};
  state.receipts.filter(r=>r.date&&r.date.startsWith(ys)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>r.items.forEach(i=>{
    if(!i.tax)return;rows.push({date:r.date,merchant:r.merchant,name:i.name,kind:i.tax,amount:+i.amount||0});by[i.tax]=(by[i.tax]||0)+(+i.amount||0)}));
  state.fixed.filter(f=>f.kind!=='in'&&f.tax).forEach(f=>{let sum=0;for(let m=1;m<=12;m++){const ym=ys+'-'+pad(m);if(activeIn(f,ym))sum+=shareOf(f)}
    if(sum>0){rows.push({date:ys+'-12-31',merchant:'Fixkosten',name:f.name+' (Jahressumme)',kind:f.tax,amount:r2(sum)});by[f.tax]=(by[f.tax]||0)+sum}});
  return {rows,by,total:Object.values(by).reduce((a,b)=>a+b,0)};
}

/* Verträge */
function parseD(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function isoD(dt){return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate())}
function addDays(iso,n){const d=parseD(iso);d.setDate(d.getDate()+n);return isoD(d)}
function addMonthsD(dt,n){const d=new Date(dt.getFullYear(),dt.getMonth()+n,1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(dt.getDate(),last));return d}
const fmtD=iso=>iso?iso.split('-').reverse().join('.'):'';
function contractInfo(f){
  if(!f.contractEnd||!/^\d{4}-\d{2}-\d{2}$/.test(f.contractEnd))return null;
  const t=parseD(today()),nv=+f.noticeVal||0,unit=f.noticeUnit==='wochen'?'wochen':'monate',step=Math.max(1,+f.renew||1);
  const deadline=end=>{if(unit==='wochen'){const d=new Date(end);d.setDate(d.getDate()-7*nv);return d}return addMonthsD(end,-nv)};
  let end=parseD(f.contractEnd),dl=deadline(end),guard=0;
  while(dl<t&&guard++<600){end=addMonthsD(end,step);dl=deadline(end)}
  return {end:isoD(end),deadline:isoD(dl),days:Math.round((dl-t)/864e5)};
}
const contracts=()=>state.fixed.filter(f=>f.kind!=='in').map(f=>({f,c:contractInfo(f)})).filter(x=>x.c).sort((a,b)=>a.c.deadline.localeCompare(b.c.deadline));

/* Sparziele */
function rateFor(g,ym){let a=0;(g.rates||[]).slice().sort((x,y)=>x.from.localeCompare(y.from)).forEach(r=>{if(r.from<=ym)a=+r.amount||0});return a}
function goalBalance(g,upTo){
  upTo=upTo||thisYM();let sum=state.deposits.filter(d=>d.goalId===g.id&&d.date.slice(0,7)<=upTo).reduce((a,d)=>a+(+d.amount||0),0);
  // Rücklage: daraus bezahlte Belege gehen ab
  if(g.pot)state.receipts.forEach(r=>{if(r.pot===g.id&&r.date&&r.date.slice(0,7)<=upTo)sum-=rTotal(r)});
  const rs=(g.rates||[]).map(r=>r.from).sort();if(rs.length){for(let m=rs[0];m<=upTo;m=addMonths(m,1))sum+=rateFor(g,m)}
  return r2(sum);
}
function savedIn(ym){
  let s=0;state.goals.forEach(g=>s+=rateFor(g,ym));
  state.deposits.forEach(d=>{if(d.date.startsWith(ym)&&!d.start)s+=+d.amount||0});return r2(s);   // Startguthaben war schon da und zählt nicht als Sparen dieses Monats
}
function goalInfo(g){
  const bal=goalBalance(g),rate=rateFor(g,thisYM()),target=+g.target||0;
  const info={bal,rate,target,pct:target>0?Math.min(100,bal/target*100):0,done:target>0&&bal>=target};
  if(target>0&&!info.done){
    const rest=target-bal;
    if(g.due){let n=0;for(let m=addMonths(thisYM(),1);m<=g.due;m=addMonths(m,1))n++;info.need=n>0?r2(rest/n):rest;info.months=n}
    if(rate>0){info.eta=addMonths(thisYM(),Math.ceil(rest/rate))}
  }
  return info;
}

function monthStats(ym,catF){
  const rs=state.receipts.filter(r=>r.date&&r.date.startsWith(ym));
  let inc=0,fixOut=0,varOut=0;const by={};
  state.fixed.forEach(f=>{if(!activeIn(f,ym))return;const v=shareOf(f);
    if(f.kind==='in'){if(!catF)inc+=v;return}
    if(catF&&f.cat!==catF)return;fixOut+=v;by[f.cat]=(by[f.cat]||0)+v});
  rs.forEach(r=>r.items.forEach(i=>{if(catF&&i.cat!==catF)return;const v=+i.amount||0;varOut+=v;by[i.cat]=(by[i.cat]||0)+v}));
  const saved=catF?0:savedIn(ym);
  // aus Rücklagen bezahlte Belege belasten das „Übrig“ des Monats nicht
  let potPaid=0;if(!catF)rs.forEach(r=>{if(r.pot&&state.goals.some(g=>g.pot&&g.id===r.pot))potPaid+=rTotal(r)});
  return {rs,inc,fixOut,varOut,out:fixOut+varOut,by,saved,potPaid:r2(potPaid),left:inc-fixOut-varOut-saved+potPaid};
}

