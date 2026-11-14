(function(){
'use strict';
const KEY='kassensturz-v1';
const APP_VERSION='2.8.1'; // zusammen mit version.json und sw.js hochzählen
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

/* ---------- Speicher ---------- */
let storageOk=true;
let loadBroken=false;
function load(){
  let s=null;
  try{s=localStorage.getItem(KEY);return s?JSON.parse(s):null}
  catch(e){storageOk=false;
    // Unlesbare Daten nicht überschreiben lassen: beiseitelegen und Sicherheitskopie anbieten
    if(s){loadBroken=true;try{localStorage.setItem(KEY+'-defekt',s)}catch(e2){}}
    return null}
}
function persist(){
  try{
    // Beim ersten Speichern am Tag den bisherigen Stand als Sicherheitskopie ablegen (die letzten drei bleiben)
    const day=today(),last=localStorage.getItem(SNAPDAY);
    if(last!==day){const old=localStorage.getItem(KEY);localStorage.setItem(SNAPDAY,day);
      if(old&&old.length>2)snapPut(last||addDays(day,-1),old).then(loadSnaps).catch(()=>{})}
    localStorage.setItem(KEY,JSON.stringify(state));storageOk=true}
  catch(e){storageOk=false}
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
    try{const cur=localStorage.getItem(KEY);if(cur&&!loadBroken)await snapPut(today()+' (vor Zurückholen)',cur)}catch(e){}
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
  s.rules.tax=s.rules.tax||{};
  s.goals=Array.isArray(s.goals)?s.goals.map(g=>({rates:[],...g})):[];s.deposits=Array.isArray(s.deposits)?s.deposits:[];
  s.yearExport=s.yearExport||{};
  s.templates=Array.isArray(s.templates)?s.templates:[];s.prefs=s.prefs||{};
  s.budgets=s.budgets||{};s.useBudgets=!!s.useBudgets;s.v=3;
  s.kasse=s.kasse&&typeof s.kasse==='object'?s.kasse:{};
  return s;
}
let state=migrate(load()||seed());

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

/* ---------- Erkennung ---------- */
function normKey(s){
  return String(s||'').toUpperCase().replace(/[^A-ZÄÖÜß ]+/g,' ').split(/\s+/).filter(w=>w.length>=2).join(' ').slice(0,48);
}
// Wortteile, die sonst falsche Treffer auslösen („Anfahrtspauschale“ ist kein Schal)
const KW_NOT=/PAUSCHAL\w*|NOTIZBUCH\w*|BUCHUNG\w*|SCHALTER\w*|SCHALEN?\b|ABSCHLAG\w*|HOSENTR\w*/g;
function keywordCat(key){
  // längster Treffer gewinnt: „ZAHNPASTA“ schlägt „PASTA“
  key=key.replace(KW_NOT,' ');
  const words=key.split(/\s+/);let best=null,len=0;
  for(const [c,{c:cont,w}] of Object.entries(KW)){
    if(!state.categories.some(x=>x.id===c)) continue;
    cont.forEach(k=>{if(k.length>len&&key.includes(k)){best=c;len=k.length}});
    w.forEach(k=>{if(k.length>len&&words.includes(k)){best=c;len=k.length}});
  }
  return best;
}
const merchantType=name=>{const b=MERCHANTS.find(m=>m.re.test(name||''));return b?b.type:''};
function merchantInfo(name){
  const mk=normKey(name);
  const learned=mk&&state.rules.merchants[mk];
  const b=MERCHANTS.find(m=>m.re.test(name||''));
  if(learned&&learned.always) return {cat:learned.cat,single:true,src:'Händler (gelernt)'};
  if(b&&b.single&&b.cat) return {cat:b.cat,single:true,src:'Händler'};
  if(learned) return {cat:learned.cat,single:false,src:'Händler (gelernt)'};
  if(b&&b.cat) return {cat:b.cat,single:false,src:'Händler'};
  return {cat:null,single:false};
}
function classify(name,mi){
  const key=normKey(name);
  const lp=key&&state.rules.products[key];
  if(lp&&state.categories.some(c=>c.id===lp)) return {cat:lp,src:'gelernt',flag:false};
  if(mi.single) return {cat:mi.cat,src:mi.src,flag:false};
  const k=key&&keywordCat(key);
  if(k) return {cat:k,src:'Stichwort',flag:false};
  return {cat:'',src:'',flag:true,suggest:mi.cat||null};
}

const SKIP=/(summe|gesamt|zu zahlen|\btotal\b|endbetrag|rechnungsbetrag|zahlbetrag|mwst|\bust\b|ust-|netto|brutto|steuer|gegeben|geg\.|r(ü|ue)ckgeld|zur(ü|ue)ck|\bbar\b|kartenzahlung|girocard|ec[- ]?karte|visa|mastercard|maestro|paypal|kreditkarte|bon-?nr|beleg|kasse\b|terminal|trace|tse|uhrzeit|datum|steuer-?nr|ust-?id|filiale|tel\.|telefon|fax\b|www\.|\.de\b|vielen dank|kundenbeleg|kundenkarte|payback|punkte|subtotal|tax\b|vat\b|shipping|versandkosten|^betrag\b|umsatz|autorisier|quittung|kontaktlos|approved|anwendung|zahlbar|f(ä|ae)llig|\biban\b|\bbic\b|kundennummer|kunden-?nr|rechnungsnummer|rechnungs-?nr|bestellnummer|auftragsnummer|abrechnungszeitraum|zzgl|zuz(ü|ue)glich|inkl\.?\s*mwst|enthaltene|bevorratung|zahlungsziel|(ü|ue)berweis|abgebucht|lastschrift|bankverbindung|skonto|entspricht|unktestand|gesammelt|einl(ö|oe)sbar|[1\[|il]?s[e£]\s*-\s*(start|stop|signatur|transaktion|zeitformat|serien)|signatur|ser\s*ien\s*nummer|zeitformat|kassen\s*-?\s*id\b|gesa(n|rn|nn)t\b|ec[- ]?cash|mit\s*pin|zahlungsbetrag|zahlungsempf|verwendungszweck|kontonummer|bankleitzahl|swift|registergericht|amtsgericht|gesch(ä|ae)ftsf(ü|ue)hr|\bhrb\b|seite\s*\d+\s*von|lieferservice@)/i;
const TOTAL=/(summe|gesamtbetrag|gesamtsumme|gesamtpreis|gesamt\b|zu zahlen|endbetrag|rechnungsbetrag|zahlbetrag|zahlungsbetrag|\bgesa(?:n|rn|nn)t\b|bestellsumme|order total|grand total|^total\b|\btotal:|[a-zäöü]{1,4}(amt|ant|arnt)betrag)/i;
const PAYLINE=/(visa|girocard|ec[- ]?cash|mit\s*pin|ec[- ]?karte|mastercard|maestro|kartenzahlung|kreditkarte|paypal|^betrag\b|brutto)/i;
const NOTNAME=/^(verkauft|versand|geliefert|zustell|bestell|deine bestellung|ihre bestellung|menge|anzahl|lieferung|lieferdatum|r(ü|ue)ckgabe|artikel-?nr|art\.?-?nr|artikelnummer|preis|eur$|euro$|stk|gr(ö|oe)(ß|ss)e|farbe|variante|size|colou?r|qty|quantity|sold by|ships|delivered|arriving|order|einzelpreis|pos\.?\s|position\s|bezeichnung)/i;
const QTY=/^\s*\d+([.,]\d+)?\s*(stk\.?|st\.?|stück|kg|g|l|ltr\.?|liter)?\s*[x×*]\s*\d/i;
const DISC=/(rabatt|preisvorteil|coupon|gutschein|nachlass|preisreduz|sofortrabatt|discount)/i;
const DATE_RE=/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
const DGOOD=/(rechnungsdatum|rechnung vom|belegdatum|kaufdatum|bestelldatum|datum|\bvom\b)/i;
const DBAD=/(liefer|leistung|zahlbar|f(ä|ae)llig|\bbis\b|abbuch|abgebucht|zeitraum|g(ü|ue)ltig|mhd|ablauf|geburt|startzeit|beendigung|signatur)/i;
const DUE=/(zahlbar|f(ä|ae)llig|zahlungsziel|(ü|ue)berweis\w*|zahlung\s+bis|bezahlen\s+bis|begleichen)/i;

// Abstand zweier Wörter (Anzahl vertauschter, fehlender oder zusätzlicher Zeichen)
function lev(a,b){
  if(a===b)return 0;const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  let prev=new Array(n+1),cur=new Array(n+1);for(let j=0;j<=n;j++)prev[j]=j;
  for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));[prev,cur]=[cur,prev]}
  return prev[n];
}
// Summenzeile trotz Lesefehler erkennen („SUNME“, „Gesarnt“, „Gesamtbetnag“)
const TOTALWORDS=['summe','gesamt','gesamtbetrag','gesamtsumme','endbetrag','endsumme'];
function isTotalLine(line){
  if(TOTAL.test(line))return true;
  const w=(line.match(/^[^\p{L}]*(\p{L}{4,})/u)||[])[1];if(!w||!findPrice(line))return false;
  const lw=w.toLowerCase();if(lw==='summer'||lw==='sommer')return false;
  return TOTALWORDS.some(t=>Math.abs(t.length-lw.length)<=1&&lev(lw,t)<=(t.length>=9?2:1));
}
// Früher gespeicherte Produkte: Ein verlesener Name („Oatiy Haferdrink“) wird auf den bekannten zurückgeführt
let knownCache=null;
function knownProducts(){
  if(knownCache&&knownCache.n===state.receipts.length)return knownCache.map;
  const map=new Map();
  state.receipts.forEach(r=>{if(r.example)return;const mk=normKey(r.merchant);r.items.forEach(i=>{const k=normKey(i.name);if(k.length<8)return;
    let e=map.get(k);if(!e){e={key:k,name:i.name,m:new Set()};map.set(k,e)}e.m.add(mk)})});
  knownCache={n:state.receipts.length,map};return map;
}
function similarKnown(name,merchant){
  const k=normKey(name);if(k.length<8)return null;const map=knownProducts();if(map.has(k))return null;
  const mk=normKey(merchant);let best=null,bd=1,second=1;
  map.forEach(e=>{if(Math.abs(e.key.length-k.length)>4)return;
    const lim=e.m.has(mk)?0.2:0.1,d=lev(k,e.key)/Math.max(k.length,e.key.length);
    if(d<=lim){if(d<bd){second=bd;bd=d;best=e}else if(d<second)second=d}});
  return best&&second-bd>=0.03?best:null;   // nur bei eindeutigem Treffer
}
function findPrice(line){
  let m=line.match(/(?:EUR|€)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+[.,]\d{2})\s*[#*]{0,2}\s*([A-D]|[0-9])?\s*[#*]{0,2}\s*$/i);
  if(m) return {amt:toNum(m[1]),rest:line.slice(0,m.index),mark:(m[2]||'').toUpperCase()};
  // Preis am Zeilenende, danach evtl. Währung (auch verlesen als „E“ oder „£“) und Steuerkennzeichen wie „B“, „1“, „#A*“
  m=line.match(/(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2})(-?)\s*(?:€|£|EURO|EUR[A-Za-z]{0,3}|E(?=\s*$))?\s*[#*]{0,2}\s*([A-D]|[0-9])?\s*[#*]{0,2}\s*$/i);
  if(m){let a=toNum(m[1]);if(m[2]==='-')a=-Math.abs(a);return {amt:a,rest:line.slice(0,m.index),mark:(m[3]||'').toUpperCase()}}
  return null;
}
// Typische Lesefehler in Preisen am Zeilenende: „1, 99“, „2 ,49“, „l,19“, „O,99“, „3,S9“
function fixPrices(l){
  l=l.replace(/(\d)\s?,\s?(\d{2})(?![\d.,])/g,'$1,$2');
  return l.replace(/(^|\s)(-?[0-9OoIlS]{1,4})\s?[,.]\s?([0-9OoIlS]{2})(\s*(?:€|EUR)?\s*[A-D12]?\s*[*#]*)$/,(all,a,x,y,z)=>{
    if(((x+y).match(/\d/g)||[]).length<2||!/[OoIlS]/.test(x+y))return all;
    const f=t=>t.replace(/[Oo]/g,'0').replace(/[Il]/g,'1').replace(/S/g,'5');return a+f(x)+','+f(y)+z});
}
// Mengenzeile mit Gesamtpreis am Ende: „2 * 1,09   2,18 B“, „0,512 kg x 2,99 EUR/kg   1,53“
const PAYWORD=/(karte\b|\bbar\b|gegeben|gutschein|bezahlt|zahlung|wechselgeld|r(ü|ue)ckgeld|\bcash\b|kredit|debit|guthaben|\bec\b)/i;
const QTYTOTAL=/^\s*-?\d+(?:[.,]\d+)?\s*(?:stk\.?|st\.?|stück|kg|g|l|ltr\.?|liter)?\s*[x×*]\s*\d+[.,]\d{2,3}\s*[^\d\s]{0,10}(?:\s*\/\s*[^\d\s]{1,6})?\s+(-?\d+[.,]\d{2})\s*(?:€|EUR)?\s*([A-D]|[0-9])?\s*[*#]*\s*$/i;
const letters=s=>(String(s).match(/[A-Za-zÄÖÜäöüß]/g)||[]).length;
function cleanName(s){
  let n=s.replace(/\s*[x×]?\s*\d+[.,]\d+\s*(€|eur)\s*\/\s*[a-zA-Z²]+/gi,' ')   // Stückpreise wie „x 0,3290 €/kWh“
    .replace(/\d+[.,]\d{2}\s*(EUR|€)/gi,'')
    .replace(/^\s*\*?\s*\d{4,}\s+/,'')                      // Artikelnummern am Anfang
    .replace(/^\s*\d{1,2}\s*[x×]?\s+(?=\D)/,'')              // Menge oder Positionsnummer am Anfang
    .replace(/[*#|]+/g,' ').replace(/\s{2,}/g,' ').trim();
  for(let i=0;i<3;i++){
    n=n.replace(/\s+[x×]$/,'')
      .replace(/\s+\d+([.,]\d+)?\s+(stk\.?|st\.?|std\.?|stunden|stück|kwh|tage?|m²|qm|lfm)\.?$/i,'')
      .replace(/\s+\d{1,3}$/,'').replace(/[\s:,-]+$/,'');
  }
  return n.replace(/[\s'’‘”“"`´,;:_|~-]+$/,'').trim().slice(0,80);
}
function cleanMerchant(l){
  return l.split(/\s+[·•|]\s+|\s{3,}|,\s+|\s+-\s+\d/)[0].replace(/[^\p{L}\p{N}&'. -]/gu,'').replace(/\s{2,}/g,' ').trim().slice(0,40);
}
function pickDate(lines){
  let best=null;
  lines.forEach((l,i)=>{for(const m of l.matchAll(DATE_RE)){
    const y=m[3].length===2?'20'+m[3]:m[3],mo=+m[2],da=+m[1];
    if(mo<1||mo>12||da<1||da>31||+y<2000||+y>2100)continue;
    const iso=y+'-'+pad(mo)+'-'+pad(da),sc=(DGOOD.test(l)?2:0)-(DBAD.test(l)?3:0);
    if(!best||sc>best.sc)best={iso,sc,i};
  }});
  return best;
}
function findDue(lines,dateIso){
  for(const l of lines){
    if(!DUE.test(l)||/abgebucht|abbuchung|lastschrift|bereits bezahlt|dankend erhalten/i.test(l))continue;
    const m=[...l.matchAll(DATE_RE)][0];
    if(m){const y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+pad(+m[2])+'-'+pad(+m[1])}
    const n=l.match(/(\d{1,3})\s*tag/i);
    if(n&&dateIso)return addDays(dateIso,+n[1]);
  }
  return '';
}
// Betrag aus einem Tabellenfeld. Fehlt das Komma („798€“), ist das ein Lesefehler: Deutsche Belege drucken Preise immer mit Cent.
// Darum nur ergänzen, wenn der Beleg sonst Cent-Beträge hat und ein €-Zeichen dransteht, und als unsicher markieren.
function money(tok,comma){
  const raw=String(tok||'').replace(/[)\]]+$/,'');const euro=/(€|EUR)$/i.test(raw);const t=raw.replace(/€|EUR/gi,'');
  if(!t)return null;
  if(/^-?\d{1,3}(\.\d{3})*,\d{2}$|^-?\d+[.,]\d{2}$/.test(t))return {v:toNum(t),exact:true};
  if(comma&&euro&&/^-?\d{2,5}$/.test(t))return {v:parseInt(t,10)/100,exact:false};
  return null;
}
const TAXMARK=/^([A-D]|AIB|A\/B|A\|B|[A-D]\))$/i;
// Zeile einer Rechnungstabelle: Produkt · Menge · MwSt. · Einzelpreis · Gesamt
function tableRow(line,comma){
  const t=line.replace(/(\d)\s+€/g,'$1€').replace(/€?\s*\/\s*kg\b/gi,'€/kg').split(/\s+/).filter(Boolean);
  if(t.length<3)return null;
  const T=money(t.pop(),comma);if(!T)return null;
  let U=null,perKg=false;const u=t[t.length-1]||'';
  if(/\/kg$/i.test(u)){perKg=true;U=money(u.replace(/\/kg$/i,''),comma);t.pop()}
  else if((U=money(u,comma)))t.pop();
  else if(/^[^\d\s]{1,4}$/.test(u)&&TAXMARK.test(t[t.length-2]||''))t.pop();   // unlesbarer Einzelpreis
  if(TAXMARK.test(t[t.length-1]||''))t.pop();
  let q=null;const qt=(t[t.length-1]||'').replace(/[)\]]+$/,'');
  if(t.length>1&&/^-?\d+([.,]\d+)?(g|kg|stk\.?|st\.?)?$/i.test(qt)){q=parseFloat(qt.replace(',','.'));if(/g$/i.test(qt)||perKg)q=null;t.pop()}
  if(!t.length)return null;
  // „2508“ ist meist „250g“ (das g wird gern als 8 gelesen)
  let name=t.join(' ').replace(/\b(\d{2,4})8\.?$/,'$1g').replace(/\.$/,'');
  name=cleanName(name);if(letters(name)<2)return null;
  let amt=T.v,check=!T.exact;
  if(U&&q!=null&&Number.isInteger(q)&&q!==0){
    const calc=r2(Math.abs(q)*U.v);
    if(Math.abs(calc-Math.abs(T.v))<0.011)check=false;          // Menge × Einzelpreis bestätigt den Betrag
    else if(T.exact)check=!U.exact?false:true;
    else if(U.exact){amt=calc;check=false}                      // Gesamt unlesbar, aus Einzelpreis berechnet
  }
  if((q!=null&&q<0)||T.v<0)amt=-Math.abs(amt);
  return {name,amt:r2(amt),check};
}
// Drei Beträge wie in einer MwSt.-Zeile: Brutto = MwSt. + Netto, egal in welcher Reihenfolge gedruckt
function triple(a){
  if(a.length<3)return null;const [x,y,z]=a.slice(-3);
  if(Math.abs(z-(x+y))<0.011)return {gross:z,net:x};   // Netto · MwSt. · Brutto
  if(Math.abs(x-(y+z))<0.011)return {gross:x,net:z};   // Brutto · MwSt. · Netto
  return null;
}
// Summe geht nicht auf: Gibt es genau eine Position, bei der eine einzige falsch gelesene Ziffer alles erklärt?
// Die MwSt.-Tabelle (Summe je Steuerkennzeichen) grenzt ein, in welcher Gruppe der Fehler steckt.
function suggestFix(items,total,groups){
  const sum=r2(items.reduce((a,x)=>a+x.amount,0)),diff=r2(total-sum);
  if(Math.abs(diff)<0.011||!items.length)return null;
  let bad=null;const gk=Object.keys(groups||{});
  if(gk.length&&items.every(x=>x.mark)){bad=new Set();
    gk.forEach(k=>{const gs=r2(items.filter(x=>x.mark===k).reduce((a,x)=>a+x.amount,0));if(Math.abs(gs-groups[k])>0.011)bad.add(k)});
    if(!bad.size)bad=null}
  const LIKE={'0':'689','1':'74','2':'7','3':'895','4':'19','5':'63','6':'805','7':'12','8':'3609','9':'483'};
  const cand=[];
  items.forEach((it,i)=>{if(bad&&!bad.has(it.mark))return;const want=r2(it.amount+diff);if(want<=0)return;
    const a=it.amount.toFixed(2),b=want.toFixed(2);if(a.length!==b.length)return;
    let d=0,pos=-1;for(let k=0;k<a.length;k++)if(a[k]!==b[k]){d++;pos=k}
    if(d===1)cand.push({i,amount:want,like:(LIKE[a[pos]]||'').includes(b[pos])})});
  const likely=cand.filter(c=>c.like);
  const pick=likely.length===1?likely[0]:cand.length===1?cand[0]:null;
  return pick?{i:pick.i,amount:pick.amount}:null;
}
function parseReceipt(text,opts){
  // Störzeichen der Texterkennung am Zeilenanfang entfernen („= Betrag“, „- Visa“), Lesefehler in Preisen glätten
  const lines=[],lowIdx=new Set(),low=opts&&opts.low;
  text.split(/\r?\n/).forEach(raw=>{const l=fixPrices(raw.replace(/\t/g,' ').replace(/(\d)\s+[;:.,|'’‘`´_~°]{1,3}\s*$/,'$1').replace(/^[^\p{L}\p{N}*€-]+/u,'').replace(/^[-–]\s+(?=\p{L})/u,'').trim());
    if(l){if(low&&low.has(raw.trim()))lowIdx.add(lines.length);lines.push(l)}});
  let merchant='',total=null,netAmt=null,vatAmt=null;
  const head=lines.slice(0,8).join('\n');
  // Rechnungs- und Ladentypen nur im Kopf suchen, bekannte Händler auch im ganzen Text
  const b=MERCHANTS.find(m=>m.re.test(head))||MERCHANTS.find(m=>!m.generic&&m.re.test(text));
  if(b&&b.name==='Tankstelle'){const m=head.match(b.re);const w=m?m[0]:'';merchant=w&&!/tankstelle/i.test(w)?w.charAt(0).toUpperCase()+w.slice(1).toLowerCase():'Tankstelle'}
  else if(b&&b.generic){const l=lines.slice(0,8).find(x=>b.re.test(x)&&!findPrice(x));merchant=l?cleanMerchant(l):b.name}
  else if(b) merchant=b.name;
  else{
    for(const l of lines){if(findPrice(l))break;if(letters(l)>=3&&!SKIP.test(l)&&!NOTNAME.test(l)&&!TOTAL.test(l)&&!/^rechnung\b/i.test(l)){merchant=cleanMerchant(l);break}}
  }
  const dt=pickDate(lines);
  const votes={};const vote=(a,w)=>{if(!(a>0))return;const k=r2(a).toFixed(2);votes[k]=(votes[k]||0)+w};
  const items=[],orph=[];let pending=null,pendingAt=-9,vatNet=0,nameBelow=false,headBelow=false,seenTotal=false;const groups={};
  const tableMode=lines.some(l=>/menge/i.test(l)&&/preis/i.test(l)&&/gesamt|betrag|summe/i.test(l));
  const comma=(text.match(/\d,\d{2}\b/g)||[]).length>=3;
  // Abzug (Rabatt, Storno, Leergut): Storno löscht die passende Position, sonst mindert er die Position davor
  const addNeg=(a,name)=>{
    const words=normKey(name).split(' ').filter(w=>w.length>=4&&!/STORNO|RABATT/.test(w));
    for(let k=items.length-1;k>=0&&words.length;k--){const it=items[k];if(Math.abs(it.amount+a)<0.005&&words.some(w=>normKey(it.name).includes(w))){items.splice(k,1);return}}
    if(items.length){const it=items[items.length-1];it.amount=r2(it.amount+a);if(Math.abs(it.amount)<0.005)items.pop()}
    else items.push({name:name||'Rabatt',amount:a})};
  // Kopf wie „Artikelnr. Menge Einzel … Gesamt“ und darunter „Bezeichnung“: Name steht unter der Preiszeile
  lines.forEach((l,i)=>{if(i&&/^bezeichnung\b/i.test(l)&&/artikel|menge|einzel/i.test(lines[i-1]))nameBelow=headBelow=true});
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(isTotalLine(line)&&!/zwischen|subtotal/i.test(line)){
      const ta=(line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}/g)||[]).map(toNum),tr=triple(ta);
      if(tr&&tr.gross>0){seenTotal=true;total=tr.gross;vote(tr.gross,3);if(netAmt==null)netAmt=tr.net;pending=null;continue}
      let p=findPrice(line);
      if(!p&&lines[i+1]){const q=findPrice(lines[i+1]);if(q&&letters(q.rest)===0)p=q}
      if(p&&p.amt>0){seenTotal=true;if(/netto/i.test(line))netAmt=p.amt;else{total=p.amt;vote(p.amt,3)}}   // Kopfzeilen wie „… Gesamt“ ohne Betrag zählen nicht
      pending=null;continue;
    }
    // Zahlungs- und Steuerzeilen: Betrag merken, aber nicht als Position
    const amts=(line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}/g)||[]).map(toNum);
    if(/%/.test(line)&&amts.length>=3){const tr=triple(amts)||{gross:amts[amts.length-1],net:amts[amts.length-3]};vote(tr.gross,1);vatNet+=tr.net;
      const gm=line.match(/^([A-D]|[1-4])\s*[=:]?\s*\d{1,2}(?:[.,]\d+)?\s*%/i);if(gm)groups[gm[1].toUpperCase()]=tr.gross;pending=null;continue}
    if(/netto/i.test(line)&&amts.length&&!/%/.test(line))netAmt=amts[amts.length-1];
    if(/(mwst|umsatzsteuer|ust\b)/i.test(line)&&amts.length===1&&/zzgl|\+|zuz/i.test(line))vatAmt=amts[0];
    if(PAYLINE.test(line)&&amts.length){vote(amts[amts.length-1],1);pending=null;continue}
    {const qm=line.match(QTYTOTAL);
      if(qm&&!seenTotal){const a=toNum(qm[1]);
        // Name steht in der Zeile darüber; fehlt er, gehört die Zeile als Mengenangabe zur Position davor
        if(pending&&i-pendingAt<=1){if(a<0)addNeg(a,cleanName(pending));else if(a>0)items.push({at:i,name:cleanName(pending),amount:a,mark:(qm[2]||'').toUpperCase(),check:lowIdx.has(i)});pending=null}
        // Artikelzeile nennt nur den Einzelpreis, die Mengenzeile darunter den Gesamtpreis („2 ST x 3,99   7,98“)
        else if(a>0&&items.length&&items[items.length-1].at===i-1)items[items.length-1].amount=a;
        continue}}
    if(QTY.test(line)) continue;
    if(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(line)||/^[A-D]\s*[:=]/.test(line)) continue;
    const disc=DISC.test(line);
    if(SKIP.test(line)&&!disc){pending=null;continue}
    // lange Buchstaben-Ziffern-Folgen sind Signaturen oder Seriennummern, keine Artikel
    if(/(?=[0-9A-Za-z]*\d)(?=[0-9A-Za-z]*[A-Za-z])[0-9A-Za-z]{14,}/.test(line)){pending=null;continue}
    // Nach der Summenzeile sind Gutscheine und Abzüge Zahlungsarten, keine Rabatte auf Artikel mehr
    if(seenTotal&&(disc||/^[^\d]*-\s*\d+[.,]\d{2}\s*(€|EUR)?\s*$/i.test(line))){pending=null;continue}
    // … und Zeilen wie „Karte 9,02“ oder „Geschenkkarte 10,00“ sind Zahlungen
    if(seenTotal&&amts.length&&!/trinkgeld|^tip\b/i.test(line)&&(PAYWORD.test(line)||total!=null&&Math.abs(amts[amts.length-1]-total)<0.005&&!(pending&&i-pendingAt===1))){vote(amts[amts.length-1],1);pending=null;continue}
    if(tableMode&&!disc){const r=tableRow(line,comma);
      if(r){pending=null;if(!r.amt)continue;if(r.amt<0)addNeg(r.amt,r.name);else items.push({at:i,name:r.name,amount:r.amt,check:r.check||lowIdx.has(i)});continue}}
    let p=findPrice(line);
    // Bauart „Name unten“: Preiszeile mit Artikelnummer, deren Kommas nicht gelesen wurden („396102084 1 459 119“)
    if(!p&&nameBelow&&comma&&/^\d{3,}\s/.test(line)&&letters(line)<2){const m=line.match(/\s(\d{3,4})(?=\s|$)/);if(m)p={amt:parseInt(m[1],10)/100,rest:'',check:true}}
    // Preis ohne Komma am Zeilenende („Hack vegan 798€“): nur bei Belegen mit Cent-Beträgen, als unsicher markiert
    if(!p&&comma){const m=line.match(/\s(-?\d{2,5})\s*€\s*[A-D]?\s*$/);if(m&&letters(line.slice(0,m.index))>=3)p={amt:parseInt(m[1],10)/100,rest:line.slice(0,m.index),check:true}}
    // Preis vorn, Name dahinter („1,50  Zeitung“)
    if(!p){const m=line.match(/^(-?\d+,\d{2})\s*(?:€|EUR)?\s+(\p{L}[\p{L}\p{N} .&'-]{2,})$/u);if(m&&!/^\s*(kg|g|l|m|cm|stk|st)\b/i.test(m[2]))p={amt:toNum(m[1]),rest:m[2],mark:''}}
    if(!p){
      // Zeile ohne lesbaren Preis merken: Fehlt am Ende genau ihr Betrag, lässt er sich aus der Summe errechnen
      if(!seenTotal){
        if(nameBelow&&/^\d{3,}\s/.test(line)&&letters(line)<2){const nx=lines[i+1]||'';orph.push({at:i,name:letters(nx)>=3&&!findPrice(nx)&&!SKIP.test(nx)?cleanName(nx):'Artikel',digits:line.replace(/^\d+\s/,'').replace(/\D/g,'')})}
        else if(!nameBelow&&items.length&&letters(line)>=3&&/\d\D*\d\D*\d/.test(line)&&!NOTNAME.test(line)&&!SKIP.test(line))orph.push({at:i,name:cleanName(line.replace(/[\d.,\s]+[A-D]?\s*$/,'')),digits:(line.match(/[\d.,\s]+[A-D]?\s*$/)||[''])[0].replace(/\D/g,'')})}
      if(!nameBelow&&letters(line)>=3&&!NOTNAME.test(line)){pending=line;pendingAt=i}continue}
    let name=cleanName(p.rest);
    // Bauart „Name unten“: Die Preiszeile enthält nur Nummern, die Bezeichnung steht immer darunter
    if(headBelow&&p.amt>0&&!disc&&letters(p.rest)<3){const nx=lines[i+1]||'';
      const ok2=letters(nx)>=3&&!findPrice(nx)&&!SKIP.test(nx)&&!TOTAL.test(nx)&&!NOTNAME.test(nx);
      let amt=p.amt,chk=!!p.check||lowIdx.has(i);
      const nums=(line.match(/\d+,\d{2}(?!\d)/g)||[]).map(toNum),qm=line.match(/^\d{3,}\s+(\d{1,3})\s/);
      if(nums.length>=2&&qm){const calc=r2(+qm[1]*nums[0]);if(calc>0&&Math.abs(calc-amt)>0.011&&(amt>calc*5||amt<calc/5)){amt=calc;chk=true}}
      items.push({at:i,name:ok2?cleanName(nx):'Artikel',amount:amt,check:chk,mark:''});if(ok2)i++;pending=null;continue}
    // Mengenzeile oder unlesbarer Rest: Der Name steht in der Zeile direkt darüber
    if(pending&&i-pendingAt===1&&(items.length||QTY.test(line)||/^\s*-?\d+(?:[.,]\d+)?\s*(kg|g|l|stk|st)\b/i.test(line))&&!/\p{L}{4,}/u.test(name)&&!/str\.|stra(ß|ss)e|\b\d{5}\b|gmbh|\btel\b/i.test(pending))name=cleanName(pending);
    // Name über zwei Zeilen: Die Preiszeile setzt den Namen der Zeile darüber fort („verzinkt 200 Stk   7,95“)
    if(pending&&i-pendingAt===1&&!/str\.|stra(ß|ss)e|\b\d{5}\b|gmbh|\btel\b/i.test(pending)&&/^\p{Ll}/u.test(name)&&/^\p{Lu}/u.test(pending.trim())&&letters(name)>=2)name=cleanName(pending+' '+p.rest);
    // … oder beginnt mit einer Größenangabe („Bio Vollkorn Spaghetti“ / „500g Packung   1,49“)
    if(pending&&i-pendingAt===1&&!disc&&/^\d+(?:[.,]\d+)?\s?(g|kg|ml|l|cl|er|stk|st|m|cm)\b/i.test(p.rest.trim())&&!/str\.|stra(ß|ss)e|\b\d{5}\b|gmbh|\btel\b|\d{4,}/i.test(pending)&&cleanMerchant(pending)!==merchant)name=cleanName(pending+' '+p.rest);
    if(disc||p.amt<0){
      addNeg(-Math.abs(p.amt),name);
      pending=null;continue;
    }
    if(letters(name)<2||NOTNAME.test(name)){
      // Bons, bei denen die Bezeichnung unter der Preiszeile steht (Artikelnr. · Menge · Preis, darunter der Name)
      const nx=lines[i+1]||'';
      const nxOk=letters(nx)>=3&&!findPrice(nx)&&!SKIP.test(nx)&&!TOTAL.test(nx)&&!NOTNAME.test(nx)&&!QTY.test(nx)&&!DATE_RE.test(nx);DATE_RE.lastIndex=0;
      if(nxOk&&(nameBelow||!pending)){name=cleanName(nx);i++;nameBelow=true}
      else if(nameBelow)name='Artikel';
      else if(pending)name=cleanName(pending);else continue}
    pending=null;
    if(p.amt===0) continue;
    items.push({at:i,name,amount:p.amt,check:!!p.check||lowIdx.has(i),mark:p.mark||''});
  }
  // Gesamtbetrag per Mehrheit: „Gesamtbetrag“, Kartenzahlung und Brutto-Spalte stimmen ab
  const top=Object.entries(votes).sort((x,y)=>y[1]-x[1]||(+y[0])-(+x[0]))[0];
  if(top&&(total==null||top[1]>(votes[r2(total).toFixed(2)]||0)))total=+top[0];
  // Nennt der Beleg mehrere Beträge als Summe, gewinnt der, der zu den Positionen passt (z. B. „713,07“ verlesen, Kartenzahlung „13,07“ richtig)
  {const s0=r2(items.reduce((a,x)=>a+x.amount,0)),k=s0.toFixed(2);
    if(items.length>=2&&votes[k]&&total!=null&&Math.abs(total-s0)>0.011){votes[k]+=votes[r2(total).toFixed(2)]||0;total=s0}}
  const totalVotes=total!=null?(votes[r2(total).toFixed(2)]||0):0;
  // MwSt.-Tabelle (Satz · Netto · MwSt. · Gesamt): deren Netto-Summe gilt als Nettobetrag der Rechnung
  if(netAmt==null&&vatNet>0)netAmt=r2(vatNet);
  // Doppelt gelesene Zeile: namenlose, unsichere Position direkt vor einer Position mit demselben Betrag
  for(let k=items.length-2;k>=0;k--)if(items[k].name==='Artikel'&&items[k].check&&Math.abs(items[k].amount-items[k+1].amount)<0.005)items.splice(k,1);
  // Eine „Position“, die genau der Summe entspricht, während die übrigen schon aufgehen oder ihr Name wie „gesamt“ aussieht, ist die Summenzeile
  if(total!=null&&items.length>1){const s0=items.reduce((a,x)=>a+x.amount,0);
    for(let k=items.length-1;k>=0;k--){const it=items[k];if(Math.abs(it.amount-total)>0.005)continue;
      const w=(it.name.match(/\p{L}{4,}/u)||[''])[0].toLowerCase();
      if(Math.abs(s0-it.amount-total)<0.011||TOTALWORDS.some(t=>Math.abs(t.length-w.length)<=1&&lev(w,t)<=2)){items.splice(k,1);break}}}
  // Fehlt genau der Betrag einer Zeile, deren Preis unlesbar war, und stehen seine Ziffern in dieser Zeile: Position ergänzen
  if(total!=null&&orph.length){const diff=r2(total-items.reduce((a,x)=>a+x.amount,0));
    if(diff>=1){const ds=diff.toFixed(2).replace('.',''),c=orph.filter(o=>o.digits.includes(ds)&&letters(o.name)>=3);
      if(c.length===1){const o=c[0];let k=items.findIndex(x=>x.at>o.at);if(k<0)k=items.length;items.splice(k,0,{at:o.at,name:o.name,amount:diff,check:false,mark:''})}}}
  // Trinkgeld zählt nur mit, wenn es in der Gesamtsumme steckt
  {const ti=items.findIndex(x=>/trinkgeld|^tip\b/i.test(x.name));
    if(ti>=0&&total!=null&&Math.abs(items.reduce((a,x)=>a+x.amount,0)-items[ti].amount-total)<0.011)items.splice(ti,1)}
  // Geht die Summe der Positionen genau auf, sind auch unsicher gelesene Beträge bestätigt
  if(total!=null&&Math.abs(items.reduce((a,x)=>a+x.amount,0)-total)<0.011)items.forEach(x=>x.check=false);
  const fix=total!=null?suggestFix(items,total,groups):null;
  // Netto-Rechnung: MwSt. anteilig auf die Positionen verteilen
  let gross=null;const sum=r2(items.reduce((a,x)=>a+x.amount,0));
  if(total!=null&&sum>0&&total-sum>0.01){
    const ratio=total/sum,explicit=/zzgl|zuz(ü|ue)glich|nettobetrag|summe\s*netto|netto\s*summe|gesamt\s*netto|netto\s*gesamt|rechnungsbetrag\s*netto/i.test(text);
    const netOk=netAmt==null||Math.abs(netAmt-sum)<0.05;
    const vatOk=vatAmt==null||Math.abs(sum+vatAmt-total)<0.05;
    const hint=/netto|zzgl|zuz(ü|ue)gl|mwst|umsatzsteuer|\bust\b/i.test(text);
    if(netOk&&vatOk&&(explicit&&ratio>1.05&&ratio<1.20||hint&&(Math.abs(ratio-1.19)<0.002||Math.abs(ratio-1.07)<0.002))){
      items.forEach(x=>x.amount=r2(x.amount*ratio));
      const diff=r2(total-items.reduce((a,x)=>a+x.amount,0));
      if(diff){const big=items.reduce((m,x)=>x.amount>m.amount?x:m,items[0]);big.amount=r2(big.amount+diff)}
      gross={net:sum,vat:r2(total-sum)};
    }
  }
  return {merchant,date:dt?dt.iso:'',dateFound:!!dt,total,totalVotes,items,gross,fix:gross?null:fix,due:findDue(lines,dt&&dt.iso),type:merchantType(merchant)};
}

const CRAFT_LABOR=/ARBEIT|LOHN|MONTAGE|MONTEUR|ANFAHRT|FAHRT|STUNDE|MEISTER|GESELLE|REPARATUR|WARTUNG|ENTSORG|DEMONTAGE|EINBAU|INSTALLATION/;
function fixHintFor(merchant,type){
  if(!merchant)return null;
  const stop=new Set(['GMBH','MARKT','HANDELS','SERVICE','DEUTSCHLAND','TANKSTELLE','GESELLSCHAFT','STADT']);
  const words=normKey(merchant).split(' ').filter(w=>w.length>=4&&!stop.has(w));
  return state.fixed.find(f=>f.kind!=='in'&&(
    (type==='utility'&&/strom|gas|wasser|energie|nebenkosten|heiz|abschlag/i.test(f.name))||
    normKey(f.name).split(' ').some(w=>w.length>=4&&words.includes(w))))||null;
}
function makeDraft(parsed){
  const mi=merchantInfo(parsed.merchant);
  let items=parsed.items;
  if(!items.length) items=[{name:parsed.merchant||'',amount:parsed.total||0}];
  const type=parsed.type||merchantType(parsed.merchant);
  const fx=fixHintFor(parsed.merchant,type);
  const mkItems=list=>list.map(it=>{const sk=similarKnown(it.name,parsed.merchant);if(sk)it={...it,name:sk.name,sim:true};const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      if(!tax&&c.cat==='versich')tax=taxSuggest(it.name,c.cat);
      return {name:it.name,amount:fmtIn(it.amount),cat:c.cat,src:it.sim&&c.src?c.src+' · Name korrigiert':c.src,flag:c.flag,suggest:c.suggest,tax,check:!!it.check}});
  const sum=r2(items.reduce((a,x)=>a+x.amount,0));
  let collapsed=null;
  // Positionen gehen nicht auf, aber der Laden hat nur eine Kategorie: sicheren Gesamtbetrag nehmen
  if(parsed.total!=null&&Math.abs(sum-parsed.total)>=0.01&&mi.single&&parsed.items.length){
    collapsed=mkItems(items);items=[{name:parsed.merchant||'Einkauf',amount:parsed.total}];
  }
  return {id:null,refund:false,merchant:parsed.merchant,date:parsed.date||today(),dateGuessed:!parsed.dateFound,total:parsed.total,always:false,
    gross:parsed.gross||null,open:!!parsed.due,due:parsed.due||'',fixHint:fx?fx.id:null,collapsed,
    items:items.map(it=>{const sk=similarKnown(it.name,parsed.merchant);if(sk)it={...it,name:sk.name,sim:true};const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      if(!tax&&c.cat==='versich')tax=taxSuggest(it.name,c.cat);
      return {name:it.name,amount:fmtIn(it.amount),cat:c.cat,src:it.sim&&c.src?c.src+' · Name korrigiert':c.src,flag:c.flag,suggest:c.suggest,tax,check:!!it.check}}),pages:parsed.pages||0,warn:parsed.warn||[],q:parsed.q||null,fix:collapsed?null:(parsed.fix||null),giro:parsed.giro||null,tse:parsed.tse||null,pay:parsed.tse?parsed.tse.pay:''};
}
function reclassify(){
  const d=ui.draft;if(!d)return;
  const mi=merchantInfo(d.merchant);
  d.items.forEach(it=>{if(!it.cat){const c=classify(it.name,mi);if(!c.flag){it.cat=c.cat;it.src=c.src}else it.suggest=c.suggest}});
}

const SAMPLE=()=>`REWE Markt GmbH
Hauptstr. 12
70173 Stuttgart
                              EUR
JA! VOLLMILCH 3,5%           1,09 B
BIO BANANEN                  1,78 B
  2 Stk x 0,89
ROGGENBROT 750G              1,79 B
GOUDA JUNG SCHEIBEN          2,29 B
PREISVORTEIL                -0,30 B
BALEA SHAMPOO                0,95 A
KÜCHENROLLE 4ER              2,49 A
CLUB MATE 0,5L               1,19 B
PFAND 0,15 EUR               0,15 A
LAKRITZ SCHNECKEN            1,49 B
--------------------------------------
SUMME                 EUR   12,92
Geg. Girocard         EUR   12,92
Datum: ${today().split('-').reverse().join('.')}  Uhrzeit: 17:42`;

/* ---------- Texterkennung und PDF (läuft im Browser auf dem Handy) ---------- */
let tessPromise=null,workerPromise=null;
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve();
  if(!tessPromise)tessPromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src=TESSERACT_URL;s.onload=res;s.onerror=()=>{tessPromise=null;rej(new Error('load'))};document.head.appendChild(s)});
  return tessPromise;
}
let pageTag='',pageNote='';
function setProgress(label,p){
  if(!ui.ocr)return;ui.ocr.label=(pageTag?pageTag+': ':'')+(pageNote?pageNote+' – ':'')+label;if(p!=null)ui.ocr.p=p;
  const l=document.getElementById('ocr-label'),b=document.getElementById('ocr-bar');
  if(l)l.textContent=ui.ocr.label;if(b)b.style.width=Math.round((ui.ocr.p||0)*100)+'%';
}
let ocrPass='';
async function getWorker(){
  if(!workerPromise){
    workerPromise=window.Tesseract.createWorker('deu',1,{logger:m=>{
      const map={'loading tesseract core':'Lade Texterkennung','initializing tesseract':'Starte Texterkennung','loading language traineddata':'Lade deutsche Sprachdaten','initializing api':'Starte Texterkennung','recognizing text':'Lese Text'+ocrPass};
      setProgress((map[m.status]||'Bereite vor')+' …',m.progress)}}).catch(e=>{workerPromise=null;throw e});
  }
  return workerPromise;
}
function loadImage(file){
  return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>res({img,url});img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'))};img.src=url});
}
// Bon im Foto finden: größte helle, farblose Fläche (Papier) vor dunklerem Hintergrund
function findPaper(src,W,H){
  const s=400/Math.max(W,H),w=Math.max(1,Math.round(W*s)),h=Math.max(1,Math.round(H*s));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data,n=w*h,g=new Uint8Array(n),ok=new Uint8Array(n),hist=new Array(256).fill(0);
  for(let i=0,j=0;i<n;i++,j+=4){const r=d[j],gg=d[j+1],b=d[j+2];g[i]=(r*77+gg*150+b*29)>>8;hist[g[i]]++;ok[i]=(Math.max(r,gg,b)-Math.min(r,gg,b))<40?1:0}
  let sum=0;for(let t=0;t<256;t++)sum+=t*hist[t];let wb=0,sb=0,best=0,th=128;
  for(let t=0;t<256;t++){wb+=hist[t];if(!wb||wb===n)continue;sb+=t*hist[t];const mb=sb/wb,mf=(sum-sb)/(n-wb),v=wb*(n-wb)*(mb-mf)*(mb-mf);if(v>best){best=v;th=t}}
  const lab=new Int32Array(n),stack=new Int32Array(n),cnts=[0];let bestN=0,box=null,id=0;
  for(let i=0;i<n;i++){
    if(lab[i]||!ok[i]||g[i]<=th)continue;id++;let sp=0,cnt=0,x0=w,x1=0,y0=h,y1=0;stack[sp++]=i;lab[i]=id;
    while(sp){const k=stack[--sp],px=k%w,py=(k-px)/w;cnt++;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;
      const nb=[px>0?k-1:-1,px<w-1?k+1:-1,py>0?k-w:-1,py<h-1?k+w:-1];
      for(const q of nb)if(q>=0&&!lab[q]&&ok[q]&&g[q]>th){lab[q]=id;stack[sp++]=q}}
    cnts.push(cnt);if(cnt>bestN){bestN=cnt;box=[x0,y0,x1,y1]}
  }
  // Große helle Flächen gehören zum Papier (ein dunkler Balken im Logo kann den Bon teilen)
  const big=new Uint8Array(id+1);let bigN=0;
  for(let k=1;k<=id;k++)if(cnts[k]>=bestN*0.15){big[k]=1;bigN+=cnts[k]}
  // Papier im Schatten ist dunkler als die Schwelle: von den hellen Flächen aus weiterwachsen,
  // solange die Helligkeit nur sanft abfällt (die Papierkante ist ein harter Sprung)
  if(bestN>=n*0.03){let sp=0;const PAPER=id+1,grown=new Uint8Array(n);
    // hellster Wert der Umgebung (Blöcke von 8 Punkten, Nachbarschaft ±3 Blöcke)
    const B=8,bw=Math.ceil(w/B),bh=Math.ceil(h/B),bm=new Uint8Array(bw*bh),lm=new Uint8Array(bw*bh);
    for(let i=0;i<n;i++){const px=i%w,py=(i-px)/w,k=((py/B)|0)*bw+((px/B)|0);if(g[i]>bm[k])bm[k]=g[i]}
    for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){let m=0;
      for(let yy=Math.max(0,by-3);yy<=Math.min(bh-1,by+3);yy++)for(let xx=Math.max(0,bx-3);xx<=Math.min(bw-1,bx+3);xx++){const v=bm[yy*bw+xx];if(v>m)m=v}
      lm[by*bw+bx]=m}
    for(let i=0;i<n;i++)if(big[lab[i]])stack[sp++]=i;
    const floor=th*0.3;let add=0;
    while(sp){const k=stack[--sp],px=k%w,py=(k-px)/w;
      const nb=[px>0?k-1:-1,px<w-1?k+1:-1,py>0?k-w:-1,py<h-1?k+w:-1];
      for(const q of nb){if(q<0||grown[q]||big[lab[q]]||!ok[q])continue;const qx=q%w,qy=(q-qx)/w;
        if(g[q]>floor&&g[q]>=0.72*lm[((qy/B)|0)*bw+((qx/B)|0)]){grown[q]=1;add++;stack[sp++]=q}}}
    // nur übernehmen, wenn das Wachstum nicht ausläuft (sonst heller Tisch statt Papier)
    if(add&&bigN+add<n*0.9&&add<bigN*1.5){for(let i=0;i<n;i++)if(grown[i]){lab[i]=PAPER}bigN+=add;
      const b2=new Uint8Array(PAPER+1);b2.set(big);b2[PAPER]=1;
      var bigX=b2}
  }
  const isP=typeof bigX!=='undefined'?bigX:big;
  const spanL=new Int16Array(h).fill(-1),spanR=new Int16Array(h).fill(-1);
  if(box){box=[w,h,0,0];
    for(let i=0;i<n;i++)if(isP[lab[i]]){const px=i%w,py=(i-px)/w;
      if(spanL[py]<0||px<spanL[py])spanL[py]=px;if(px>spanR[py])spanR[py]=px;
      if(px<box[0])box[0]=px;if(px>box[2])box[2]=px;if(py<box[1])box[1]=py;if(py>box[3])box[3]=py}
    // Lücken (Zeilen ohne Papier zwischen Papierzeilen) mit der Zeile darüber füllen
    for(let y=box[1]+1;y<=box[3];y++)if(spanL[y]<0){spanL[y]=spanL[y-1];spanR[y]=spanR[y-1]}
  }
  const frac=bigN/n;
  if(!box||bestN<n*0.03||frac<0.04||frac>0.97||(box[2]-box[0])<w*0.12||(box[3]-box[1])<h*0.12)return {x:0,y:0,w:W,h:H,cropped:false};
  const m=6,x0=Math.max(0,(box[0]-m)/s),y0=Math.max(0,(box[1]-m)/s),x1=Math.min(W,(box[2]+m+1)/s),y1=Math.min(H,(box[3]+m+1)/s);
  return {x:x0,y:y0,w:x1-x0,h:y1-y0,cropped:true,s,spanL,spanR};
}
// Bild um 90, 180 oder 270 Grad drehen (quer oder kopfüber fotografierte Bons)
function rotated(src,W,H,rot){
  rot=((rot||0)%360+360)%360;if(!rot)return {src,W,H};
  const sw=rot%180?H:W,sh=rot%180?W:H,c=document.createElement('canvas');c.width=sw;c.height=sh;
  const x=c.getContext('2d');x.translate(sw/2,sh/2);x.rotate(rot*Math.PI/180);x.drawImage(src,-W/2,-H/2,W,H);
  return {src:c,W:sw,H:sh};
}
// Schräglage schätzen: Beim richtigen Winkel liegen die Textzeilen waagerecht, das Zeilenprofil hat dann die schärfsten Spitzen.
// Der Vergleich mit dem Spaltenprofil zeigt außerdem, ob der Bon quer liegt.
function skewInfo(g,w,h){
  const k=Math.max(1,Math.round(Math.max(w,h)/700)),sw=Math.floor(w/k),sh=Math.floor(h/k);
  let xs=[],ys=[];
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(g[y*k*w+x*k]<120){xs.push(x);ys.push(y)}
  if(xs.length<300)return {angle:0,side:false};
  if(xs.length>30000){const st=Math.ceil(xs.length/30000);xs=xs.filter((_,i)=>i%st===0);ys=ys.filter((_,i)=>i%st===0)}
  const n=xs.length,size=sw+sh+2,hist=new Float64Array(2*size);
  const score=(deg,swap)=>{const t=Math.tan(deg*Math.PI/180);hist.fill(0);
    for(let i=0;i<n;i++){const r=swap?xs[i]+ys[i]*t:ys[i]-xs[i]*t;hist[Math.round(r)+size>>0]++}
    let s=0;for(let i=0;i<hist.length;i++)s+=hist[i]*hist[i];return s};
  const best=swap=>{let ba=0,bs=-1;for(let a=-15;a<=15;a++){const s=score(a,swap);if(s>bs){bs=s;ba=a}}
    for(let a=ba-0.75;a<=ba+0.75;a+=0.25){const s=score(a,swap);if(s>bs){bs=s;ba=a}}return {a:ba,s:bs}};
  const up=best(false),sd=best(true);
  return {angle:up.a,side:sd.s>up.s*1.15};
}
// Fassungen für die Texterkennung: Papier ausschneiden, Hintergrund weiß, dunkle Screenshots umkehren,
// Schatten ausgleichen, gerade drehen; daraus Graustufen und Schwarz-Weiß mit örtlicher Schwelle
function prepVariants(src,W,H){
  const r=findPaper(src,W,H);
  let tw=Math.min(1600,Math.max(r.w,1200));tw=Math.min(tw,r.w*3);
  let th=Math.round(r.h*tw/r.w);
  if(tw*th>5e6){const k=Math.sqrt(5e6/(tw*th));tw=Math.round(tw*k);th=Math.round(th*k)}
  tw=Math.max(1,Math.round(tw));th=Math.max(1,th);
  let c=document.createElement('canvas');c.width=tw;c.height=th;let x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,tw,th);x.drawImage(src,r.x,r.y,r.w,r.h,0,0,tw,th);
  let img=x.getImageData(0,0,tw,th),d=img.data,n=tw*th,g=new Uint8ClampedArray(n);const inside=new Uint8Array(n).fill(1);
  // Hintergrund neben dem Papier (Tisch, Stoff) merken: Er wird weiß, damit sein Muster nicht als Schrift gelesen wird
  if(r.cropped&&r.spanL){const ky=r.h/th,kx=r.w/tw,sh=r.spanL.length;
    for(let yy=0;yy<th;yy++){const sy=Math.min(sh-1,Math.floor((r.y+yy*ky)*r.s));const L=r.spanL[sy],R=r.spanR[sy];
      for(let xx=0;xx<tw;xx++){const sx=(r.x+xx*kx)*r.s;if(L<0||sx<L+2.2||sx>R-1.2)inside[yy*tw+xx]=0}}
    // oberste und unterste Papierzeilen ebenfalls abschneiden
    {let y0=-1,y1=-1;for(let k=0;k<sh;k++)if(r.spanL[k]>=0){if(y0<0)y0=k;y1=k}
      for(let yy=0;yy<th;yy++){const sy=(r.y+yy*ky)*r.s;if(sy<y0+1.2||sy>y1-0.2)inside.fill(0,yy*tw,(yy+1)*tw)}}}
  let sumIn=0,cntIn=0;
  for(let i=0,j=0;i<n;i++,j+=4){g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;if(inside[i]){sumIn+=g[i];cntIn++}}
  const meanIn=cntIn?sumIn/cntIn:255;
  // Dunkler Screenshot (helle Schrift auf dunklem Grund): umkehren
  const inverted=!r.cropped&&meanIn<105;
  if(inverted)for(let i=0;i<n;i++)g[i]=255-g[i];
  // Schatten und ungleichmäßiges Licht ausgleichen: jeden Punkt an der Helligkeit seiner Umgebung messen
  {const W1=tw+1,si=new Float64Array(W1*(th+1)),ci=new Uint32Array(W1*(th+1));
    for(let yy=1;yy<=th;yy++){let rs=0,rc=0;for(let xx=1;xx<=tw;xx++){const i=(yy-1)*tw+xx-1;if(inside[i]){rs+=g[i];rc++}si[yy*W1+xx]=si[(yy-1)*W1+xx]+rs;ci[yy*W1+xx]=ci[(yy-1)*W1+xx]+rc}}
    const rad=Math.max(24,Math.round(Math.max(tw,th)/14)),out=new Uint8ClampedArray(n),gq=new Uint8Array(n);
    for(let yy=0;yy<th;yy++){const ya=Math.max(0,yy-rad),yb=Math.min(th,yy+rad+1);
      for(let xx=0;xx<tw;xx++){const i=yy*tw+xx;if(!inside[i]){out[i]=255;continue}
        const xa=Math.max(0,xx-rad),xb=Math.min(tw,xx+rad+1);
        const cnt=ci[yb*W1+xb]-ci[ya*W1+xb]-ci[yb*W1+xa]+ci[ya*W1+xa],S=si[yb*W1+xb]-si[ya*W1+xb]-si[yb*W1+xa]+si[ya*W1+xa];
        const m=cnt?S/cnt:255;out[i]=m>8?g[i]*235/m:g[i];gq[i]=m>8?Math.min(255,235/m*40):40}}
    // dunkle Stellen wurden stark aufgehellt: dort das mitverstärkte Rauschen glätten
    const o3=new Uint8ClampedArray(out);
    for(let yy=1;yy<th-1;yy++)for(let xx=1;xx<tw-1;xx++){const i=yy*tw+xx;if(gq[i]>62&&inside[i])o3[i]=(out[i-tw-1]+out[i-tw]+out[i-tw+1]+out[i-1]+2*out[i]+out[i+1]+out[i+tw-1]+out[i+tw]+out[i+tw+1])/10}
    g=o3}
  // Kontrast strecken
  const stretch=()=>{const hist=new Uint32Array(256);for(let i=0;i<n;i++)hist[g[i]]++;
    let lo=0,hi=255,acc=0;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=n*0.02){lo=t;break}}
    acc=0;for(let t=255;t>=0;t--){acc+=hist[t];if(acc>=n*0.02){hi=t;break}}
    const span=Math.max(1,(hi-lo)*0.8);for(let i=0;i<n;i++)g[i]=(g[i]-lo)*255/span};
  stretch();
  // Randzone des Papiers: blasse Schatten an der Kante weiß färben (echte Schrift ist deutlich dunkler)
  if(r.cropped&&r.spanL){const zone=Math.max(6,Math.round(tw*0.025));
    for(let yy=0;yy<th;yy++){let a=-1,b=-1;const o=yy*tw;
      for(let xx=0;xx<tw;xx++)if(inside[o+xx]){a=xx;break}
      if(a<0)continue;for(let xx=tw-1;xx>=0;xx--)if(inside[o+xx]){b=xx;break}
      for(let xx=a;xx<Math.min(b,a+zone);xx++)if(g[o+xx]>105)g[o+xx]=255;
      for(let xx=Math.max(a,b-zone);xx<=b;xx++)if(g[o+xx]>105)g[o+xx]=255}}
  const put=()=>{for(let i=0,j=0;i<n;i++,j+=4){d[j]=d[j+1]=d[j+2]=g[i];d[j+3]=255}x.putImageData(img,0,0)};
  put();
  // Gerade drehen
  const sk=skewInfo(g,tw,th);
  if(Math.abs(sk.angle)>=0.6){
    const a=-sk.angle*Math.PI/180,cs=Math.abs(Math.cos(a)),sn=Math.abs(Math.sin(a));
    const nw=Math.round(tw*cs+th*sn),nh=Math.round(tw*sn+th*cs),c2=document.createElement('canvas');c2.width=nw;c2.height=nh;
    const x2=c2.getContext('2d',{willReadFrequently:true});x2.fillStyle='#fff';x2.fillRect(0,0,nw,nh);
    x2.translate(nw/2,nh/2);x2.rotate(a);x2.drawImage(c,-tw/2,-th/2);x2.setTransform(1,0,0,1,0,0);
    c=c2;x=x2;tw=nw;th=nh;n=tw*th;img=x.getImageData(0,0,tw,th);d=img.data;g=new Uint8ClampedArray(n);
    for(let i=0,j=0;i<n;i++,j+=4)g[i]=d[j];
  }
  // Schärfe: An Schriftkanten (voller Wechsel hell/dunkel) messen, welcher Anteil des Wechsels
  // auf einen einzigen Punkt des Originalfotos fällt. Scharf: der größte Teil. Unscharf: verteilt über viele Punkte.
  const sc0=tw/Math.max(1,r.w),stp=Math.max(1,Math.round(sc0)),rat=[];
  for(let yy=3;yy<th-3;yy+=3)for(let xx=3*stp;xx<tw-3*stp-1;xx+=2){const i=yy*tw+xx,a=g[i-2*stp],b=g[i+2*stp],dd=Math.abs(a-b);
    if(dd<110)continue;let mx=0;for(let k=-2;k<2;k++){const v=Math.abs(g[i+(k+1)*stp]-g[i+k*stp]);if(v>mx)mx=v}
    rat.push(mx/dd);xx+=4*stp;if(rat.length>6000)break}
  let sharp=1;if(rat.length>=40){rat.sort((a,b)=>a-b);sharp=rat[rat.length>>1]}
  // Unscharfes Foto nachschärfen (Kanten verstärken)
  if(sharp<BLUR_LIMIT){const W2=tw+1,si=new Float64Array(W2*(th+1)),rd=Math.max(2,Math.round(stp*2.5));
    for(let yy=1;yy<=th;yy++){let row=0;for(let xx=1;xx<=tw;xx++){row+=g[(yy-1)*tw+xx-1];si[yy*W2+xx]=si[(yy-1)*W2+xx]+row}}
    const o2=new Uint8ClampedArray(n);
    for(let yy=0;yy<th;yy++){const ya=Math.max(0,yy-rd),yb=Math.min(th,yy+rd+1);
      for(let xx=0;xx<tw;xx++){const xa=Math.max(0,xx-rd),xb=Math.min(tw,xx+rd+1),i=yy*tw+xx;
        const m=(si[yb*W2+xb]-si[ya*W2+xb]-si[yb*W2+xa]+si[ya*W2+xa])/((yb-ya)*(xb-xa));o2[i]=g[i]+1.6*(g[i]-m)}}
    g=o2;stretch();put();
  }
  // Schwarz-Weiß mit örtlicher Schwelle
  const bw=document.createElement('canvas');bw.width=tw;bw.height=th;const bx=bw.getContext('2d');const bi=bx.createImageData(tw,th),bd=bi.data;
  const W1=tw+1,ii=new Uint32Array(W1*(th+1));
  for(let yy=1;yy<=th;yy++){let row=0;for(let xx=1;xx<=tw;xx++){row+=g[(yy-1)*tw+xx-1];ii[yy*W1+xx]=ii[(yy-1)*W1+xx]+row}}
  const rad=Math.max(7,Math.round(tw/40)),C=12;
  for(let yy=0;yy<th;yy++){const ya=Math.max(0,yy-rad),yb=Math.min(th,yy+rad+1);
    for(let xx=0;xx<tw;xx++){const xa=Math.max(0,xx-rad),xb=Math.min(tw,xx+rad+1);
      const S=ii[yb*W1+xb]-ii[ya*W1+xb]-ii[yb*W1+xa]+ii[ya*W1+xa],mean=S/((yb-ya)*(xb-xa));
      const v=g[yy*tw+xx]<mean-C?0:255,j=(yy*tw+xx)*4;bd[j]=bd[j+1]=bd[j+2]=v;bd[j+3]=255}}
  bx.putImageData(bi,0,0);
  return {gray:c,bw,cropped:r.cropped,side:sk.side,q:{sharp,dark:!inverted&&meanIn<70,scale:tw/Math.max(1,r.w),angle:sk.angle,inverted}};
}
function scoreParse(p){
  const sum=p.items.reduce((a,x)=>a+x.amount,0);let sc=0;
  if(p.total!=null)sc+=3+Math.min(p.totalVotes||0,6);
  if(p.total!=null&&p.items.length&&Math.abs(sum-p.total)<0.02)sc+=8;
  sc+=Math.min(p.items.length,6)-2*p.items.filter(i=>letters(i.name)<3).length-p.items.filter(i=>i.name==='Artikel').length;
  if(p.total>0&&p.items.length)sc+=3*(1-Math.min(1,Math.abs(sum-p.total)/p.total));
  sc-=0.5*p.items.filter(i=>i.check).length;
  if(p.dateFound)sc+=1;if(p.merchant&&letters(p.merchant)>=3)sc+=1;
  return sc;
}
const verified=p=>p.total!=null&&p.items.length>0&&Math.abs(p.items.reduce((a,x)=>a+x.amount,0)-p.total)<0.02&&(p.totalVotes||0)>=2;
// Wortliste der Texterkennung (mit Position und Sicherheit) zu Zeilen zusammensetzen.
// Die Texterkennung trennt oft Namens- und Preisspalte in zwei Blöcke; hier kommen Wörter auf gleicher Höhe wieder in eine Zeile.
function tsvRows(tsv){
  const lines=new Map();
  String(tsv||'').split('\n').forEach(l=>{const f=l.split('\t');if(f.length<12||f[0]!=='5')return;
    const t=f.slice(11).join('\t').trim();if(!t)return;
    const w={x:+f[6],y:+f[7],w:+f[8],h:+f[9],c:+f[10],t},key=f[2]+'/'+f[3]+'/'+f[4];
    if(!(w.h>0&&w.w>0))return;
    let L=lines.get(key);if(!L){L={words:[]};lines.set(key,L)}L.words.push(w)});
  const rows=[];
  [...lines.values()].forEach(L=>{const hs=L.words.map(w=>w.h).sort((a,b)=>a-b),h=hs[hs.length>>1];
    const yc=L.words.reduce((a,w)=>a+w.y+w.h/2,0)/L.words.length;
    L.yc=yc;L.h=h;L.x0=Math.min(...L.words.map(w=>w.x));L.x1=Math.max(...L.words.map(w=>w.x+w.w))});
  const ends=L=>{const ws=L.words.slice().sort((a,b)=>a.x-b.x);L.yL=ws[0].y+ws[0].h/2;L.yR=ws[ws.length-1].y+ws[ws.length-1].h/2};
  [...lines.values()].sort((a,b)=>a.x0-b.x0).forEach(L=>{ends(L);
    // rechts neben einem bestehenden Zeilenstück auf gleicher Höhe (am Übergang gemessen): gleiche Zeile
    let best=null,bd=1e9;
    rows.forEach(R=>{if(L.x0<R.x1-R.h*0.5)return;const dy=Math.abs(R.yR-L.yL);if(dy<0.55*Math.min(R.h,L.h)&&dy<bd){bd=dy;best=R}});
    if(best){best.words.push(...L.words);best.x1=Math.max(best.x1,L.x1);best.yR=L.yR;best.yc=(best.yc+L.yc)/2}
    else rows.push({words:L.words.slice(),yc:L.yc,h:L.h,x0:L.x0,x1:L.x1,yL:L.yL,yR:L.yR})});
  rows.sort((a,b)=>a.yc-b.yc);
  rows.forEach(R=>{R.words.sort((a,b)=>a.x-b.x);let out='',end=null;
    for(const w of R.words){if(end!=null)out+=(w.x-end>R.h*1.6?'   ':' ');out+=w.t;end=w.x+w.w}
    R.text=out.trim();
    // Sicherheit des Preises: letztes Wort mit Ziffern
    const pw=[...R.words].reverse().find(w=>/\d/.test(w.t));R.pc=pw?pw.c:100});
  return rows;
}
function rowsOut(rows){const low=new Set();rows.forEach(R=>{if(R.pc<55||R.clash)low.add(R.text)});return {text:rows.map(R=>R.text).join('\n'),low}}
// Zwei Lesedurchgänge zeilenweise zusammenführen: je Zeile die Lesung mit lesbarem Preis, bei Widerspruch die sicherere
function mergeRows(A,B){
  const out=[],used=new Set();
  A.forEach(a=>{let bi=-1,bd=1e9;B.forEach((b,i)=>{if(used.has(i))return;const dd=Math.abs(a.yc-b.yc);if(dd<0.8*Math.min(a.h,b.h)&&dd<bd){bd=dd;bi=i}});
    if(bi<0){out.push(a);return}
    used.add(bi);const b=B[bi],pa=findPrice(fixPrices(a.text)),pb=findPrice(fixPrices(b.text));
    if(pa&&pb){if(Math.abs(pa.amt-pb.amt)<0.005)out.push(letters(a.text)>=letters(b.text)?a:b);else{const w=a.pc>=b.pc?a:b;out.push({...w,clash:true})}}
    else if(pb&&!pa)out.push(b);else out.push(a)});
  B.forEach((b,i)=>{if(!used.has(i)&&!out.some(o=>Math.abs(o.yc-b.yc)<Math.max(o.h,b.h)))out.push(b)});
  return out.sort((x,y)=>x.yc-y.yc);
}
// Texterkennung: bis zu zwei Durchgänge (Schwarz-Weiß, dann Graustufen). Jede Lesung wird zweimal ausgewertet:
// mit den Zeilen der Texterkennung selbst und mit Zeilen, die die App aus den Wortpositionen zusammensetzt.
// quick = nur der erste Durchgang; prior = frühere Lesung derselben Bilder, die ergänzt wird.
async function ocrCanvases(variants,quick,prior){
  setProgress('Lade Texterkennung …',0);
  await loadTesseract();const w=await getWorker();
  const runs=prior&&prior.runs?prior.runs.slice():[],have=new Set(runs.map(r=>r.k));
  const passes=(quick?[{c:variants.gray,psm:'6',k:'g'}]:[{c:variants.bw,psm:'4',k:'b'},{c:variants.gray,psm:'6',k:'g'}]).filter(x=>!have.has(x.k));
  const two=!quick||!!prior;
  for(let i=0;i<passes.length;i++){
    if(runs.some(r=>verified(r.p)))break; // eindeutig, weiterer Durchgang unnötig
    ocrPass=two?` (Durchgang ${passes[i].k==='b'?1:2} von 2)`:'';setProgress('Lese Text'+ocrPass+' …',0);
    try{await w.setParameters({tessedit_pageseg_mode:passes[i].psm,preserve_interword_spaces:'1'})}catch(e){}
    const {data}=await w.recognize(passes[i].c,{},{text:true,tsv:true});
    const raw=data.text||'';let rows=null;
    try{if(data.tsv){const rr=tsvRows(data.tsv);if(rr.length)rows=rr}}catch(e){}
    if(rows){const o=rowsOut(rows),p=parseReceipt(o.text,{low:o.low});runs.push({k:passes[i].k,text:o.text,p,sc:scoreParse(p)+0.25,rows})}
    if(raw.trim()){const p=parseReceipt(raw);runs.push({k:passes[i].k,text:raw,p,sc:scoreParse(p),rows:null})}
  }
  const rb=runs.find(r=>r.k==='b'&&r.rows),rg=runs.find(r=>r.k==='g'&&r.rows);
  if(rb&&rg&&!runs.some(r=>r.k==='m')&&!runs.some(r=>verified(r.p))){
    const o=rowsOut(mergeRows(rg.rows,rb.rows)),p=parseReceipt(o.text,{low:o.low});runs.push({k:'m',text:o.text,p,sc:scoreParse(p)+0.5,rows:null});
  }
  ocrPass='';
  if(!runs.length)runs.push({k:'x',text:'',p:parseReceipt(''),sc:-9,rows:null});
  const top=runs.reduce((m,r)=>r.sc>m.sc?r:m,runs[0]),best={text:top.text,p:top.p,sc:top.sc,runs};
  // Fehlt der besten Lesung Datum, Händler oder Summe, aus einer anderen Lesung übernehmen
  runs.forEach(r=>{const a=best.p,o=r.p;if(o===a)return;
    if(!a.dateFound&&o.dateFound){a.date=o.date;a.dateFound=true}
    if(!a.merchant&&o.merchant)a.merchant=o.merchant;
    if(a.total==null&&o.total!=null&&(o.totalVotes||0)>=2){a.total=o.total;a.totalVotes=o.totalVotes}});
  // Schrifthöhe im Originalfoto (für den Hinweis „Bon zu klein im Bild“)
  const rs=runs.find(r=>r.rows);if(rs){const hs=rs.rows.map(R=>R.h).sort((a,b)=>a-b);best.textH=hs.length?hs[hs.length>>1]/(variants.q?variants.q.scale:1):0}
  return best;
}
// Foto lesen; liegt der Bon quer oder steht er kopf, die passende Drehung selbst finden.
// Jede Lage wird erst mit einem schnellen Durchgang geprüft, nur die beste wird gründlich gelesen.
async function readImage(src,W,H,rot0,fixed){
  const prep=rot=>{const R=rotated(src,W,H,rot);return prepVariants(R.src,R.W,R.H)};
  const fin=(res,v,rot)=>{res.q=v.q;res.rot=((rot%360)+360)%360;return res};
  const poor=r=>!verified(r.p)&&r.sc<7;
  const v0=prep(rot0);
  if(fixed)return fin(await ocrCanvases(v0,false),v0,rot0);
  // Erste Lage gründlich lesen (bei Verdacht auf „quer“ zuerst kurz die gedrehte Lage prüfen), die übrigen nur kurz
  const order=v0.side?[[rot0+90,true],[rot0,false],[rot0+270,true],[rot0+180,true]]:[[rot0,false],[rot0+180,true],[rot0+90,true],[rot0+270,true]];
  let best=null,bestV=null,bestQuick=false;
  for(let k=0;k<order.length;k++){
    const [rot,quick]=order[k],v=rot===rot0?v0:prep(rot);
    ocrPass='';pageNote=rot===rot0?'':'Bon wird gedreht';
    const q=await ocrCanvases(v,quick);
    if(!best||q.sc>best.sc+2){best=fin(q,v,rot);bestV=v;bestQuick=quick}
    if(!poor(best))break;
  }
  pageNote='';
  if(bestQuick&&!verified(best.p)){const full=await ocrCanvases(bestV,false,best);if(full.sc>=best.sc)best=fin(full,bestV,best.rot)}
  delete best.runs;return best;
}
/* PDF: Text direkt auslesen, eingescannte PDFs über die Texterkennung */
const PDFJS_BASE='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
let pdfjsPromise=null;
function loadPdfjs(){
  // Der PDF-Leser läuft direkt in der App (ohne Hintergrund-Worker): robuster und für Rechnungen schnell genug
  if(!pdfjsPromise)pdfjsPromise=(async()=>{
    const [lib,wk]=await Promise.all([import(PDFJS_BASE+'build/pdf.min.mjs'),import(PDFJS_BASE+'build/pdf.worker.min.mjs')]);
    globalThis.pdfjsWorker=wk;
    return lib;
  })().catch(e=>{pdfjsPromise=null;throw e});
  return pdfjsPromise;
}
function pageText(tc){
  const rows=[];
  for(const it of tc.items){if(!it.str||!it.str.trim())continue;const x=it.transform[4],y=it.transform[5],h=Math.abs(it.transform[3])||10;
    let row=rows.find(r=>Math.abs(r.y-y)<h*0.5);if(!row){row={y,h,parts:[]};rows.push(row)}row.parts.push({x,w:it.width||0,s:it.str})}
  rows.sort((a,b)=>b.y-a.y);
  return rows.map(r=>{r.parts.sort((a,b)=>a.x-b.x);let out='',end=null;
    for(const p of r.parts){if(end!=null){const gap=p.x-end;out+=gap>r.h*1.5?'   ':gap>r.h*0.15?' ':''}out+=p.s;end=p.x+p.w}
    return out.trim()}).join('\n');
}
async function readPdf(file){
  setProgress('Öffne PDF …',0.1);
  const lib=await loadPdfjs();
  const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,
    cMapUrl:PDFJS_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDFJS_BASE+'standard_fonts/'}).promise;
  const n=Math.min(doc.numPages,4);let text='';
  for(let i=1;i<=n;i++){const pg=await doc.getPage(i);text+=pageText(await pg.getTextContent())+'\n';setProgress('Lese PDF …',i/n)}
  if(letters(text)>=20){
    // GiroCode steckt als Bild in der PDF: Seiten kurz zeichnen und nach QR-Codes suchen
    const codes=[];
    for(let i=1;i<=n&&!codes.length;i++){try{setProgress('Suche QR-Code …',i/n);const pg=await doc.getPage(i);const vp=pg.getViewport({scale:2});
      const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
      await pg.render({canvasContext:c.getContext('2d'),canvas:c,viewport:vp}).promise;codes.push(...await scanCodes(c,c.width,c.height))}catch(e){}}
    return {text,p:parseReceipt(text),codes};
  }
  // eingescannt: erste Seite als Bild rendern und erkennen
  const pg=await doc.getPage(1);const vp0=pg.getViewport({scale:1});const vp=pg.getViewport({scale:Math.min(3,1600/vp0.width)});
  const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  await pg.render({canvasContext:c.getContext('2d'),canvas:c,viewport:vp}).promise;
  await new Promise(r=>c.toBlob(b=>{if(b){if(ui.photoUrl)URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=URL.createObjectURL(b)}r()},'image/jpeg',0.8));
  const codes=await scanCodes(c,c.width,c.height);
  const res=await ocrCanvases(prepVariants(c,c.width,c.height));res.codes=codes;return res;
}
const withTimeout=(pr,ms)=>Promise.race([pr,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
const isPdf=f=>f&&(f.type==='application/pdf'||/\.pdf$/i.test(f.name||''));
/* ---------- QR-Codes: GiroCode auf Rechnungen, Kassen-Code (TSE) auf Bons ---------- */
// Chrome auf Android erkennt QR-Codes selbst (auf dem Handy). Sonst Ersatz: jsQR, ebenfalls lokal.
const JSQR_URL='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
let jsqrPromise=null,detector=null;
function loadJsQR(){
  if(window.jsQR)return Promise.resolve();
  if(!jsqrPromise)jsqrPromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src=JSQR_URL;s.onload=res;s.onerror=()=>{jsqrPromise=null;rej(new Error('load'))};document.head.appendChild(s)});
  return jsqrPromise;
}
async function getDetector(){
  if(detector!==null)return detector;
  detector=false;
  try{if('BarcodeDetector' in window){const f=await window.BarcodeDetector.getSupportedFormats();if(f.includes('qr_code'))detector=new window.BarcodeDetector({formats:['qr_code']})}}catch(e){}
  return detector;
}
async function scanCodes(src,W,H){
  const out=[];
  try{
    const det=await getDetector();
    if(det){for(const c of await det.detect(src))if(c.rawValue)out.push(c.rawValue);return out}
    await loadJsQR();
    for(const max of [1400,2400]){
      const k=Math.min(1,max/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);
      const r=window.jsQR(x.getImageData(0,0,w,h).data,w,h);if(r&&r.data){out.push(r.data);break}
      if(k===1)break;
    }
  }catch(e){}
  return out;
}
// GiroCode (EPC-QR): BCD · Version · Zeichensatz · SCT · BIC · Empfänger · IBAN · EUR123.45 · Zweck · Referenz · Text
function parseGiro(raw){
  const l=String(raw).split(/\r?\n/);
  if(l[0]!=='BCD'||l[3]!=='SCT')return null;
  const m=(l[7]||'').match(/^EUR(\d+(?:\.\d{1,2})?)$/);
  return {kind:'giro',name:(l[5]||'').trim(),iban:(l[6]||'').replace(/\s/g,''),amount:m?r2(parseFloat(m[1])):null,ref:((l[9]||'')+' '+(l[10]||'')).trim()};
}
// Kassen-Code (KassenSichV): V0;Kasse;Kassenbeleg-V1;Beleg^19%_7%_10,7%_5,5%_0%^Betrag:Bar_Betrag:Unbar;Nr;Zähler;Start;Ende;…
function parseTse(raw){
  const f=String(raw).split(';');
  if(f[0]!=='V0'||f.length<9||!/Kassenbeleg/i.test(f[2]||''))return null;
  const parts=(f[3]||'').split('^');if(!/^Beleg$/i.test(parts[0]||''))return null;
  const vat=(parts[1]||'').split('_').map(Number);
  const pays=(parts[2]||'').split('_').filter(Boolean).map(x=>{const [a,t]=x.split(':');return {amt:Number(a),bar:/^bar$/i.test(t||'')}}).filter(x=>!isNaN(x.amt));
  const gross=r2(vat.filter(v=>!isNaN(v)).reduce((a,v)=>a+v,0));
  const paid=r2(pays.reduce((a,x)=>a+x.amt,0));
  const t=f[6]||f[7]||'';let d=null;
  if(/^\d{9,13}$/.test(t))d=new Date(+t*(t.length>10?1:1000));else if(t)d=new Date(t);
  const date=d&&!isNaN(d)?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):'';
  const pay=pays.length?(pays.every(x=>x.bar)?'bar':pays.every(x=>!x.bar)?'unbar':'gemischt'):'';
  const total=gross||paid;
  return total>0?{kind:'tse',total,vat19:vat[0]||0,vat7:vat[1]||0,date,pay}:null;
}
// Gelesene Codes in das Ergebnis der Texterkennung einarbeiten: Codes sind fehlerfrei und haben Vorrang
function applyCodes(p,codes){
  if(!p||!codes||!codes.length)return p;
  for(const raw of codes){
    const g=parseGiro(raw);
    if(g&&!p.giro){p.giro=g;
      if(g.amount){p.total=g.amount;p.totalVotes=9}
      if(g.name){const b=MERCHANTS.find(m=>!m.generic&&m.re.test(g.name));
        if(b)p.merchant=b.name;
        else if(!p.merchant||letters(p.merchant)<3||!MERCHANTS.some(m=>m.name===p.merchant))p.merchant=cleanMerchant(g.name)}
      continue}
    const t=parseTse(raw);
    if(t&&!p.tse){p.tse=t;p.total=t.total;p.totalVotes=9;if(t.date){p.date=t.date;p.dateFound=true}}
  }
  if(p.total!=null&&p.items.length&&Math.abs(p.items.reduce((a,x)=>a+x.amount,0)-p.total)<0.011)p.items.forEach(x=>x.check=false);
  return p;
}
const BLUR_LIMIT=0.5,SMALL_LIMIT=13;
function ocrErr(e,pdf){
  return e&&e.message==='type'?'Diese Datei kann die App nicht lesen. Wähle ein Foto, einen Screenshot oder eine PDF-Rechnung.':
    e&&e.message==='img'?'Das Bild ließ sich nicht öffnen. Versuche ein anderes Foto oder einen Screenshot.':
    pdf?'Das PDF ließ sich nicht öffnen. Beim ersten Mal braucht die App dafür Internet. Ist das PDF passwortgeschützt, öffne es in einer PDF-App und kopiere den Text.':
    e&&e.message==='timeout'?'Das Lesen hat zu lange gedauert. Prüfe die Internetverbindung und versuche es noch einmal.':
    'Die Texterkennung ließ sich nicht laden. Beim ersten Mal braucht sie Internet. Alternativ den Text mit Google Lens kopieren und unten einfügen.';
}
// Eine Datei lesen: PDF-Text direkt, Fotos und Screenshots über die Texterkennung
async function readOne(file,keepPhoto,rot,fixed){
  if(isPdf(file))return withTimeout(readPdf(file),60000);
  if(!/^image\//.test(file.type||'image/'))throw new Error('type');
  const {img,url}=await loadImage(file);
  if(keepPhoto)ui.photoUrl=url;
  try{
    setProgress('Suche QR-Code …',0.02);
    const codes=await scanCodes(img,img.naturalWidth,img.naturalHeight);
    setProgress('Suche den Bon im Foto …',0.05);await new Promise(r=>setTimeout(r,30));
    const res=await readImage(img,img.naturalWidth,img.naturalHeight,rot||0,!!fixed);
    res.codes=codes;
    // Hinweise zur Fotoqualität, falls das Ergebnis nicht rechnerisch bestätigt ist
    const q=res.q||{},w=[];
    if(q.sharp<BLUR_LIMIT)w.push('unscharf');
    if(q.dark)w.push('sehr dunkel');
    if(res.textH&&res.textH<SMALL_LIMIT)w.push('klein');
    res.p.warn=verified(res.p)?[]:w;res.p.rot=res.rot||0;res.p.q={sharp:q.sharp,textH:res.textH,angle:q.angle,inverted:q.inverted,rot:res.rot};
    return res;
  }finally{if(!keepPhoto)URL.revokeObjectURL(url)}
}
async function runOCR(file,opts){
  if(!file)return;
  const pdf=isPdf(file),o=opts||{};
  if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}
  ui.lastFile=pdf?null:file;
  ui.err='';ui.draft=null;ui.pick=null;ui.ocr={label:pdf?'Öffne PDF …':'Bereite Foto vor …',p:0};go('beleg');
  try{
    const res=await readOne(file,true,o.rot||0,o.rot!=null);
    ui.ocr=null;ui.paste=res.text||'';ui.rot=res.rot||0;
    if(!ui.paste.trim()){ui.err=pdf?'In diesem PDF wurde kein Text gefunden.':'Auf dem Foto wurde kein Text gefunden. Fotografiere den Bon gerade, formatfüllend und gut beleuchtet, oder kopiere den Text mit Google Lens.';render();return}
    parseNow(applyCodes(res.p,res.codes));
  }catch(e){ui.ocr=null;ui.err=ocrErr(e,pdf);render()}
}
// Mehrere Seiten (z. B. Screenshots einer langen Rechnung) zu einem Beleg zusammenfügen
async function runPages(files){
  ui.queue=null;ui.qTotal=0;ui.qSaved=0;ui.pick=null;
  if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}
  ui.err='';ui.draft=null;ui.ocr={label:'Bereite vor …',p:0};go('beleg');
  const texts=[],codes=[];let cur=null;
  try{
    for(let i=0;i<files.length;i++){cur=files[i];pageTag=`Seite ${i+1} von ${files.length}`;
      const res=await readOne(files[i],i===0);texts.push(res.text||'');if(res.codes)codes.push(...res.codes)}
  }catch(e){pageTag='';ui.ocr=null;ui.err=ocrErr(e,isPdf(cur));render();return}
  pageTag='';ui.ocr=null;ui.paste=texts.join('\n');
  if(!ui.paste.trim()){ui.err='Auf den Seiten wurde kein Text gefunden.';render();return}
  const p=applyCodes(parseReceipt(ui.paste),codes);p.pages=files.length;parseNow(p);
}
function askMulti(files){
  files=files.filter(Boolean);if(!files.length)return;
  if(files.length===1){ui.queue=null;ui.qTotal=0;runOCR(files[0]);return}
  ui.pick=files;ui.draft=null;ui.err='';ui.flash='';go('beleg');
}
function parseNow(pre){
  const t=ui.paste;
  if(!t.trim()){ui.err='Wähle ein Foto oder füge zuerst den Text eines Belegs ein.';render();return}
  const p=pre||parseReceipt(t);
  if(!p.items.length&&p.total==null){ui.err='In diesem Text habe ich keine Beträge gefunden. Prüfe, ob die Preise mitkopiert wurden (z. B. „1,29“).';render();return}
  ui.draft=makeDraft(p);ui.dupOk=false;ui.dup=null;ui.err='';render();window.scrollTo(0,0);
}

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
const CHANGES={'2.8.1':['Kassensturz mit Rückfragen: Bei einer Differenz fragt die App nach Bargeld im Portemonnaie, zeigt Tage ohne Einträge und mögliche doppelte Belege.','Bargeld zählt beim Kassensturz mit: Abheben ist dann kein „nicht erfasst“ mehr.','Ab welcher Differenz die App nachfragt, stellst du unter „Mehr → Kassensturz“ ein (Standard 10 €).'],'2.8.0':['Belegerkennung gründlich überarbeitet: Schiefe, quer oder kopfüber fotografierte Bons dreht die App selbst gerade. Schatten, Stoff im Hintergrund und dunkle Screenshots gleicht sie aus.','Die App setzt Zeilen aus den Wortpositionen selbst zusammen, kombiniert zwei Lesedurchgänge und rechnet Summen, Mengen und Steuerzeilen nach. Bei einer falsch gelesenen Ziffer schlägt sie die Korrektur vor.','Verlesene Produktnamen gleicht die App mit deinen früheren Belegen ab. Neu: Knopf „Drehen und neu lesen“.','Automatische Sicherheitskopie: Die letzten drei Stände liegen unter „Mehr → Backup & Daten“.','Neu zum Einschalten unter „Mehr“: Kassensturz (Kontostand eintragen und sehen, was nicht erfasst ist) und Rücklagen (Töpfe für Unregelmäßiges).','Jahresrückblick unter „Verlauf“: Ausgaben, Kategorien im Vergleich zum Vorjahr, Händler und Produkte mit den höchsten Ausgaben.'],'2.7.1':['Bessere Fotos: Tisch oder Stoff neben dem Bon stören die Erkennung nicht mehr.','Bons, bei denen der Artikelname unter dem Preis steht, werden richtig zugeordnet.','Summen- und Steuerzeilen werden sicherer erkannt, auch bei Lesefehlern wie „gesant“ oder „EC-Cash mit PIN“.'],'2.7.0':['GiroCode auf Rechnungen: Die App liest den QR-Code für die Überweisung. Betrag und Empfänger stimmen damit sicher.','Kassen-Code auf Bons: Viele Kassenbons haben einen QR-Code der Kasse. Daraus übernimmt die App Summe, Datum und ob bar oder mit Karte bezahlt wurde.'],'2.6.1':['Rechnungen mit Tabelle (Menge, MwSt., Einzelpreis, Gesamt) wie vom REWE-Lieferservice werden vollständig gelesen.','Schlecht lesbare Preise wie „798€“ werden über Menge × Einzelpreis und die Belegsumme geprüft. Was sich nicht bestätigen lässt, ist gelb markiert.','Mehrere Screenshots einer langen Rechnung lassen sich zu einem Beleg zusammenfügen.','Pfand-Rückgaben werden abgezogen, Zahlungs- und Bankzeilen nicht mehr als Produkte gezählt.'],'2.6.0':['Mehrere Belege auf einmal: Fotos oder PDFs zusammen auswählen oder teilen, die App arbeitet sie nacheinander ab.','Steuer: neue Art „Vorsorge (Versicherungen)“ und eine Jahresübersicht, sortiert wie die Steuererklärung (Werbungskosten, Vorsorge, Handwerker, Krankheitskosten).','Bei Versicherungen unter Fixkosten schlägt die App die passende Steuer-Art vor.'],'2.5.0':['Schnelleingabe im Monat und unter „Beleg“: „Kaffee 3,50“ eintippen, fertig. Unbekanntes fragt die App einmal nach.','Planen aufgeräumt: Einnahmen, Fixkosten, Verträge und Sparziele zum Aufklappen, „+ Neu“ gleich oben.','Monat und Mehr kompakter: Details erst beim Antippen.','Kategorien: Name und Farbe änderbar, 24 Farben zur Auswahl.','Kurzbefehl „Schnelleingabe“: lange auf das App-Symbol drücken.'],'2.4.0':['Bessere Bon-Erkennung: Die App schneidet den Bon im Foto automatisch aus und liest ihn bei Bedarf zweimal.','Tankstellen-Bons wie von Aral werden erkannt.','PDF-Rechnungen öffnen, auch über „Teilen“ aus der Mail-App.','Netto-Rechnungen: MwSt. wird automatisch auf die Positionen verteilt.','Offene Rechnungen mit Zahlungsziel und Erinnerung.','Neue Steuer-Arten: Handwerkerleistungen und Krankheitskosten.','Hinweis, wenn eine Rechnung zu deinen Fixkosten passt.','Wischen nach links oder rechts wechselt zwischen den Reitern.','Kurze Anleitung: einmal beim Start und jederzeit unter „Mehr“, auch zu einzelnen Themen wie Sparzielen.']};
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
  const yd=yearDue();
  if(yd&&!(state.yearExport[yd]&&state.yearExport[yd].done)&&!ui.yearHide) h+=`<div class="note"><b>Jahresabschluss ${yd}:</b> Lade jetzt deinen Jahresexport herunter, mit Jahres-CSV, Steuerliste und Backup.<div class="row" style="margin-top:8px"><button class="primary" data-act="year-go" data-y="${yd}">Zum Jahresexport</button><button class="ghost" data-act="year-later">Später</button></div></div>`;
  const openInv=state.receipts.filter(r=>r.open).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
  if(openInv.length){const op=ui.monOpen==='inv',first=openInv[0];
    h+=`<div class="note ${openInv.some(r=>dueCls(r.due)==='due')?'bad':'warn'} mini"><button class="mini-h" data-act="mon-open" data-sec="inv" aria-expanded="${op}"><span><b>${openInv.length===1?'1 offene Rechnung':openInv.length+' offene Rechnungen'}</b> · ${esc(first.merchant||'Rechnung')} ${dueText(first.due)}</span><span class="chev" aria-hidden="true">›</span></button>
    ${op?`<div class="openlist">${openInv.map(r=>`<div><span>${esc(r.merchant||'Rechnung')} · <b class="num">${fmt(rTotal(r))}</b> · ${r.due?fmtD(r.due)+', ':''}${dueText(r.due)}</span><button data-act="paid" data-id="${r.id}">Bezahlt</button></div>`).join('')}</div>`:''}</div>`}
  const due=contracts().filter(x=>x.c.days<=42);
  if(due.length){const op=ui.monOpen==='kuend',first=due[0];
    h+=`<div class="note ${due.some(x=>x.c.days<=14)?'bad':'warn'} mini"><button class="mini-h" data-act="mon-open" data-sec="kuend" aria-expanded="${op}"><span><b>Kündigungsfrist</b> · ${esc(first.f.name)} bis ${fmtD(first.c.deadline)}${due.length>1?` und ${due.length-1} weitere`:''}</span><span class="chev" aria-hidden="true">›</span></button>
    ${op?`<div class="openlist">${due.map(({f,c})=>`<div><span>${esc(f.name)} · bis ${fmtD(c.deadline)} (${deadlineText(c)})</span></div>`).join('')}<div><button data-act="plan-go" data-sec="vertraege">Verträge ansehen</button></div></div>`:''}</div>`}
  if(hasEx) h+=`<div class="note warn"><b>Das sind Beispieldaten.</b> Sie zeigen, wie die App gefüllt aussieht.<div class="row" style="margin-top:8px"><button data-act="remove-examples">Beispieldaten entfernen</button></div></div>`;
  if(state.useBudgets){
    const warn=cats.filter(([id,v])=>{const b=+state.budgets[id]||0;return b>0&&v>=b*.8});
    if(warn.length) h+=`<div class="note ${warn.some(([id,v])=>v>+state.budgets[id])?'bad':'warn'}" role="status"><b>Budget-Hinweis:</b> ${warn.map(([id,v])=>`${esc(cat(id).name)} ${Math.round(v/state.budgets[id]*100)} %`).join(' · ')}</div>`;
  }
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
function goalForm(e,pot){
  const W=pot?'Rücklage':'Sparziel';
  return `<form class="form inpanel" id="goal-form" autocomplete="off">
    <b class="full">${e?W+' bearbeiten':(pot?'Neue Rücklage':'Neues Sparziel')}</b>
    <label class="f full" for="g-name">Name<input id="g-name" value="${esc(e?e.name:'')}" placeholder="${pot?'z. B. Auto, Geschenke, Nachzahlungen':'z. B. Notgroschen'}"></label>
    <label class="f" for="g-target">Zielbetrag (optional)<input id="g-target" inputmode="decimal" value="${e&&e.target?fmtIn(e.target):''}" placeholder="1.500,00" style="font-family:var(--f-mono)"></label>
    ${pot?'':`<label class="f" for="g-due">Ziel bis (optional)<input id="g-due" type="month" value="${esc(e?e.due||'':'')}"></label>`}
    <label class="f" for="g-rate">${pot?'Betrag pro Monat':'Sparrate pro Monat'}<input id="g-rate" inputmode="decimal" value="${e&&rateFor(e,thisYM())?fmtIn(rateFor(e,thisYM())):''}" placeholder="0,00" style="font-family:var(--f-mono)"></label>
    ${e?'':`<label class="f" for="g-start">Startguthaben (optional, schon vorhandenes Geld)<input id="g-start" inputmode="decimal" placeholder="0,00" style="font-family:var(--f-mono)"></label>`}
    <p class="muted small full" style="margin:0">${pot?'Der Betrag fließt ab diesem Monat jeden Monat in die Rücklage und verringert dein „Übrig“. Zahlst du später einen Beleg aus der Rücklage, belastet er den Monat nicht.':'Die Sparrate zählt ab diesem Monat jeden Monat automatisch und verringert dein „Übrig“.'}</p>
    ${ui.err?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
    <div class="row full"><button class="primary" type="submit">${e?'Änderung speichern':W+' anlegen'}</button><button type="button" data-act="goal-cancel">Abbrechen</button></div></form>`;
}
function vGoals(pot){
  pot=!!pot;const list=state.goals.filter(g=>!!g.pot===pot);
  const e=ui.goalEdit&&list.find(g=>g.id===ui.goalEdit);
  let h=(e||ui.goalNew===(pot?'pot':'goal'))?goalForm(e,pot):`<button class="addbtn" data-act="goal-new" data-pot="${pot?1:''}">+ ${pot?'Neue Rücklage':'Neues Sparziel'}</button>`;
  if(!list.length) return h+`<p class="muted small" style="margin:8px 2px 0">${pot?'Noch keine Rücklage. Rücklagen sind Töpfe für Unregelmäßiges wie Autoreparatur, Geschenke oder Nachzahlungen.':'Noch kein Sparziel, z. B. „Notgroschen“ oder „Urlaub“.'}</p>`;
  h+=`<div class="sublist">${list.map(g=>{const i=goalInfo(g),open=ui.goalOpen===g.id;
    const deps=state.deposits.filter(d=>d.goalId===g.id).sort((a,b)=>b.date.localeCompare(a.date));
    const lines=[];
    if(i.rate>0)lines.push(`${pot?'':'Sparrate '}${fmt(i.rate)} / Monat`);else lines.push(pot?'kein Monatsbetrag':'keine Sparrate');
    if(pot){const used=state.receipts.filter(r=>r.pot===g.id).reduce((a,r)=>a+rTotal(r),0);if(used>0)lines.push(`bisher ${fmt(used)} daraus bezahlt`)}
    if(i.done&&!pot)lines.push('<b style="color:var(--ok)">Ziel erreicht</b>');
    else{if(i.need!=null)lines.push(`für ${ymShort(g.due)} nötig: ${fmt(i.need)} / Monat`);else if(g.due)lines.push(`Ziel ${ymShort(g.due)}`);
      if(i.eta)lines.push(`mit aktueller Rate erreicht im ${ymLabel(i.eta)}`)}
    const df=ui.depositFor===g.id;
    return `<div class="goal"><button class="fr-h" data-act="goal-toggle" data-id="${g.id}" aria-expanded="${open}"><span class="t"><span class="nm">${esc(g.name)}</span>${g.example?' <span class="tag ex">Beispiel</span>':''}${i.done&&!pot?' <span class="tag ret">erreicht</span>':''}</span>
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
  h+=accHead('sparziele',o==='sparziele','Sparziele',fmt(gTotal),GL.length?`${n(GL.length,'Ziel','Ziele')}${gRate?` · ${fmt(gRate)} / Monat`:''}`:'noch keins','plan-open');
  if(o==='sparziele')h+=`<div class="acc-p">${vGoals(false)}</div>`;
  if(state.prefs.pots||PL.length){h+=accHead('ruecklagen',o==='ruecklagen','Rücklagen',PL.length?fmt(pTotal):null,PL.length?`${n(PL.length,'Topf','Töpfe')}${pRate?` · ${fmt(pRate)} / Monat`:''}`:'noch keine','plan-open');
  if(o==='ruecklagen')h+=`<div class="acc-p">${vGoals(true)}</div>`}
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
function vMehr(){
  const mers=Object.entries(state.rules.merchants).sort((a,b)=>a[0].localeCompare(b[0]));
  const o=ui.moreOpen,sec=(id,title,sub,html)=>accHead(id,o===id,title,null,sub,'more-open')+(o===id?`<div class="acc-p">${html()}</div>`:'');
  const tx=taxYear(ui.taxYear),nB=Object.values(state.budgets).filter(v=>+v>0).length;
  const lb=state.lastBackup?Math.floor((Date.now()-state.lastBackup)/864e5):null;
  let h='';
  if(ui.flash) h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;
  if(!ui.installed&&ui.installEvt) h+=`<div class="note"><b>Als App installieren</b><p class="small" style="margin:4px 0 8px">Dann startet Kassensturz vom Startbildschirm, ohne Browserleiste und auch offline.</p><button class="primary" data-act="install">App installieren</button></div>`;
  h+=`<h2>Mehr</h2><div class="acc">`;
  h+=sec('anleitung','Anleitung','Kurze Tour und 10 Themen',()=>noH2(vGuide()));
  h+=sec('steuer','Steuer & Jahresexport',`${ui.taxYear}: ${fmt(tx.total)} absetzbar`,()=>noH2(vTaxYear()));
  h+=sec('sperre','App-Sperre',getLock()?'an':'aus',()=>noH2(vLockSettings()));
  h+=sec('budgets','Budgets',state.useBudgets?`an · ${nB} ${nB===1?'Budget':'Budgets'}`:'aus',()=>`<div class="box"><label class="check"><input id="use-budgets" type="checkbox"${state.useBudgets?' checked':''}> Monatsbudgets verwenden</label>
    ${state.useBudgets?`<p class="muted small" style="margin:0">Leer lassen = kein Budget. Ab 80 % warnt die App, über 100 % wird es rot.</p><div class="list">${state.categories.map(c=>`<div class="rule" style="grid-template-columns:minmax(0,1fr) 8em"><span><i class="dot" style="--c:${c.color}"></i> ${esc(c.name)}</span><input id="bud-${c.id}" data-budget="${c.id}" inputmode="decimal" value="${+state.budgets[c.id]>0?fmtIn(state.budgets[c.id]):''}" placeholder="–" aria-label="Budget ${esc(c.name)}"></div>`).join('')}</div>`:''}</div>`);
  h+=sec('kasse','Kassensturz',state.prefs.kasse?'an':'aus',()=>`<div class="box"><label class="check"><input id="use-kasse" type="checkbox"${state.prefs.kasse?' checked':''}> Kassensturz verwenden</label>
    <p class="muted small" style="margin:0">Du trägst einmal im Monat deinen Kontostand ein. Die App vergleicht ihn mit Einnahmen und erfassten Ausgaben und zeigt, wie viel Geld du nicht erfasst hast. Die Eingabe erscheint dann im Reiter „Monat“.</p>
    ${state.prefs.kasse?`<label class="f" for="kasse-tol" style="max-width:16em">Rückfragen ab einer Differenz von<input id="kasse-tol" inputmode="decimal" value="${fmtIn(kasseTol())}" style="font-family:var(--f-mono)"></label><p class="muted small" style="margin:0">Ab diesem Betrag fragt die App nach Bargeld und vergessenen Einträgen. Standard: 10,00 €.</p>`:''}</div>`);
  {const nP=state.goals.filter(g=>g.pot).length;
  h+=sec('pots','Rücklagen',state.prefs.pots?`an${nP?` · ${nP} ${nP===1?'Topf':'Töpfe'}`:''}`:(nP?`aus · ${nP} ${nP===1?'Topf':'Töpfe'} vorhanden`:'aus'),()=>`<div class="box"><label class="check"><input id="use-pots" type="checkbox"${state.prefs.pots?' checked':''}> Rücklagen verwenden</label>
    <p class="muted small" style="margin:0">Rücklagen sind Töpfe für Unregelmäßiges wie Autoreparatur, Geschenke oder Nachzahlungen. Jeden Monat fließt ein fester Betrag hinein und verringert dein „Übrig“. Einen Beleg kannst du dann „aus der Rücklage“ bezahlen, er belastet den Monat nicht. Du legst sie unter „Planen“ an.</p>
    ${!state.prefs.pots&&nP?`<p class="small" style="margin:0;color:var(--warn);font-weight:600">Deine ${nP===1?'Rücklage zählt':nP+' Rücklagen zählen'} weiter, bis du sie unter „Planen“ löschst.</p>`:''}</div>`)}
  h+=sec('kategorien','Kategorien',`${state.categories.length} Kategorien`,catPanel);
  h+=sec('gelernt','Gelernte Zuordnungen',`${Object.keys(state.rules.products).length} Produkte · ${mers.length} Händler`,()=>`<p class="muted small" style="margin:0 2px 8px">Beim Speichern merkt sich die App Produkt und Kategorie. Hier korrigierst du Fehler.</p>
    <label class="f" for="rule-filter">Produkte durchsuchen<input id="rule-filter" value="${esc(ui.ruleFilter)}" placeholder="z. B. Milch"></label>
    <div id="prod-list">${prodList()}</div><h3>Händler (${mers.length})</h3>`+(mers.length?`<div class="list">${mers.map(([k,m])=>`<div class="rule"><span class="k">${esc(k)}${m.always?' <span class="tag">immer</span>':''}</span>
    <select id="rm-${esc(k)}" data-rule="m" data-key="${esc(k)}" aria-label="Kategorie für ${esc(k)}">${catOpts(m.cat)}</select>
    <button class="icon ghost danger" data-act="rdel" data-type="m" data-key="${esc(k)}" aria-label="Regel löschen">×</button></div>`).join('')}</div>`:`<div class="list"><div class="empty">Noch keine Händler gespeichert.</div></div>`));
  h+=sec('export','Export für Excel','CSV-Dateien',()=>`<p class="muted small" style="margin:0 2px 8px">Mit Semikolon und Komma-Beträgen, öffnen direkt in Excel.</p>
    <div class="row"><button data-act="csv-items">Alle Belegpositionen</button><button data-act="csv-months">Monatsübersicht</button><button data-act="csv-fixed">Planung</button></div>`);
  h+=sec('backup','Backup & Daten',lb==null?'noch kein Backup':lb===0?'letztes Backup heute':`letztes Backup vor ${lb} ${lb===1?'Tag':'Tagen'}`,()=>`<p class="muted">Deine Daten liegen nur auf diesem Handy. Lade ab und zu ein Backup herunter und leg es z. B. in Google Drive ab.${persistGranted?' Der Browser hat dauerhaften Speicher zugesagt.':''}</p>
  <div class="box">
    ${cryptoOk?`<p class="small" style="margin:0">Mit Passwort ist die Datei verschlüsselt. Ohne das Passwort kann sie niemand lesen, auch du nicht. Notiere es dir gut.</p>
    <label class="f" for="bk-pw">Backup-Passwort (mind. 8 Zeichen)<input id="bk-pw" type="password" autocomplete="new-password"></label>
    <label class="f" for="bk-pw2">Passwort wiederholen<input id="bk-pw2" type="password" autocomplete="new-password"></label>
    <label class="check small"><input id="bk-plain" type="checkbox"${ui.plainBackup?' checked':''}> Ohne Passwort sichern (nicht empfohlen)</label>`
    :`<p class="small" style="margin:0">Verschlüsselte Backups gehen nur, wenn die App über https geöffnet ist (z. B. GitHub Pages).</p>`}
    <div class="row"><button class="primary" data-act="backup-file">Backup herunterladen</button><button data-act="export">Als Text anzeigen</button></div>
    <p id="bk-err" class="err" role="alert" style="margin:0">${esc(ui.backupErr)}</p>
  </div>
  ${ui.exportText?`<label class="f" for="export-text" style="margin-top:10px">Backup-Text${ui.exportEnc?' (verschlüsselt)':' (unverschlüsselt)'}<textarea id="export-text" rows="4" readonly>${esc(ui.exportText)}</textarea></label>
  <div class="row" style="margin-top:8px"><button data-act="copy">Kopieren</button><span id="copy-msg" class="small muted"></span></div>`:''}
  ${snapHtml()}
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
    {t:'Planen',x:'Unter „Planen“ siehst du Einnahmen, Fixkosten, Verträge und Sparziele mit ihren Summen. Tippe einen Bereich an, um ihn aufzuklappen und Einträge hinzuzufügen.',a:'plan'},
    {t:'Der Monat auf einen Blick',x:'„Monat“ zeigt Einnahmen, Ausgaben und was übrig bleibt, nach Kategorien als Balken oder Kuchen. Mit den Pfeilen oben wechselst du den Monat, durch Wischen nach links oder rechts den Reiter.',a:'pie'},
    {t:'Deine Daten sichern',x:'Alles liegt nur auf diesem Handy. Lade unter „Mehr“ ab und zu ein Backup herunter, am besten mit Passwort.',a:'backup'},
    {t:'Bereit',x:'Mit den Beispieldaten kannst du dich in Ruhe umsehen und sie entfernen, sobald du startest. Diese Anleitung findest du jederzeit unter „Mehr“.',a:'done'}]},
  beleg:{title:'Ausgaben und Belege erfassen',goto:'beleg',steps:[
    {t:'Schnelleingabe',x:'Tippe oben im Monat oder unter „Beleg“ etwa „Kaffee 3,50“ ein und bestätige. Das Datum ist immer heute. Kennt die App das Wort noch nicht, fragt sie einmal nach der Kategorie.',a:'learn'},
    {t:'Fotos oder PDFs',x:'Tippe unter „Beleg“ auf „Fotos, Screenshots oder PDFs wählen“. Du kannst mehrere auf einmal auswählen, die App zeigt sie nacheinander zum Prüfen. Aus Galerie oder Mail geht es auch über „Teilen → Kassensturz“.',a:'receipt'},
    {t:'Prüfen und speichern',x:'Die App zeigt Händler, Datum und Positionen. Passt die Summe nicht zum Bon, siehst du einen Hinweis und gleichst ihn mit „Differenz als Position“ oder „Nur Gesamtbetrag verwenden“ aus.',a:'pdf'},
    {t:'Ohne Bon',x:'Mit „Ohne Bon eintragen“ erfasst du Ausgaben von Hand. Text aus Google Lens fügst du ins Textfeld ein und tippst auf „Text auswerten“.',a:'learn'},
    {t:'Nochmal und Vorlagen',x:'Kaufst du etwas öfter, etwa ein Ticket: Beleg im Monat antippen und „Nochmal erfassen“. Oder ihn „Als Vorlage merken“, dann liegt er unter „Beleg“ ganz oben als Knopf.',a:'repeat'},
    {t:'Retouren',x:'Schickst du etwas zurück, öffne den Originalbeleg und tippe auf „Retoure erfassen“. Der Betrag wird von den Ausgaben abgezogen.',a:'repeat'}]},
  kategorien:{title:'Kategorien und Lernen',goto:'mehr',anchor:'kategorien',steps:[
    {t:'Automatisch zuordnen',x:'Jede Position bekommt eine Kategorie: über den Händler (Zalando → Kleidung), über Stichwörter (Milch → Essen) oder über das, was du der App beigebracht hast.',a:'cats'},
    {t:'Unbekannte Produkte',x:'Gelb markierte Positionen kennt die App noch nicht. Wähle einmal die Kategorie, beim Speichern merkt sie sich das.',a:'learn'},
    {t:'Ganzer Händler',x:'Mit dem Haken „Bei … immer … verwenden“ landet alles von diesem Händler in einer Kategorie.',a:'cats'},
    {t:'Namen und Farben',x:'Unter „Mehr → Kategorien“ tippst du eine Kategorie an und änderst Namen oder Farbe. Dort legst du auch eigene Kategorien an.',a:'cats'},
    {t:'Korrigieren',x:'Unter „Mehr → Gelernte Zuordnungen“ siehst und änderst du alles, was die App gelernt hat.',a:'learn'}]},
  fix:{title:'Einnahmen und Fixkosten',goto:'fixkosten',anchor:'fix',steps:[
    {t:'Einmal eintragen',x:'Unter „Planen“ tippst du auf „Einnahmen“ oder „Fixkosten“. Ganz oben steht „+ Neue …“. Einmal eingetragen, zählen Gehalt, Miete oder Abos jeden Monat automatisch.',a:'plan'},
    {t:'Rhythmus',x:'Wähle monatlich, vierteljährlich, halbjährlich oder jährlich. Jährliche Beträge rechnet die App auf den Monat um: 60 € Haftpflicht im Jahr sind 5 € pro Monat.',a:'plan'},
    {t:'Start und Ende',x:'Mit „Ab Monat“ und „Bis Monat“ zählt ein Eintrag nur in diesem Zeitraum. „Einmalig“ zählt nur im gewählten Monat, etwa ein Bonus.',a:'plan'},
    {t:'Was übrig bleibt',x:'Einnahmen minus Fixkosten, Belege und Sparrate ergibt im Monat „Übrig“, also das, was du noch frei ausgeben kannst.',a:'pie'}]},
  vertraege:{title:'Verträge und Kündigungsfristen',goto:'fixkosten',anchor:'vertraege',steps:[
    {t:'Vertrag anlegen',x:'Tippe unter „Planen → Fixkosten“ einen Eintrag an, dann „Bearbeiten“ und „Vertrag & Kündigung“. Trage ein, wann die Mindestlaufzeit endet, die Kündigungsfrist und die Verlängerung.',a:'contract'},
    {t:'Die App rechnet',x:'Daraus berechnet sie den letzten Tag, an dem du noch kündigen kannst. Verlängert sich der Vertrag, rechnet sie automatisch weiter.',a:'contract'},
    {t:'Rechtzeitig erinnert',x:'Ab 6 Wochen vor der Frist erscheint im Monat ein Hinweis, ab 2 Wochen in Rot. Alle Fristen stehen unter „Planen → Verträge“.',a:'contract'}]},
  sparen:{title:'Sparziele und Sparrate',goto:'fixkosten',anchor:'sparziele',steps:[
    {t:'Sparziel anlegen',x:'Unter „Planen“ tippst du auf „Sparziele“ und dann ganz oben auf „+ Neues Sparziel“. Gib einen Namen ein, etwa „Urlaub“, und optional Zielbetrag und Datum.',a:'goal'},
    {t:'Die Sparrate',x:'Die Sparrate ist der Betrag, den du jeden Monat zurücklegst. Sie wird ab dem aktuellen Monat automatisch gutgeschrieben. Änderst du sie, gilt die neue Rate ab diesem Monat.',a:'goal'},
    {t:'Ein- und auszahlen',x:'Tippe ein Sparziel an. Mit „+ Einzahlen“ buchst du Extra-Beträge, etwa Weihnachtsgeld. Mit „− Entnehmen“ nimmst du Geld heraus, zum Beispiel wenn du den Urlaub bezahlst. Ein Startguthaben gibst du beim Anlegen an.',a:'goal'},
    {t:'Fortschritt',x:'Die App zeigt deinen Stand, wie viel du pro Monat brauchst, um das Ziel rechtzeitig zu erreichen, und wann du es mit der aktuellen Rate schaffst.',a:'goal'},
    {t:'Warum „Übrig“ kleiner wird',x:'Gespartes ist keine Ausgabe, aber auch nicht mehr frei verfügbar. Deshalb zieht die App die Sparrate von „Übrig“ ab. Ist ein Ziel erreicht, kannst du die Rate mit einem Tipp beenden.',a:'pie'}]},
  budgets:{title:'Budgets',goto:'mehr',anchor:'budgets',steps:[
    {t:'Einschalten',x:'Unter „Mehr → Budgets“ schaltest du Monatsbudgets ein und trägst pro Kategorie einen Betrag ein, etwa 300 € für Essen.',a:'budget'},
    {t:'Rechtzeitig gewarnt',x:'Im Monat zeigt jede Kategorie, wie viel noch übrig ist. Ab 80 % wird sie gelb, über 100 % rot, und oben erscheint ein Hinweis.',a:'budget'},
    {t:'Balken oder Kuchen',x:'Budgets siehst du in der Balkenansicht. Der Kuchen zeigt dafür die Anteile der Kategorien.',a:'pie'}]},
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
    {t:'Suchen',x:'Die Suche findet Positionen in allen Belegen und rechnet die Treffer zusammen, etwa: Wie viel habe ich dieses Jahr für Kaffee ausgegeben?',a:'learn'}]},
  sicherheit:{title:'Backup, Sperre und Updates',goto:'mehr',anchor:'backup',steps:[
    {t:'Nur auf dem Handy',x:'Alle Daten liegen ausschließlich auf diesem Handy. Löschst du die App oder die Browserdaten, sind sie weg.',a:'welcome'},
    {t:'Backup',x:'Unter „Mehr → Backup“ lädst du eine Sicherung herunter, am besten mit Passwort verschlüsselt, und legst sie etwa in Google Drive ab. Ohne das Passwort lässt sie sich nicht öffnen.',a:'backup'},
    {t:'App-Sperre',x:'Mit einer PIN unter „Mehr → App-Sperre“ fragt die App beim Start und nach 1 Minute im Hintergrund nach der PIN.',a:'lock'},
    {t:'Updates',x:'Gibt es eine neue Version, erscheint oben „Neue Version verfügbar“. Ein Tipp auf „Jetzt laden“ genügt, deine Daten bleiben erhalten.',a:'update'}]}
};
const TUT_ORDER=['beleg','kategorien','fix','vertraege','sparen','budgets','rechnungen','steuer','verlauf','sicherheit'];
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

/* ---------- Rendern ---------- */
const main=document.getElementById('main');
const header=document.querySelector('header');
const TABS=['monat','beleg','fixkosten','verlauf','mehr'];
function render(){
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
    case 'del-row':if(ui.draft)ui.draft.fix=null;d.items.splice(i,1);if(!d.items.length)d.items.push({name:'',amount:'',cat:'',src:'',flag:true});render();break;
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
    case 'queue-stop':ui.queue=[];ui.err='';if(!ui.draft&&!ui.ocr)queueNext();else render();break;
    case 'jump':{ev.preventDefault();const n=document.getElementById(b.dataset.to);if(n)n.scrollIntoView({block:'start'});break}
    case 'goal-new':ui.goalNew=b.dataset.pot?'pot':'goal';ui.goalEdit=null;ui.depositFor=null;ui.err='';render();focusForm('g-name');break;
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
  if(t.id==='use-kasse'){state.prefs.kasse=t.checked;persist();render();return}
  if(t.id==='kasse-tol'){const v=t.value.trim()?toNum(t.value):10;if(!isNaN(v)&&v>=0){state.prefs.kasseTol=r2(v);persist()}t.value=fmtIn(kasseTol());return}
  if(t.id==='use-pots'){state.prefs.pots=t.checked;persist();render();return}
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
    const isPot=ui.goalNew==='pot';if(!name){ui.err='Bitte gib einen Namen an.';render();return}
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
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('./sw.js').catch(()=>{})}

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
ui.locked=!!getLock();
{const q=new URLSearchParams(location.search);const a=q.get('action');
  if(a==='photo'||a==='text'){ui.action=a;history.replaceState(null,'',location.pathname+'#beleg')}
  if(a==='quick'){ui.action='quick';history.replaceState(null,'',location.pathname+'#monat')}}
route();
maybeTutorial();
function focusAction(){if(!ui.action||ui.locked||ui.tut)return;const n=document.getElementById(ui.action==='photo'?'photo-btn':ui.action==='quick'?'quick':'bon-text');if(n)n.focus();if(ui.action==='quick')ui.action=''}
focusAction();
checkShared();
loadSnaps();
})();
