(function(){
'use strict';
const KEY='kassensturz-v1';
const APP_VERSION='2.4.0'; // zusammen mit version.json und sw.js hochzählen
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
  essen:{c:['MILCH','BROT','BRÖTCH','BROETCH','KÄSE','KAESE','GOUDA','BUTTER','JOGH','QUARK','SAHNE','EIER','BANANE','APFEL','ÄPFEL','TOMATE','GURKE','PAPRIKA','KARTOFF','ZWIEBEL','SALAT','NUDEL','SPAGH','PASTA','MEHL','ZUCKER','HÄHNCH','HAEHNCH','HACKFL','WURST','SCHINKEN','SALAMI','LACHS','THUNF','PIZZA','MÜSLI','MUESLI','SCHOKO','CHIPS','KEKS','KAFFEE','WASSER','SPRUDEL','SAFT','COLA','FANTA','SPRITE','LIMO','BIER','WEIN','SEKT','RADLER','MATE','PFAND','OBST','GEMÜSE','GEMUESE','BAGUETTE','CROISS','MARMEL','NUTELLA','HONIG','KETCHUP','MAYO','SOSSE','SAUCE','TOFU','HAFER','STUDENTENF','NÜSSE','NUESSE','BREZ','KUCHEN','TIEFKÜHL','ERDBEER','TRAUBE','ORANGE','ZITRONE','BEERE','MÖHRE','KAROTTE','BROKKOLI','AVOCADO','JOGURT','TIRAMISU','BURGER','DÖNER','DOENER','SCHNITZEL','ESPRESSO','CAPPUCC','LATTE','MENÜ','MENUE','GERICHT','SUPPE','POMMES','LAKRITZ','GUMMIB','BONBON','SNACK','ENERGY','EISTEE','SCHORLE','KEBAB','SUSHI','DESSERT','PANNA','FRAICHE','FRAÎCHE','SCHLAGSAHNE'],w:['TEE','REIS','ÖL','OEL','EI','SALZ','EIS','MAIS']},
  drogerie:{c:['SHAMPOO','DUSCH','ZAHNPASTA','ZAHNCREME','ZAHNBÜRSTE','ZAHNP','ZAHNB','ZAHNC','ZAHNS','DEO','SEIFE','CREME','TOILETTENP','KLOPAP','KÜCHENR','KUECHENR','TASCHENT','SPÜLM','SPUELM','SPÜLT','WASCHM','WASCHP','WEICHSP','REINIG','MÜLLB','MUELLB','SCHWAMM','RASIER','WATTE','KOSMET','MASCARA','LIPP','TAMPON','BINDEN','WINDEL','ALUFOL','FRISCHHALT','BACKPAP','KERZE','BATTERIE','HAARGEL','SPÜLUNG','SPUELUNG','BALEA','NIVEA','ELKOS'],w:[]},
  kleidung:{c:['SHIRT','HEMD','HOSE','JEANS','PULLI','PULLOVER','HOODIE','JACKE','MANTEL','SOCKE','STRUMPF','UNTERHOSE','BOXER','KLEID','SCHUH','SNEAKER','STIEFEL','SANDAL','MÜTZE','MUETZE','SCHAL','GÜRTEL','GUERTEL','BLUSE','LEGGINGS','SHORTS','AIR MAX','SWEATSHIRT','CHINO'],w:['ROCK','TOP','BH']},
  freizeit:{c:['TICKET','KINO','EINTRITT','SPIEL','LEGO','BUCH','KONZERT','BOWLING','FESTIVAL','MUSEUM','KLETTER','POPCORN'],w:[]},
  gesund:{c:['IBUPROF','PARACET','ASPIRIN','PFLASTER','VITAMIN','NASENSPR','TABLETT','MAGNESIUM'],w:[]},
  technik:{c:['KABEL','LADEGER','USB','HDMI','KOPFHÖR','KOPFHOER','TASTATUR','AKKU','ADAPTER','SPEICHERK','POWERBANK','HÜLLE','PANZERGLAS'],w:['MAUS']},
  mobil:{c:['DIESEL','BENZIN','SUPER E','FAHRKARTE','PARKEN','PARKHAUS','PARKSCHEIN'],w:[]}
};

/* ---------- Speicher ---------- */
let storageOk=true;
function load(){try{const s=localStorage.getItem(KEY);return s?JSON.parse(s):null}catch(e){storageOk=false;return null}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true}catch(e){storageOk=false}requestPersist()}
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
  return s;
}
let state=migrate(load()||seed());

const ui={tab:'monat',ym:thisYM(),draft:null,paste:'',open:null,confirmDel:null,confirmCat:null,
  fixedEdit:null,fixedKind:'out',ruleFilter:'',search:'',chartCat:'',flash:'',exportText:'',importMsg:'',confirmClear:false,
  err:'',dup:null,dupOk:false,ocr:null,photoUrl:null,installEvt:null,installed:false,
  locked:false,lockFails:0,lockUntil:0,lockErr:'',lockMsg:'',forgot:0,hiddenAt:0,
  plainBackup:false,backupErr:'',exportEnc:false,pendingImport:null,pendingEnc:false,
  goalEdit:null,goalNew:false,depositFor:null,depositSign:1,confirmGoal:null,taxYear:+thisYM().slice(0,4),yearHide:false,action:'',
  tplEdit:false,pieSel:null,pieSel2:null,updateAvail:null};

const cat=id=>state.categories.find(c=>c.id===id)||{id:'sonstiges',name:'Sonstiges',color:'#8e95a3'};
const catOpts=(sel,placeholder)=>(placeholder?`<option value="">${placeholder}</option>`:'')+
  state.categories.map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${esc(c.name)}</option>`).join('');
const rTotal=r=>r.items.reduce((s,i)=>s+(+i.amount||0),0);
const INTERVALS={0:'einmalig',1:'monatlich',3:'vierteljährlich',6:'halbjährlich',12:'jährlich'};
const activeIn=(f,ym)=>f.interval===0?f.start===ym:((!f.start||f.start<=ym)&&(!f.end||f.end>=ym));
const shareOf=f=>f.interval===0?f.amount:f.amount/(f.interval||1);

/* Steuer */
const TAXKINDS={arbeitsmittel:'Arbeitsmittel',fachliteratur:'Fachliteratur',fortbildung:'Fortbildung',sonstiges:'Sonstige Werbungskosten',handwerker:'Handwerkerleistungen (Arbeitskosten)',krankheit:'Krankheitskosten'};
const taxOpts=sel=>`<option value="">nicht absetzbar</option>`+Object.entries(TAXKINDS).map(([k,v])=>`<option value="${k}"${k===sel?' selected':''}>§ ${v}</option>`).join('');
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
  const rs=(g.rates||[]).map(r=>r.from).sort();if(rs.length){for(let m=rs[0];m<=upTo;m=addMonths(m,1))sum+=rateFor(g,m)}
  return r2(sum);
}
function savedIn(ym){
  let s=0;state.goals.forEach(g=>s+=rateFor(g,ym));
  state.deposits.forEach(d=>{if(d.date.startsWith(ym))s+=+d.amount||0});return r2(s);
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
  return {rs,inc,fixOut,varOut,out:fixOut+varOut,by,saved};
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

const SKIP=/(summe|gesamt|zu zahlen|\btotal\b|endbetrag|rechnungsbetrag|zahlbetrag|mwst|\bust\b|ust-|netto|brutto|steuer|gegeben|geg\.|r(ü|ue)ckgeld|zur(ü|ue)ck|\bbar\b|kartenzahlung|girocard|ec[- ]?karte|visa|mastercard|maestro|paypal|kreditkarte|bon-?nr|beleg|kasse\b|terminal|trace|tse|uhrzeit|datum|steuer-?nr|ust-?id|filiale|tel\.|telefon|fax\b|www\.|\.de\b|vielen dank|kundenbeleg|kundenkarte|payback|punkte|trinkgeld|subtotal|tax\b|vat\b|shipping|versandkosten|^betrag\b|umsatz|autorisier|quittung|kontaktlos|approved|anwendung|zahlbar|f(ä|ae)llig|\biban\b|\bbic\b|kundennummer|kunden-?nr|rechnungsnummer|rechnungs-?nr|bestellnummer|auftragsnummer|abrechnungszeitraum|zzgl|zuz(ü|ue)glich|inkl\.?\s*mwst|enthaltene|bevorratung|zahlungsziel|(ü|ue)berweis|abgebucht|lastschrift|bankverbindung|skonto|entspricht|unktestand|gesammelt|einl(ö|oe)sbar)/i;
const TOTAL=/(summe|gesamtbetrag|gesamtsumme|gesamtpreis|gesamt\b|zu zahlen|endbetrag|rechnungsbetrag|zahlbetrag|bestellsumme|order total|grand total|^total\b|\btotal:|[a-zäöü]{1,4}(amt|ant|arnt)betrag)/i;
const PAYLINE=/(visa|girocard|ec[- ]?karte|mastercard|maestro|kartenzahlung|kreditkarte|paypal|^betrag\b|brutto)/i;
const NOTNAME=/^(verkauft|versand|geliefert|zustell|bestell|deine bestellung|ihre bestellung|menge|anzahl|lieferung|lieferdatum|r(ü|ue)ckgabe|artikel-?nr|art\.?-?nr|artikelnummer|preis|eur$|euro$|stk|gr(ö|oe)(ß|ss)e|farbe|variante|size|colou?r|qty|quantity|sold by|ships|delivered|arriving|order|einzelpreis|pos\.?\s|position\s|bezeichnung)/i;
const QTY=/^\s*\d+([.,]\d+)?\s*(stk\.?|st\.?|kg|g)?\s*[x×*]\s*\d/i;
const DISC=/(rabatt|preisvorteil|coupon|gutschein|nachlass|preisreduz|sofortrabatt|discount)/i;
const DATE_RE=/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
const DGOOD=/(rechnungsdatum|rechnung vom|belegdatum|kaufdatum|bestelldatum|datum|\bvom\b)/i;
const DBAD=/(liefer|leistung|zahlbar|f(ä|ae)llig|\bbis\b|abbuch|abgebucht|zeitraum|g(ü|ue)ltig|mhd|ablauf|geburt|startzeit|beendigung|signatur)/i;
const DUE=/(zahlbar|f(ä|ae)llig|zahlungsziel|(ü|ue)berweis\w*|zahlung\s+bis|bezahlen\s+bis|begleichen)/i;

function findPrice(line){
  let m=line.match(/(?:EUR|€)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+[.,]\d{2})\s*[#*]{0,2}\s*(?:[A-D]|[0-9])?\s*[#*]{0,2}\s*$/i);
  if(m) return {amt:toNum(m[1]),rest:line.slice(0,m.index)};
  // Preis am Zeilenende, danach evtl. Währung und Steuerkennzeichen wie „B“, „1“, „#A*“ oder OCR-Reste wie „EURSA“
  m=line.match(/(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2})(-?)\s*(?:€|EURO|EUR[A-Za-z]{0,3})?\s*[#*]{0,2}\s*(?:[A-D]|[0-9])?\s*[#*]{0,2}\s*$/i);
  if(m){let a=toNum(m[1]);if(m[2]==='-')a=-Math.abs(a);return {amt:a,rest:line.slice(0,m.index)}}
  return null;
}
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
  return n.trim().slice(0,80);
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
function parseReceipt(text){
  // Störzeichen der Texterkennung am Zeilenanfang entfernen („= Betrag“, „- Visa“)
  const lines=text.split(/\r?\n/).map(l=>l.replace(/\t/g,' ').replace(/^[^\p{L}\p{N}*€-]+/u,'').replace(/^[-–]\s+(?=\p{L})/u,'').trim()).filter(Boolean);
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
  const items=[];let pending=null;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(TOTAL.test(line)&&!/zwischen|subtotal/i.test(line)){
      let p=findPrice(line);
      if(!p&&lines[i+1]){const q=findPrice(lines[i+1]);if(q&&letters(q.rest)===0)p=q}
      if(p&&p.amt>0){if(/netto/i.test(line))netAmt=p.amt;else{total=p.amt;vote(p.amt,3)}}
      pending=null;continue;
    }
    // Zahlungs- und Steuerzeilen: Betrag merken, aber nicht als Position
    const amts=(line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}/g)||[]).map(toNum);
    if(/%/.test(line)&&amts.length>=3){vote(amts[amts.length-1],1);pending=null;continue}
    if(/netto/i.test(line)&&amts.length&&!/%/.test(line))netAmt=amts[amts.length-1];
    if(/(mwst|umsatzsteuer|ust\b)/i.test(line)&&amts.length===1&&/zzgl|\+|zuz/i.test(line))vatAmt=amts[0];
    if(PAYLINE.test(line)&&amts.length){vote(amts[amts.length-1],1);pending=null;continue}
    if(QTY.test(line)) continue;
    if(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(line)||/^[A-D]\s*[:=]/.test(line)) continue;
    const disc=DISC.test(line);
    if(SKIP.test(line)&&!disc){pending=null;continue}
    const p=findPrice(line);
    if(!p){if(letters(line)>=3&&!NOTNAME.test(line))pending=line;continue}
    let name=cleanName(p.rest);
    if(disc||p.amt<0){
      const a=-Math.abs(p.amt);
      if(items.length) items[items.length-1].amount=r2(items[items.length-1].amount+a);
      else items.push({name:name||'Rabatt',amount:a});
      pending=null;continue;
    }
    if(letters(name)<2||NOTNAME.test(name)){if(pending)name=cleanName(pending);else continue}
    pending=null;
    if(p.amt===0) continue;
    items.push({name,amount:p.amt});
  }
  // Gesamtbetrag per Mehrheit: „Gesamtbetrag“, Kartenzahlung und Brutto-Spalte stimmen ab
  const top=Object.entries(votes).sort((x,y)=>y[1]-x[1]||(+y[0])-(+x[0]))[0];
  if(top&&(total==null||top[1]>(votes[r2(total).toFixed(2)]||0)))total=+top[0];
  const totalVotes=total!=null?(votes[r2(total).toFixed(2)]||0):0;
  // Netto-Rechnung: MwSt. anteilig auf die Positionen verteilen
  let gross=null;const sum=r2(items.reduce((a,x)=>a+x.amount,0));
  if(total!=null&&sum>0&&total-sum>0.01){
    const ratio=total/sum,explicit=/zzgl|zuz(ü|ue)glich|nettobetrag|summe\s*netto|netto\s*summe|gesamt\s*netto|netto\s*gesamt|rechnungsbetrag\s*netto/i.test(text);
    const netOk=netAmt==null||Math.abs(netAmt-sum)<0.05;
    const vatOk=vatAmt==null||Math.abs(sum+vatAmt-total)<0.05;
    if(netOk&&vatOk&&(explicit&&ratio>1.05&&ratio<1.20||Math.abs(ratio-1.19)<0.002||Math.abs(ratio-1.07)<0.002)){
      items.forEach(x=>x.amount=r2(x.amount*ratio));
      const diff=r2(total-items.reduce((a,x)=>a+x.amount,0));
      if(diff){const big=items.reduce((m,x)=>x.amount>m.amount?x:m,items[0]);big.amount=r2(big.amount+diff)}
      gross={net:sum,vat:r2(total-sum)};
    }
  }
  return {merchant,date:dt?dt.iso:'',dateFound:!!dt,total,totalVotes,items,gross,due:findDue(lines,dt&&dt.iso),type:merchantType(merchant)};
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
  const mkItems=list=>list.map(it=>{const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      return {name:it.name,amount:fmtIn(it.amount),cat:c.cat,src:c.src,flag:c.flag,suggest:c.suggest,tax}});
  const sum=r2(items.reduce((a,x)=>a+x.amount,0));
  let collapsed=null;
  // Positionen gehen nicht auf, aber der Laden hat nur eine Kategorie: sicheren Gesamtbetrag nehmen
  if(parsed.total!=null&&Math.abs(sum-parsed.total)>=0.01&&mi.single&&parsed.items.length){
    collapsed=mkItems(items);items=[{name:parsed.merchant||'Einkauf',amount:parsed.total}];
  }
  return {id:null,refund:false,merchant:parsed.merchant,date:parsed.date||today(),dateGuessed:!parsed.dateFound,total:parsed.total,always:false,
    gross:parsed.gross||null,open:!!parsed.due,due:parsed.due||'',fixHint:fx?fx.id:null,collapsed,
    items:items.map(it=>{const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      return {name:it.name,amount:fmtIn(it.amount),cat:c.cat,src:c.src,flag:c.flag,suggest:c.suggest,tax}})};
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
function setProgress(label,p){
  if(!ui.ocr)return;ui.ocr.label=label;if(p!=null)ui.ocr.p=p;
  const l=document.getElementById('ocr-label'),b=document.getElementById('ocr-bar');
  if(l)l.textContent=label;if(b)b.style.width=Math.round((ui.ocr.p||0)*100)+'%';
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
  const lab=new Int32Array(n),stack=new Int32Array(n);let bestN=0,box=null,id=0;
  for(let i=0;i<n;i++){
    if(lab[i]||!ok[i]||g[i]<=th)continue;id++;let sp=0,cnt=0,x0=w,x1=0,y0=h,y1=0;stack[sp++]=i;lab[i]=id;
    while(sp){const k=stack[--sp],px=k%w,py=(k-px)/w;cnt++;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;
      const nb=[px>0?k-1:-1,px<w-1?k+1:-1,py>0?k-w:-1,py<h-1?k+w:-1];
      for(const q of nb)if(q>=0&&!lab[q]&&ok[q]&&g[q]>th){lab[q]=id;stack[sp++]=q}}
    if(cnt>bestN){bestN=cnt;box=[x0,y0,x1,y1]}
  }
  const frac=bestN/n;
  if(!box||frac<0.04||frac>0.97||(box[2]-box[0])<w*0.12||(box[3]-box[1])<h*0.12)return {x:0,y:0,w:W,h:H,cropped:false};
  const m=6,x0=Math.max(0,(box[0]-m)/s),y0=Math.max(0,(box[1]-m)/s),x1=Math.min(W,(box[2]+m+1)/s),y1=Math.min(H,(box[3]+m+1)/s);
  return {x:x0,y:y0,w:x1-x0,h:y1-y0,cropped:true};
}
// Zwei Fassungen für die Texterkennung: Graustufen mit gestrecktem Kontrast und Schwarz-Weiß mit örtlicher Schwelle
function prepVariants(src,W,H){
  const r=findPaper(src,W,H);
  let tw=Math.min(1600,Math.max(r.w,1200));tw=Math.min(tw,r.w*3);
  let th=Math.round(r.h*tw/r.w);
  if(tw*th>5e6){const k=Math.sqrt(5e6/(tw*th));tw=Math.round(tw*k);th=Math.round(th*k)}
  tw=Math.max(1,Math.round(tw));th=Math.max(1,th);
  const c=document.createElement('canvas');c.width=tw;c.height=th;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,tw,th);x.drawImage(src,r.x,r.y,r.w,r.h,0,0,tw,th);
  const img=x.getImageData(0,0,tw,th),d=img.data,n=tw*th,g=new Uint8ClampedArray(n),hist=new Uint32Array(256);
  for(let i=0,j=0;i<n;i++,j+=4){g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;hist[g[i]]++}
  let lo=0,hi=255,acc=0;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=n*0.02){lo=t;break}}
  acc=0;for(let t=255;t>=0;t--){acc+=hist[t];if(acc>=n*0.02){hi=t;break}}
  const span=Math.max(1,hi-lo);for(let i=0;i<n;i++)g[i]=(g[i]-lo)*255/span;
  for(let i=0,j=0;i<n;i++,j+=4){d[j]=d[j+1]=d[j+2]=g[i];d[j+3]=255}
  x.putImageData(img,0,0);
  const bw=document.createElement('canvas');bw.width=tw;bw.height=th;const bx=bw.getContext('2d');const bi=bx.createImageData(tw,th),bd=bi.data;
  const W1=tw+1,ii=new Uint32Array(W1*(th+1));
  for(let yy=1;yy<=th;yy++){let row=0;for(let xx=1;xx<=tw;xx++){row+=g[(yy-1)*tw+xx-1];ii[yy*W1+xx]=ii[(yy-1)*W1+xx]+row}}
  const rad=Math.max(7,Math.round(tw/40)),C=12;
  for(let yy=0;yy<th;yy++){const ya=Math.max(0,yy-rad),yb=Math.min(th,yy+rad+1);
    for(let xx=0;xx<tw;xx++){const xa=Math.max(0,xx-rad),xb=Math.min(tw,xx+rad+1);
      const S=ii[yb*W1+xb]-ii[ya*W1+xb]-ii[yb*W1+xa]+ii[ya*W1+xa],mean=S/((yb-ya)*(xb-xa));
      const v=g[yy*tw+xx]<mean-C?0:255,j=(yy*tw+xx)*4;bd[j]=bd[j+1]=bd[j+2]=v;bd[j+3]=255}}
  bx.putImageData(bi,0,0);
  return {gray:c,bw,cropped:r.cropped};
}
function scoreParse(p){
  const sum=p.items.reduce((a,x)=>a+x.amount,0);let sc=0;
  if(p.total!=null)sc+=3+Math.min(p.totalVotes||0,6);
  if(p.total!=null&&p.items.length&&Math.abs(sum-p.total)<0.02)sc+=8;
  sc+=Math.min(p.items.length,6)-2*p.items.filter(i=>letters(i.name)<3).length;
  if(p.dateFound)sc+=1;if(p.merchant&&letters(p.merchant)>=3)sc+=1;
  return sc;
}
async function ocrCanvases(variants){
  setProgress('Lade Texterkennung …',0);
  await loadTesseract();const w=await getWorker();
  const passes=[{c:variants.bw,psm:'4'},{c:variants.gray,psm:'6'}];let best=null;
  for(let i=0;i<passes.length;i++){
    ocrPass=` (Durchgang ${i+1} von ${passes.length})`;setProgress('Lese Text'+ocrPass+' …',0);
    try{await w.setParameters({tessedit_pageseg_mode:passes[i].psm,preserve_interword_spaces:'1'})}catch(e){}
    const {data}=await w.recognize(passes[i].c);const text=data.text||'';const p=parseReceipt(text);const sc=scoreParse(p);
    if(!best||sc>best.sc)best={text,p,sc};
    const sum=p.items.reduce((a,x)=>a+x.amount,0);
    if(p.total!=null&&p.items.length&&Math.abs(sum-p.total)<0.02&&(p.totalVotes||0)>=2)break; // eindeutig, zweiter Durchgang unnötig
  }
  ocrPass='';return best;
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
  if(letters(text)>=20)return {text,p:parseReceipt(text)};
  // eingescannt: erste Seite als Bild rendern und erkennen
  const pg=await doc.getPage(1);const vp0=pg.getViewport({scale:1});const vp=pg.getViewport({scale:Math.min(3,1600/vp0.width)});
  const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  await pg.render({canvasContext:c.getContext('2d'),canvas:c,viewport:vp}).promise;
  await new Promise(r=>c.toBlob(b=>{if(b){if(ui.photoUrl)URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=URL.createObjectURL(b)}r()},'image/jpeg',0.8));
  return ocrCanvases(prepVariants(c,c.width,c.height));
}
const withTimeout=(pr,ms)=>Promise.race([pr,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
const isPdf=f=>f&&(f.type==='application/pdf'||/\.pdf$/i.test(f.name||''));
async function runOCR(file){
  if(!file)return;
  const pdf=isPdf(file);
  if(!pdf&&!/^image\//.test(file.type||'image/')){ui.err='Diese Datei kann die App nicht lesen. Wähle ein Foto, einen Screenshot oder eine PDF-Rechnung.';render();return}
  if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}
  ui.err='';ui.draft=null;ui.ocr={label:pdf?'Öffne PDF …':'Bereite Foto vor …',p:0};go('beleg');
  try{
    let res;
    if(pdf)res=await withTimeout(readPdf(file),60000);
    else{const {img,url}=await loadImage(file);ui.photoUrl=url;setProgress('Suche den Bon im Foto …',0.05);
      await new Promise(r=>setTimeout(r,30));
      res=await ocrCanvases(prepVariants(img,img.naturalWidth,img.naturalHeight))}
    ui.ocr=null;ui.paste=res.text||'';
    if(!ui.paste.trim()){ui.err=pdf?'In diesem PDF wurde kein Text gefunden.':'Auf dem Foto wurde kein Text gefunden. Fotografiere den Bon gerade, formatfüllend und gut beleuchtet, oder kopiere den Text mit Google Lens.';render();return}
    parseNow(res.p);
  }catch(e){
    ui.ocr=null;
    ui.err=e&&e.message==='img'?'Das Bild ließ sich nicht öffnen. Versuche ein anderes Foto oder einen Screenshot.':
      pdf?'Das PDF ließ sich nicht öffnen. Beim ersten Mal braucht die App dafür Internet. Ist das PDF passwortgeschützt, öffne es in einer PDF-App und kopiere den Text.':
      e&&e.message==='timeout'?'Das Lesen hat zu lange gedauert. Prüfe die Internetverbindung und versuche es noch einmal.':
      'Die Texterkennung ließ sich nicht laden. Beim ersten Mal braucht sie Internet. Alternativ den Text mit Google Lens kopieren und unten einfügen.';
    render();
  }
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
const CHANGES={'2.4.0':['Bessere Bon-Erkennung: Die App schneidet den Bon im Foto automatisch aus und liest ihn bei Bedarf zweimal.','Tankstellen-Bons wie von Aral werden erkannt.','PDF-Rechnungen öffnen, auch über „Teilen“ aus der Mail-App.','Netto-Rechnungen: MwSt. wird automatisch auf die Positionen verteilt.','Offene Rechnungen mit Zahlungsziel und Erinnerung.','Neue Steuer-Arten: Handwerkerleistungen und Krankheitskosten.','Hinweis, wenn eine Rechnung zu deinen Fixkosten passt.','Wischen nach links oder rechts wechselt zwischen den Reitern.','Kurze Anleitung: einmal beim Start und jederzeit unter „Mehr“, auch zu einzelnen Themen wie Sparzielen.']};
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
  const left=st.inc-st.out-st.saved;
  const ids=new Set(Object.keys(st.by).filter(k=>Math.abs(st.by[k])>0.004));
  if(state.useBudgets)Object.keys(state.budgets).forEach(k=>{if(+state.budgets[k]>0&&state.categories.some(c=>c.id===k))ids.add(k)});
  const cats=[...ids].map(id=>[id,st.by[id]||0]).sort((a,b)=>b[1]-a[1]);
  const max=cats.length?Math.max(...cats.map(c=>c[1])):1;
  const hasEx=state.receipts.some(r=>r.example)||state.fixed.some(f=>f.example)||state.goals.some(g=>g.example);
  let h='';
  if(ui.flash) h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;
  h+=whatsNew();
  const yd=yearDue();
  if(yd&&!(state.yearExport[yd]&&state.yearExport[yd].done)&&!ui.yearHide) h+=`<div class="note"><b>Jahresabschluss ${yd}:</b> Lade jetzt deinen Jahresexport herunter, mit Jahres-CSV, Steuerliste und Backup.<div class="row" style="margin-top:8px"><button class="primary" data-act="year-go" data-y="${yd}">Zum Jahresexport</button><button class="ghost" data-act="year-later">Später</button></div></div>`;
  const openInv=state.receipts.filter(r=>r.open).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
  if(openInv.length) h+=`<div class="note ${openInv.some(r=>dueCls(r.due)==='due')?'bad':'warn'}" role="status"><b>Offene Rechnungen:</b>
    <div class="openlist">${openInv.slice(0,5).map(r=>`<div><span>${esc(r.merchant||'Rechnung')} · <b class="num">${fmt(rTotal(r))}</b> · ${r.due?fmtD(r.due)+', ':''}${dueText(r.due)}</span><button data-act="paid" data-id="${r.id}">Bezahlt</button></div>`).join('')}</div>${openInv.length>5?`<p class="small" style="margin:6px 0 0">und ${openInv.length-5} weitere</p>`:''}</div>`;
  const due=contracts().filter(x=>x.c.days<=42);
  if(due.length) h+=`<div class="note ${due.some(x=>x.c.days<=14)?'bad':'warn'}" role="status"><b>Kündigungsfrist:</b> ${due.map(({f,c})=>`${esc(f.name)} bis ${fmtD(c.deadline)} (${deadlineText(c)})`).join(' · ')}<div style="margin-top:6px"><a href="#fixkosten">Verträge ansehen</a></div></div>`;
  if(hasEx) h+=`<div class="note warn"><b>Das sind Beispieldaten.</b> Sie zeigen, wie die App gefüllt aussieht.<div class="row" style="margin-top:8px"><button data-act="remove-examples">Beispieldaten entfernen</button></div></div>`;
  if(state.useBudgets){
    const warn=cats.filter(([id,v])=>{const b=+state.budgets[id]||0;return b>0&&v>=b*.8});
    if(warn.length) h+=`<div class="note ${warn.some(([id,v])=>v>+state.budgets[id])?'bad':'warn'}" role="status"><b>Budget-Hinweis:</b> ${warn.map(([id,v])=>`${esc(cat(id).name)} ${Math.round(v/state.budgets[id]*100)} %`).join(' · ')}</div>`;
  }
  h+=`<div class="figs">
    <div class="fig"><span>Einnahmen</span><b>${fmt(st.inc)}</b></div>
    <div class="fig"><span>Ausgaben</span><b>${fmt(st.out)}</b></div>
    <div class="fig main"><span>Übrig${st.saved>0?`<small>nach ${fmt(st.saved)} Sparen</small>`:''}</span><b class="${left<0?'minus':''}">${fmt(left)}</b></div></div>
    <div class="split" aria-hidden="true">${(()=>{const base=Math.max(st.out+Math.max(0,st.saved),st.inc,0.01);const w=v=>Math.max(0,v)/base*100;
      return `<i style="width:${w(st.fixOut)}%;background:var(--accent)"></i><i style="width:${w(st.varOut)}%;background:var(--var)"></i><i style="width:${w(st.saved)}%;background:var(--ok)"></i>`})()}</div>
    <div class="legend"><span style="--c:var(--accent)">Fixkosten <b class="num">${fmt(st.fixOut)}</b></span><span style="--c:var(--var)">Belege <b class="num">${fmt(st.varOut)}</b></span>${st.saved?`<span style="--c:var(--ok)">Gespart <b class="num">${fmt(st.saved)}</b></span>`:''}${st.inc>0?`<span style="--c:var(--line)">frei</span>`:''}</div>`;
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
  if(state.goals.length){
    h+=`<h2>Sparziele</h2><div class="bars">${state.goals.map(g=>{const i=goalInfo(g);return `<div class="bar" style="--c:var(--ok)"><span class="lbl">${esc(g.name)}${i.done?'<small>erreicht</small>':''}</span><span class="num">${fmt(i.bal)}${i.target?` / ${fmt(i.target)}`:''}</span>${i.target?`<div class="track"><i style="width:${i.pct}%"></i></div>`:''}</div>`}).join('')}</div>
    <p class="small" style="margin-top:8px"><a href="#fixkosten">Sparziele verwalten</a></p>`;
  }
  h+=`<h2>Belege im ${MONTHS[+ym.slice(5)-1]}</h2>`;
  h+=rs.length?`<div class="list">${rs.map(receiptRow).join('')}</div>`
    :`<div class="list"><div class="empty">Keine Belege. Unter <a href="#beleg">Beleg</a> fotografierst du einen Bon oder fügst seinen Text ein.</div></div>`;
  h+=`<p class="muted small" style="margin-top:14px">Letzte Sicherung: ${state.lastBackup?new Date(state.lastBackup).toLocaleDateString('de-DE'):'noch keine'} · <a href="#mehr">Backup unter Mehr</a></p>`;
  return h;
}
function receiptRow(r){
  const open=ui.open===r.id;const cs=[...new Set(r.items.map(i=>i.cat))];const t=rTotal(r);
  return `<div class="item"><button class="head" data-act="toggle" data-id="${r.id}" aria-expanded="${open}">
    <span class="d">${r.date.slice(8)}.${r.date.slice(5,7)}.</span>
    <span class="m">${esc(r.merchant||'Ohne Händler')}${r.open?` <span class="tag ${dueCls(r.due)}">offen${r.due?' · bis '+fmtD(r.due).slice(0,6):''}</span>`:''}${r.refund?' <span class="tag ret">Retoure</span>':''}${r.example?' <span class="tag ex">Beispiel</span>':''}<span class="dots">${cs.map(c=>`<i class="dot" style="--c:${cat(c).color}" title="${esc(cat(c).name)}"></i>`).join('')}</span></span>
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

function vBeleg(){
  const d=ui.draft;
  if(ui.ocr) return `<h2>Bon wird gelesen</h2><div class="drop"><b id="ocr-label">${esc(ui.ocr.label)}</b><div class="progress"><i id="ocr-bar" style="width:${Math.round((ui.ocr.p||0)*100)}%"></i></div>
    <p class="muted small" style="margin:0">Die Texterkennung läuft auf deinem Handy. Beim ersten Mal lädt sie einmalig die deutschen Sprachdaten (einige MB). Für ein sicheres Ergebnis liest sie den Bon bei Bedarf zweimal.</p></div>`;
  if(!d){
    return `${ui.flash?`<div class="flash" role="status">${esc(ui.flash)}</div>`:''}
    <h2>Neuer Beleg</h2>
    ${vTemplates()}
    <div class="drop${ui.action==='photo'?' hot':''}"><button id="photo-btn" class="primary" data-act="photo" style="justify-content:center">Foto, Screenshot oder PDF wählen</button>
      ${ui.action==='photo'?'<p class="small" style="margin:0;font-weight:600">Tippe auf den Knopf, dann „Kamera“ oder ein Bild aus der Galerie wählen.</p>':''}
      <p class="muted small" style="margin:0">Tipp: Fotografiere den Bon formatfüllend, gerade und gut beleuchtet. Fotos und PDF-Rechnungen kannst du auch aus Galerie oder Mail über „Teilen“ → Kassensturz schicken.</p></div>
    <details class="note"><summary><b>Erkennung klappt nicht gut? Text selbst kopieren</b></summary>
      <ul class="steps"><li>Foto in Google Fotos öffnen, „Lens“ antippen, „Text“ wählen, „Alles auswählen“ und kopieren, dann unten einfügen.</li>
      <li>Bei Online-Bestellungen den Text der Bestellbestätigung markieren und kopieren.</li></ul></details>
    <label class="f" for="bon-text">Text des Belegs
      <textarea id="bon-text" rows="8" placeholder="REWE Markt GmbH&#10;BIO BANANEN   1,78 B&#10;…&#10;SUMME   EUR   12,92">${esc(ui.paste)}</textarea></label>
    ${ui.err?`<p class="err" role="alert">${esc(ui.err)}</p>`:''}
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
  let h=`<h2>${d.refund?(d.id?'Retoure bearbeiten':'Retoure erfassen'):(d.id?'Beleg bearbeiten':'Beleg prüfen')}</h2>`;
  if(d.from) h+=`<div class="note">Vorausgefüllt aus ${esc(d.from)}. Das Datum ist heute. Prüfe die Beträge und speichere.</div>`;
  if(d.collapsed) h+=`<div class="note">Die Einzelpositionen ließen sich nicht sicher lesen. Weil hier alles in eine Kategorie gehört, habe ich den Gesamtbetrag übernommen.<div class="row" style="margin-top:8px"><button data-act="show-items">Erkannte Einzelpositionen anzeigen</button></div></div>`;
  if(d.gross) h+=`<div class="note">Netto-Rechnung erkannt: ${fmt(d.gross.vat)} MwSt. sind anteilig auf die Positionen verteilt.</div>`;
  if(d.fixHint&&!d.id){const f=state.fixed.find(x=>x.id===d.fixHint);if(f)h+=`<div class="note warn">Passt das zu deinen Fixkosten „${esc(f.name)}“ (${fmt(f.amount)} ${INTERVALS[f.interval]||''})? Dann würde es doppelt zählen. Erfasse hier nur eine Nachzahlung oder verwirf den Beleg.</div>`}
  if(d.refund&&!d.id) h+=`<div class="note">Entferne die Positionen, die du behalten hast. Gespeichert wird der Betrag als Gutschrift und von den Ausgaben abgezogen.</div>`;
  if(open) h+=`<div class="note warn" role="alert"><b>${open} ${open===1?'Position kennt':'Positionen kennt'} die App noch nicht.</b> Wähle die Kategorie einmal aus. Beim nächsten Mal ordnet die App sie selbst zu.${anySugg?`<div class="row" style="margin-top:8px"><button data-act="accept-all">Alle Vorschläge übernehmen</button></div>`:''}</div>`;
  h+=`<form class="bon" id="draft" autocomplete="off">
    ${ui.photoUrl&&!d.id?`<details class="photo" style="margin-bottom:12px"><summary class="small" style="cursor:pointer;font-weight:600">Foto zum Vergleich anzeigen</summary><img src="${ui.photoUrl}" alt="Foto des Belegs" style="margin-top:8px"></details>`:''}
    <div class="meta"><label class="f merchant" for="d-merchant">Händler<input id="d-merchant" data-f="merchant" value="${esc(d.merchant)}" placeholder="z. B. REWE"></label>
      <label class="f" for="d-date">Datum<input id="d-date" type="date" data-f="date" value="${esc(d.date)}"></label>
      <label class="f" for="d-total">Bon-Summe<input id="d-total" inputmode="decimal" data-f="total" value="${tot!=null?fmtIn(tot):''}" placeholder="optional" style="font-family:var(--f-mono)"></label></div>
    ${d.dateGuessed?`<p class="hint">Kein Datum auf dem Bon gefunden, heute eingetragen. Bitte prüfen.</p>`:''}
    <label class="check"><input id="d-refund" type="checkbox" data-f="refund"${d.refund?' checked':''}> Retoure oder Erstattung (wird abgezogen)</label>
    <div class="pos">${d.items.map((it,i)=>`<div class="p${!it.cat?' needs':''}">
      <input id="n-${i}" data-row="${i}" data-k="name" value="${esc(it.name)}" aria-label="Bezeichnung Position ${i+1}" placeholder="Bezeichnung">
      <input id="a-${i}" class="amt" data-row="${i}" data-k="amount" inputmode="decimal" value="${esc(it.amount)}" aria-label="Betrag Position ${i+1}" placeholder="0,00">
      <button type="button" class="icon ghost" data-act="del-row" data-i="${i}" aria-label="Position ${i+1} entfernen">×</button>
      <div class="catline"><select id="c-${i}" data-row="${i}" data-k="cat" aria-label="Kategorie Position ${i+1}">${catOpts(it.cat,'– Kategorie wählen –')}</select>
      ${!it.cat?(it.suggest?`<button type="button" class="ghost" data-act="accept" data-i="${i}">Vorschlag: ${esc(cat(it.suggest).name)}</button>`:`<span class="why">Unbekannt</span>`)
        :`<span class="src">${it.src?esc(it.src):'von dir gewählt'}</span>`}</div>
      <select id="t-${i}" class="taxsel${it.tax?' on':''}" data-row="${i}" data-k="tax" aria-label="Steuerlich absetzbar, Position ${i+1}">${taxOpts(it.tax)}</select></div>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button type="button" class="ghost" data-act="add-row">+ Position</button>
      ${tot!=null&&Math.abs(diff)>=0.01?`<button type="button" class="ghost" data-act="add-diff">Differenz als Position</button><button type="button" class="ghost" data-act="total-only">Nur Gesamtbetrag verwenden</button>`:''}</div>
    <div class="sumline"><span>Summe Positionen</span><b id="sum">${fmt(d.refund?-sum:sum)}</b></div>
    <p id="diff" class="small" style="margin:6px 0 0;color:var(--warn)">${diffText(tot,sum)}</p>
    ${!d.refund?`<div class="openbox"><label class="check small"><input id="d-open" type="checkbox" data-f="open"${d.open?' checked':''}> Rechnung noch nicht bezahlt</label>
      ${d.open?`<label class="f" for="d-due" style="margin-top:6px">Zahlbar bis<input id="d-due" type="date" data-f="due" value="${esc(d.due||'')}"></label>`:''}</div>`:''}
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

function fixedRow(f){
  const act=activeIn(f,ui.ym);
  let when=INTERVALS[f.interval]||'monatlich';
  if(f.interval===0) when+=f.start?` im ${ymLabel(f.start)}`:'';
  else{if(f.start)when+=` ab ${ymShort(f.start)}`;if(f.end)when+=` bis ${ymShort(f.end)}`}
  const status=!act?(f.interval===0?'':f.start&&f.start>ui.ym?'<span class="tag off">startet später</span>':'<span class="tag off">beendet</span>'):'';
  const c=f.kind!=='in'&&contractInfo(f);
  return `<div class="frow${act?'':' inactive'}">
    <span class="t">${f.kind==='out'?`<i class="dot" style="--c:${cat(f.cat).color}"></i>`:''}${esc(f.name)}${f.example?' <span class="tag ex">Beispiel</span>':''}${f.tax?' <span class="tag tax">§ absetzbar</span>':''}${status}</span>
    <span class="num">${fmt(f.amount)}</span>
    <span class="s">${f.kind==='out'?esc(cat(f.cat).name)+' · ':''}${when}${f.interval>1?` · ${fmt(shareOf(f))} / Monat`:''}${c?` · kündbar bis ${fmtD(c.deadline)}`:''}</span>
    <span class="acts"><button class="ghost" data-act="fedit" data-id="${f.id}">Bearbeiten</button><button class="ghost danger" data-act="fdel" data-id="${f.id}">Löschen</button></span></div>`;
}
function deadlineText(c){return c.days<=0?'heute letzter Tag':c.days===1?'noch 1 Tag':`noch ${c.days} Tage`}
function vContracts(){
  const cs=contracts();
  let h=`<h3 id="vertraege">Verträge & Kündigungsfristen</h3>`;
  if(!cs.length) return h+`<div class="list"><div class="empty">Noch keine Verträge mit Laufzeit. Trage bei einer Fixkosten-Position unter „Vertrag & Kündigung“ die Laufzeit ein.</div></div>`;
  return h+`<div class="list">${cs.map(({f,c})=>`<div class="frow"><span class="t">${esc(f.name)}${c.days<=14?' <span class="tag due">bald kündigen</span>':c.days<=42?' <span class="tag soon">Frist naht</span>':''}</span>
    <span class="num">${fmtD(c.deadline)}</span>
    <span class="s">letzter Kündigungstag · ${deadlineText(c)} · läuft sonst bis ${fmtD(c.end)}, dann ${(+f.renew||1)===1?'monatlich weiter':`+${f.renew} Monate`}</span></div>`).join('')}</div>`;
}
function vGoals(){
  const total=state.goals.reduce((a,g)=>a+goalBalance(g),0);
  let h=`<h3 id="sparziele">Sparziele</h3>
  <div class="fig" style="margin-bottom:10px;grid-template-columns:1fr auto;align-items:baseline"><span>Sparkonto gesamt</span><b>${fmt(total)}</b></div>`;
  h+=state.goals.length?`<div class="list">${state.goals.map(g=>{const i=goalInfo(g);
    const deps=state.deposits.filter(d=>d.goalId===g.id).sort((a,b)=>b.date.localeCompare(a.date));
    const lines=[];
    if(i.rate>0)lines.push(`Sparrate ${fmt(i.rate)} / Monat`);else lines.push('keine Sparrate');
    if(i.done)lines.push('<b style="color:var(--ok)">Ziel erreicht</b>');
    else{if(i.need!=null)lines.push(`für ${ymShort(g.due)} nötig: ${fmt(i.need)} / Monat`);else if(g.due)lines.push(`Ziel ${ymShort(g.due)}`);
      if(i.eta)lines.push(`mit aktueller Rate erreicht im ${ymLabel(i.eta)}`)}
    const df=ui.depositFor===g.id;
    return `<div class="goal"><div class="ghead"><b>${esc(g.name)}</b>${g.example?' <span class="tag ex">Beispiel</span>':''}<span class="num">${fmt(i.bal)}${i.target?` <span class="muted">von ${fmt(i.target)}</span>`:''}</span></div>
      ${i.target?`<div class="track gtrack"><i style="width:${i.pct}%"></i></div>`:''}
      <p class="small muted" style="margin:0">${lines.join(' · ')}</p>
      ${i.done&&i.rate>0?`<div class="row"><button data-act="goal-stop" data-id="${g.id}">Sparrate ab nächstem Monat beenden</button></div>`:''}
      ${df?`<form class="row" id="deposit-form" data-goal="${g.id}" autocomplete="off" style="margin-top:4px">
        <input id="dep-amount" inputmode="decimal" placeholder="Betrag" style="flex:1 1 7em;width:auto;font-family:var(--f-mono)">
        <input id="dep-date" type="date" value="${today()}" style="flex:1 1 9em;width:auto">
        <button class="primary" type="submit">${ui.depositSign>0?'Einzahlen':'Entnehmen'}</button><button type="button" data-act="dep-cancel">Abbrechen</button>
        ${ui.err?`<p class="err" role="alert" style="flex-basis:100%;margin:0">${esc(ui.err)}</p>`:''}</form>`
      :`<div class="row"><button class="ghost" data-act="dep" data-id="${g.id}" data-sign="1">+ Einzahlen</button><button class="ghost" data-act="dep" data-id="${g.id}" data-sign="-1">− Entnehmen</button><button class="ghost" data-act="goal-edit" data-id="${g.id}">Bearbeiten</button><button class="ghost danger" data-act="goal-del" data-id="${g.id}">Löschen</button></div>`}
      ${ui.confirmGoal===g.id?`<div class="note warn" style="margin:0">„${esc(g.name)}“ mit allen Einzahlungen löschen?<div class="row" style="margin-top:8px"><button class="danger" data-act="goal-del-yes" data-id="${g.id}">Ja, löschen</button><button data-act="goal-del-no">Abbrechen</button></div></div>`:''}
      ${deps.length?`<details class="small"><summary class="muted" style="cursor:pointer">Einzahlungen (${deps.length})</summary><div class="lines" style="margin-top:6px">${deps.map(d=>`<div><span class="n"><span class="num muted">${fmtD(d.date)}</span> ${esc(d.note||(d.amount<0?'Entnahme':'Einzahlung'))}</span><span class="num">${fmt(d.amount)}</span><button class="icon ghost danger" data-act="dep-del" data-id="${d.id}" aria-label="Eintrag löschen">×</button></div>`).join('')}</div></details>`:''}
    </div>`}).join('')}</div>`
    :`<div class="list"><div class="empty">Noch kein Sparziel. Lege unten eins an, z. B. „Notgroschen“ oder „Urlaub“.</div></div>`;
  const e=ui.goalEdit&&state.goals.find(g=>g.id===ui.goalEdit);
  if(!e&&!ui.goalNew) return h+`<div class="row" style="margin-top:10px"><button data-act="goal-new">+ Neues Sparziel</button></div>`;
  return h+`<form class="form" id="goal-form" autocomplete="off">
    <label class="f full" for="g-name">Name<input id="g-name" value="${esc(e?e.name:'')}" placeholder="z. B. Notgroschen"></label>
    <label class="f" for="g-target">Zielbetrag (optional)<input id="g-target" inputmode="decimal" value="${e&&e.target?fmtIn(e.target):''}" placeholder="1.500,00" style="font-family:var(--f-mono)"></label>
    <label class="f" for="g-due">Ziel bis (optional)<input id="g-due" type="month" value="${esc(e?e.due||'':'')}"></label>
    <label class="f" for="g-rate">Sparrate pro Monat<input id="g-rate" inputmode="decimal" value="${e&&rateFor(e,thisYM())?fmtIn(rateFor(e,thisYM())):''}" placeholder="0,00" style="font-family:var(--f-mono)"></label>
    ${e?'':`<label class="f" for="g-start">Startguthaben (optional)<input id="g-start" inputmode="decimal" placeholder="0,00" style="font-family:var(--f-mono)"></label>`}
    <p class="muted small full" style="margin:0">Die Sparrate zählt ab diesem Monat jeden Monat automatisch und verringert dein „Übrig“. Eine geänderte Rate gilt ab diesem Monat, frühere Monate bleiben unverändert.</p>
    ${ui.err?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
    <div class="row full"><button class="primary" type="submit">${e?'Änderung speichern':'Sparziel anlegen'}</button><button type="button" data-act="goal-cancel">Abbrechen</button></div></form>`;
}
function vFixed(){
  const st=monthStats(ui.ym);
  const ins=state.fixed.filter(f=>f.kind==='in').sort((a,b)=>shareOf(b)-shareOf(a));
  const outs=state.fixed.filter(f=>f.kind!=='in').sort((a,b)=>shareOf(b)-shareOf(a));
  const e=ui.fixedEdit&&state.fixed.find(f=>f.id===ui.fixedEdit);
  const kind=e?e.kind:ui.fixedKind;
  const hasC=e&&e.contractEnd;
  let h=`<h2>Planen</h2><p class="muted">Einnahmen, Fixkosten, Verträge und Sparziele. Jährliche Kosten rechnet die App auf den Monat um.</p>
  <div class="figs"><div class="fig"><span>Einnahmen ${MSHORT[+ui.ym.slice(5)-1]}</span><b>${fmt(st.inc)}</b></div><div class="fig"><span>Fixkosten ${MSHORT[+ui.ym.slice(5)-1]}</span><b>${fmt(st.fixOut)}</b></div></div>
  <nav class="row small" aria-label="Abschnitte" style="margin:6px 0 0"><a href="#planen-ein" data-act="jump" data-to="sec-ein">Einnahmen</a>·<a href="#planen-fix" data-act="jump" data-to="sec-fix">Fixkosten</a>·<a href="#planen-vertraege" data-act="jump" data-to="vertraege">Verträge</a>·<a href="#planen-sparen" data-act="jump" data-to="sparziele">Sparziele</a></nav>`;
  h+=`<h3 id="sec-ein">Einnahmen</h3>`+(ins.length?`<div class="list">${ins.map(fixedRow).join('')}</div>`:`<div class="list"><div class="empty">Noch keine Einnahmen. Trage unten dein Gehalt oder andere Einnahmen ein.</div></div>`);
  h+=`<h3 id="sec-fix">Fixkosten</h3>`+(outs.length?`<div class="list">${outs.map(fixedRow).join('')}</div>`:`<div class="list"><div class="empty">Noch keine Fixkosten. Trage unten Miete, Strom oder Abos ein.</div></div>`);
  h+=`<h3 id="fx-head">${e?'Eintrag bearbeiten':'Neue Einnahme oder Fixkosten'}</h3>
  <form class="form" id="fixed-form" autocomplete="off">
    <label class="f" for="fx-kind">Art<select id="fx-kind"><option value="out"${kind!=='in'?' selected':''}>Ausgabe</option><option value="in"${kind==='in'?' selected':''}>Einnahme</option></select></label>
    <label class="f" for="fx-int">Rhythmus<select id="fx-int">${[1,3,6,12,0].map(k=>`<option value="${k}"${(e?e.interval:1)===k?' selected':''}>${INTERVALS[k]}</option>`).join('')}</select></label>
    <label class="f full" for="fx-name">Bezeichnung<input id="fx-name" value="${esc(e?e.name:'')}" placeholder="${kind==='in'?'z. B. Gehalt':'z. B. Streaming-Abo'}"></label>
    <label class="f" for="fx-amount">Betrag<input id="fx-amount" inputmode="decimal" value="${e?fmtIn(e.amount):''}" placeholder="12,99" style="font-family:var(--f-mono)"></label>
    <label class="f outonly" for="fx-cat"${kind==='in'?' hidden':''}>Kategorie<select id="fx-cat">${catOpts(e&&e.cat?e.cat:'vertraege')}</select></label>
    <label class="f" for="fx-start">Ab Monat<input id="fx-start" type="month" value="${esc(e?e.start:'')}"></label>
    <label class="f" for="fx-end">Bis Monat (optional)<input id="fx-end" type="month" value="${esc(e?e.end:'')}"></label>
    <label class="f full outonly" for="fx-tax"${kind==='in'?' hidden':''}>Steuerlich absetzbar<select id="fx-tax">${taxOpts(e?e.tax:'')}</select></label>
    <details class="full outonly"${kind==='in'?' hidden':''}${hasC?' open':''}><summary style="cursor:pointer;font-weight:600;font-size:.9rem">Vertrag & Kündigung (optional)</summary>
      <div class="form" style="margin:8px 0 0;padding:0;border:0">
        <label class="f full" for="fx-cend">Mindestlaufzeit endet am<input id="fx-cend" type="date" value="${esc(e&&e.contractEnd||'')}"></label>
        <label class="f" for="fx-nval">Kündigungsfrist<input id="fx-nval" inputmode="numeric" value="${e&&e.noticeVal!=null?esc(e.noticeVal):'1'}" style="font-family:var(--f-mono)"></label>
        <label class="f" for="fx-nunit">Einheit<select id="fx-nunit"><option value="monate"${!e||e.noticeUnit!=='wochen'?' selected':''}>Monate</option><option value="wochen"${e&&e.noticeUnit==='wochen'?' selected':''}>Wochen</option></select></label>
        <label class="f full" for="fx-renew">Danach verlängert um<select id="fx-renew">${[1,3,6,12,24].map(k=>`<option value="${k}"${(e&&+e.renew||1)===k?' selected':''}>${k===1?'1 Monat (monatlich kündbar)':k+' Monate'}</option>`).join('')}</select></label>
        <p class="muted small full" style="margin:0">Bei vielen Verträgen ab März 2022 gilt nach der Mindestlaufzeit: monatlich kündbar. Im Zweifel im Vertrag nachsehen.</p>
      </div></details>
    <p class="muted small full" style="margin:0">Ohne „Ab Monat“ zählt der Eintrag in allen Monaten. Bei „einmalig“ zählt er nur im gewählten Monat.</p>
    ${ui.err&&!ui.goalEdit&&!ui.goalNew&&!ui.depositFor?`<p class="err full" role="alert">${esc(ui.err)}</p>`:''}
    <div class="row full"><button class="primary" type="submit">${e?'Änderung speichern':'Hinzufügen'}</button>${e?'<button type="button" data-act="fcancel">Abbrechen</button>':''}</div>
  </form>`;
  h+=vContracts();
  h+=vGoals();
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
  h+=`<h2>Suche</h2><label class="f" for="search">In allen Belegen suchen<input id="search" type="search" value="${esc(ui.search)}" placeholder="z. B. Kaffee, Zalando, Bananen"></label>`;
  h+=`<div id="search-res">${searchResults()}</div>`;
  return h;
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
function vMehr(){
  const mers=Object.entries(state.rules.merchants).sort((a,b)=>a[0].localeCompare(b[0]));
  let h='';
  if(ui.flash) h+=`<div class="flash" role="status">${esc(ui.flash)}</div>`;
  h+=vGuide();
  if(!ui.installed&&ui.installEvt) h+=`<div class="note"><b>Als App installieren</b><p class="small" style="margin:4px 0 8px">Dann startet Kassensturz vom Startbildschirm, ohne Browserleiste und auch offline.</p><button class="primary" data-act="install">App installieren</button></div>`;
  h+=vTaxYear();
  h+=vLockSettings();
  h+=`<h2>Budgets</h2><div class="box"><label class="check"><input id="use-budgets" type="checkbox"${state.useBudgets?' checked':''}> Monatsbudgets verwenden</label>
    ${state.useBudgets?`<p class="muted small" style="margin:0">Leer lassen = kein Budget. Ab 80 % warnt die App, über 100 % wird es rot.</p><div class="list">${state.categories.map(c=>`<div class="rule" style="grid-template-columns:minmax(0,1fr) 8em"><span><i class="dot" style="--c:${c.color}"></i> ${esc(c.name)}</span><input id="bud-${c.id}" data-budget="${c.id}" inputmode="decimal" value="${+state.budgets[c.id]>0?fmtIn(state.budgets[c.id]):''}" placeholder="–" aria-label="Budget ${esc(c.name)}"></div>`).join('')}</div>`:''}</div>`;
  h+=`<h2>Kategorien</h2><div class="chips">${state.categories.map(c=>`<span class="chip"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}${c.id!=='sonstiges'?`<button data-act="cdel" data-id="${c.id}" aria-label="${esc(c.name)} löschen">×</button>`:'<span style="width:6px"></span>'}</span>`).join('')}</div>
  ${ui.confirmCat?`<div class="note warn" style="margin-top:10px">„${esc(cat(ui.confirmCat).name)}“ löschen? Alle Einträge und Regeln dieser Kategorie wandern zu „Sonstiges“.<div class="row" style="margin-top:8px"><button class="danger" data-act="cdel-yes">Ja, löschen</button><button data-act="cdel-no">Abbrechen</button></div></div>`:''}
  <form class="row" id="cat-form" style="margin-top:10px" autocomplete="off"><input id="cat-name" placeholder="Neue Kategorie, z. B. Haustier" style="flex:1 1 14em;width:auto"><button type="submit">Hinzufügen</button></form>`;
  h+=`<h2>Gelernte Zuordnungen</h2><p class="muted">Beim Speichern merkt sich die App Produkt und Kategorie. Hier korrigierst du Fehler.</p>
  <label class="f" for="rule-filter">Produkte durchsuchen<input id="rule-filter" value="${esc(ui.ruleFilter)}" placeholder="z. B. Milch"></label>
  <div id="prod-list">`+prodList()+`</div>`;
  h+=`<h3>Händler (${mers.length})</h3>`;
  h+=mers.length?`<div class="list">${mers.map(([k,m])=>`<div class="rule"><span class="k">${esc(k)}${m.always?' <span class="tag">immer</span>':''}</span>
    <select id="rm-${esc(k)}" data-rule="m" data-key="${esc(k)}" aria-label="Kategorie für ${esc(k)}">${catOpts(m.cat)}</select>
    <button class="icon ghost danger" data-act="rdel" data-type="m" data-key="${esc(k)}" aria-label="Regel löschen">×</button></div>`).join('')}</div>`
    :`<div class="list"><div class="empty">Noch keine Händler gespeichert.</div></div>`;
  h+=`<h2>Export für Excel</h2><p class="muted">CSV-Dateien mit Semikolon und Komma-Beträgen, öffnen direkt in Excel.</p>
  <div class="row"><button data-act="csv-items">Alle Belegpositionen</button><button data-act="csv-months">Monatsübersicht</button><button data-act="csv-fixed">Planung (Fixkosten, Verträge, Sparziele)</button></div>`;
  h+=`<h2>Backup</h2><p class="muted">Deine Daten liegen nur auf diesem Handy. Lade ab und zu ein Backup herunter und leg es z. B. in Google Drive ab.${persistGranted?' Der Browser hat dauerhaften Speicher zugesagt.':''}</p>
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
  <p class="muted small" style="margin-top:24px">Kassensturz ${APP_VERSION} · Daten nur auf diesem Gerät</p>`;
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
    {t:'Belege erfassen',x:'Unter „Beleg“ fotografierst du einen Bon oder öffnest eine PDF-Rechnung. Die App liest Händler, Datum und Beträge aus und ordnet jede Position einer Kategorie zu.',a:'receipt'},
    {t:'Die App lernt mit',x:'Kennt sie ein Produkt noch nicht, wählst du die Kategorie einmal aus. Beim nächsten Bon weiß sie es.',a:'learn'},
    {t:'Planen',x:'Unter „Planen“ trägst du Einnahmen, feste Kosten, Verträge und Sparziele ein. Sie zählen jeden Monat automatisch.',a:'plan'},
    {t:'Der Monat auf einen Blick',x:'„Monat“ zeigt Einnahmen, Ausgaben und was übrig bleibt, nach Kategorien als Balken oder Kuchen. Mit den Pfeilen oben wechselst du den Monat, durch Wischen nach links oder rechts den Reiter.',a:'pie'},
    {t:'Deine Daten sichern',x:'Alles liegt nur auf diesem Handy. Lade unter „Mehr“ ab und zu ein Backup herunter, am besten mit Passwort.',a:'backup'},
    {t:'Bereit',x:'Mit den Beispieldaten kannst du dich in Ruhe umsehen und sie entfernen, sobald du startest. Diese Anleitung findest du jederzeit unter „Mehr“.',a:'done'}]},
  beleg:{title:'Beleg erfassen',goto:'beleg',steps:[
    {t:'Foto oder PDF',x:'Tippe unter „Beleg“ auf „Foto, Screenshot oder PDF wählen“. Fotografiere den Bon gerade, formatfüllend und hell. Aus Galerie oder Mail geht es auch über „Teilen → Kassensturz“.',a:'receipt'},
    {t:'Prüfen und speichern',x:'Die App zeigt Händler, Datum und Positionen. Passt die Summe nicht zum Bon, siehst du einen Hinweis und gleichst ihn mit „Differenz als Position“ oder „Nur Gesamtbetrag verwenden“ aus.',a:'pdf'},
    {t:'Ohne Bon',x:'Mit „Ohne Bon eintragen“ erfasst du Ausgaben von Hand. Text aus Google Lens fügst du ins Textfeld ein und tippst auf „Text auswerten“.',a:'learn'},
    {t:'Nochmal und Vorlagen',x:'Kaufst du etwas öfter, etwa ein Ticket: Beleg im Monat antippen und „Nochmal erfassen“. Oder ihn „Als Vorlage merken“, dann liegt er unter „Beleg“ ganz oben als Knopf.',a:'repeat'},
    {t:'Retouren',x:'Schickst du etwas zurück, öffne den Originalbeleg und tippe auf „Retoure erfassen“. Der Betrag wird von den Ausgaben abgezogen.',a:'repeat'}]},
  kategorien:{title:'Kategorien und Lernen',goto:'mehr',steps:[
    {t:'Automatisch zuordnen',x:'Jede Position bekommt eine Kategorie: über den Händler (Zalando → Kleidung), über Stichwörter (Milch → Essen) oder über das, was du der App beigebracht hast.',a:'cats'},
    {t:'Unbekannte Produkte',x:'Gelb markierte Positionen kennt die App noch nicht. Wähle einmal die Kategorie, beim Speichern merkt sie sich das.',a:'learn'},
    {t:'Ganzer Händler',x:'Mit dem Haken „Bei … immer … verwenden“ landet alles von diesem Händler in einer Kategorie.',a:'cats'},
    {t:'Korrigieren',x:'Unter „Mehr → Gelernte Zuordnungen“ siehst und änderst du alles Gelernte. Eigene Kategorien legst du unter „Kategorien“ an.',a:'learn'}]},
  fix:{title:'Einnahmen und Fixkosten',goto:'fixkosten',steps:[
    {t:'Einmal eintragen',x:'Unter „Planen“ trägst du Gehalt, Miete, Strom oder Abos einmal ein. Danach zählen sie jeden Monat automatisch.',a:'plan'},
    {t:'Rhythmus',x:'Wähle monatlich, vierteljährlich, halbjährlich oder jährlich. Jährliche Beträge rechnet die App auf den Monat um: 60 € Haftpflicht im Jahr sind 5 € pro Monat.',a:'plan'},
    {t:'Start und Ende',x:'Mit „Ab Monat“ und „Bis Monat“ zählt ein Eintrag nur in diesem Zeitraum. „Einmalig“ zählt nur im gewählten Monat, etwa ein Bonus.',a:'plan'},
    {t:'Was übrig bleibt',x:'Einnahmen minus Fixkosten, Belege und Sparrate ergibt im Monat „Übrig“, also das, was du noch frei ausgeben kannst.',a:'pie'}]},
  vertraege:{title:'Verträge und Kündigungsfristen',goto:'fixkosten',anchor:'vertraege',steps:[
    {t:'Vertrag anlegen',x:'Öffne bei einer Fixkosten-Position „Vertrag & Kündigung“. Trage ein, wann die Mindestlaufzeit endet, die Kündigungsfrist und um wie viel sich der Vertrag danach verlängert.',a:'contract'},
    {t:'Die App rechnet',x:'Daraus berechnet sie den letzten Tag, an dem du noch kündigen kannst. Verlängert sich der Vertrag, rechnet sie automatisch weiter.',a:'contract'},
    {t:'Rechtzeitig erinnert',x:'Ab 6 Wochen vor der Frist erscheint im Monat ein Hinweis, ab 2 Wochen in Rot. Alle Fristen stehen unter „Planen → Verträge“.',a:'contract'}]},
  sparen:{title:'Sparziele und Sparrate',goto:'fixkosten',anchor:'sparziele',steps:[
    {t:'Sparziel anlegen',x:'Unter „Planen → Sparziele“ tippst du auf „+ Neues Sparziel“. Gib einen Namen ein, etwa „Urlaub“, und optional Zielbetrag und Datum.',a:'goal'},
    {t:'Die Sparrate',x:'Die Sparrate ist der Betrag, den du jeden Monat zurücklegst. Sie wird ab dem aktuellen Monat automatisch gutgeschrieben. Änderst du sie, gilt die neue Rate ab diesem Monat.',a:'goal'},
    {t:'Ein- und auszahlen',x:'Mit „+ Einzahlen“ buchst du Extra-Beträge, etwa Weihnachtsgeld. Mit „− Entnehmen“ nimmst du Geld heraus, zum Beispiel wenn du den Urlaub bezahlst. Ein Startguthaben gibst du beim Anlegen an.',a:'goal'},
    {t:'Fortschritt',x:'Die App zeigt deinen Stand, wie viel du pro Monat brauchst, um das Ziel rechtzeitig zu erreichen, und wann du es mit der aktuellen Rate schaffst.',a:'goal'},
    {t:'Warum „Übrig“ kleiner wird',x:'Gespartes ist keine Ausgabe, aber auch nicht mehr frei verfügbar. Deshalb zieht die App die Sparrate von „Übrig“ ab. Ist ein Ziel erreicht, kannst du die Rate mit einem Tipp beenden.',a:'pie'}]},
  budgets:{title:'Budgets',goto:'mehr',steps:[
    {t:'Einschalten',x:'Unter „Mehr → Budgets“ schaltest du Monatsbudgets ein und trägst pro Kategorie einen Betrag ein, etwa 300 € für Essen.',a:'budget'},
    {t:'Rechtzeitig gewarnt',x:'Im Monat zeigt jede Kategorie, wie viel noch übrig ist. Ab 80 % wird sie gelb, über 100 % rot, und oben erscheint ein Hinweis.',a:'budget'},
    {t:'Balken oder Kuchen',x:'Budgets siehst du in der Balkenansicht. Der Kuchen zeigt dafür die Anteile der Kategorien.',a:'pie'}]},
  rechnungen:{title:'Offene Rechnungen',goto:'monat',steps:[
    {t:'Zahlungsziel',x:'Steht auf einer Rechnung „Zahlbar bis …“, markiert die App sie beim Prüfen als „noch nicht bezahlt“ mit Datum. Den Haken kannst du auch selbst setzen.',a:'invoice'},
    {t:'Erinnerung',x:'Offene Rechnungen stehen im Monat ganz oben, kurz vor und nach der Fälligkeit in Rot.',a:'invoice'},
    {t:'Bezahlt',x:'Hast du überwiesen, tippe auf „Bezahlt“. Als Ausgabe zählt die Rechnung im Monat ihres Rechnungsdatums.',a:'done'}]},
  steuer:{title:'Steuer und Jahresexport',goto:'mehr',anchor:'steuer',steps:[
    {t:'Markieren',x:'Unter jeder Position wählst du „§“, etwa Arbeitsmittel oder Fachliteratur. Die App merkt sich das für das Produkt. Auch Fixkosten wie ein Gewerkschaftsbeitrag lassen sich markieren.',a:'tax'},
    {t:'Handwerker und Arzt',x:'Bei Handwerkerrechnungen schlägt die App für Arbeitslohn und Anfahrt „Handwerkerleistungen“ vor, bei Arztrechnungen „Krankheitskosten“.',a:'tax'},
    {t:'Jahresliste',x:'Unter „Mehr → Steuer & Jahresexport“ siehst du die Summen je Art und lädst die Steuerliste als CSV. Sie ist eine Sammelhilfe, keine Steuerberatung.',a:'chart'},
    {t:'Jahresabschluss',x:'Ab dem 15. Dezember erinnert dich die App an den Jahresexport: Jahres-CSV, Steuerliste und Backup.',a:'backup'}]},
  verlauf:{title:'Verlauf und Suche',goto:'verlauf',steps:[
    {t:'12 Monate im Blick',x:'„Verlauf“ zeigt Fixkosten, Belege und Einnahmen der letzten 12 Monate. Tippe auf einen Monat, um ihn zu öffnen.',a:'chart'},
    {t:'Nach Kategorie',x:'Über „Anzeigen“ siehst du nur eine Kategorie, etwa wie sich deine Ausgaben für Essen entwickeln.',a:'chart'},
    {t:'Suchen',x:'Die Suche findet Positionen in allen Belegen und rechnet die Treffer zusammen, etwa: Wie viel habe ich dieses Jahr für Kaffee ausgegeben?',a:'learn'}]},
  sicherheit:{title:'Backup, Sperre und Updates',goto:'mehr',steps:[
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
  if(goto&&t){if(t.anchor)ui.jumpTo=t.anchor;if(ui.tab!==t.goto)go(t.goto);else{render();if(t.anchor){const n=document.getElementById(t.anchor);ui.jumpTo='';if(n)n.scrollIntoView({block:'start'})}}}
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
  let h=storageOk?'':`<div class="note bad"><b>Speichern ist blockiert.</b> Änderungen gehen beim Schließen verloren. Prüfe, ob der Speicher des Handys voll ist, und sichere deine Daten unter „Mehr“.</div>`;
  if(ui.updateAvail) h+=`<div class="note update" role="status"><b>Neue Version ${esc(ui.updateAvail)} verfügbar.</b> ${ui.draft?'Speichere oder verwirf zuerst deinen Beleg, sonst geht er verloren.':'Deine Daten bleiben erhalten.'}${getLock()?' Danach fragt die App einmal nach deiner PIN.':''}
    <div class="row" style="margin-top:8px"><button class="primary" data-act="app-reload">Jetzt laden</button><button class="ghost" data-act="update-later">Später</button></div></div>`;
  h+=ui.tab==='beleg'?vBeleg():ui.tab==='fixkosten'?vFixed():ui.tab==='verlauf'?vVerlauf():ui.tab==='mehr'?vMehr():vMonat();
  if(ui.tut)h+=vTut();
  main.innerHTML=h;
  if(ui.slideDir){const c='slide-'+ui.slideDir;ui.slideDir=null;main.classList.remove('slide-l','slide-r');if(!reduceMotion()){void main.offsetWidth;main.classList.add(c)}}
  document.documentElement.classList.toggle('tut-open',!!ui.tut);
  if(ui.tut){const c=document.getElementById('tut-card');if(c)c.focus({preventScroll:true})}
}
function go(tab){if(location.hash!=='#'+tab){location.hash='#'+tab}else render()}
function route(){const t=(location.hash||'').slice(1);ui.err='';ui.tab=TABS.includes(t)?t:'monat';render();
  if(ui.jumpTo){const n=document.getElementById(ui.jumpTo);ui.jumpTo='';if(n)setTimeout(()=>n.scrollIntoView({block:'start'}),0)}}
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
  if(d.refund)rec.refund=true;if(d.refOf)rec.refOf=d.refOf;
  if(!d.refund&&d.open){rec.open=true;rec.due=d.due||''}
  const ix=state.receipts.findIndex(r=>r.id===rec.id);
  if(ix>=0)state.receipts[ix]=rec;else state.receipts.push(rec);
  persist();
  if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}
  let tplMsg='';if(d.asTemplate&&!d.refund){tplMsg=addTemplate(rec)?' · Vorlage gemerkt':'';persist()}
  ui.draft=null;ui.paste='';ui.err='';ui.dup=null;ui.dupOk=false;ui.ym=rec.date.slice(0,7);ui.open=rec.id;
  const msg=(d.refund?'Retoure gespeichert: ':'Beleg gespeichert: ')+fmt(rTotal(rec))+(learned?` · ${learned} ${learned===1?'Zuordnung':'Zuordnungen'} gelernt`:'')+tplMsg;
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
function monthRow(ym){const s=monthStats(ym);return [ymLabel(ym),csvNum(s.inc),csvNum(s.out),csvNum(s.fixOut),csvNum(s.varOut),csvNum(s.saved),csvNum(s.inc-s.out-s.saved),...state.categories.map(c=>csvNum(s.by[c.id]||0))]}
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
    rows=[['Datum','Händler','Position','Art','Betrag']];
    tx.rows.forEach(r=>rows.push([fmtD(r.date),r.merchant,r.name,TAXKINDS[r.kind]||r.kind,csvNum(r.amount)]));
    rows.push([]);Object.entries(TAXKINDS).forEach(([k,v])=>rows.push(['','','Summe',v,csvNum(tx.by[k]||0)]));rows.push(['','','Gesamt','',csvNum(tx.total)]);
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
function vTaxYear(){
  const y=ui.taxYear,tx=taxYear(y),ye=state.yearExport[y]||{};
  const yd=yearDue();
  return `<h2 id="steuer">Steuer & Jahresexport</h2>
  <label class="f" for="tax-year" style="margin-bottom:10px">Jahr<select id="tax-year">${dataYears().map(v=>`<option value="${v}"${v===y?' selected':''}>${v}</option>`).join('')}</select></label>
  <div class="box">
    <b>Steuerlich absetzbar ${y}</b>
    <div class="lines">${Object.entries(TAXKINDS).map(([k,v])=>`<div><span class="n">${v}</span><span></span><span class="num">${fmt(tx.by[k]||0)}</span></div>`).join('')}
      <div style="border-top:1px dashed var(--line);padding-top:4px"><span class="n"><b>Gesamt</b> <span class="muted">(${tx.rows.length} Positionen)</span></span><span></span><b class="num">${fmt(tx.total)}</b></div></div>
    <p class="muted small" style="margin:0">Markiere Positionen beim Prüfen eines Belegs oder bei Fixkosten mit „§“. Die Liste ist eine Hilfe für die Steuererklärung, keine Steuerberatung.</p>
    <p class="muted small" style="margin:0">Handwerkerleistungen: Absetzbar sind nur Arbeits-, Fahrt- und Maschinenkosten, nicht das Material, und nur bei Überweisung. Krankheitskosten wirken erst über der zumutbaren Belastung.</p>
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
    case 'month':ui.ym=addMonths(ui.ym,+b.dataset.d);ui.flash='';ui.open=null;if(['beleg','mehr'].includes(ui.tab))go('monat');else render();break;
    case 'goto':ui.ym=b.dataset.ym;go('monat');break;
    case 'remove-examples':state.receipts=state.receipts.filter(r=>!r.example);state.fixed=state.fixed.filter(f=>!f.example);
      {const exg=state.goals.filter(g=>g.example).map(g=>g.id);state.goals=state.goals.filter(g=>!g.example);state.deposits=state.deposits.filter(d=>!d.example&&!exg.includes(d.goalId))}persist();ui.flash='Beispieldaten entfernt. Trag als Erstes deine Einnahmen und Fixkosten ein.';render();break;
    case 'toggle':ui.open=ui.open===id?null:id;ui.confirmDel=null;render();break;
    case 'del':ui.confirmDel=id;render();break;
    case 'del-no':ui.confirmDel=null;render();break;
    case 'del-yes':state.receipts=state.receipts.filter(r=>r.id!==id);persist();ui.confirmDel=null;ui.flash='Beleg gelöscht.';render();break;
    case 'edit':{const r=state.receipts.find(x=>x.id===id);if(!r)break;
      const m=state.rules.merchants[normKey(r.merchant)];
      ui.draft={id:r.id,refund:!!r.refund,refOf:r.refOf,merchant:r.merchant,date:r.date,total:null,always:!!(m&&m.always),open:!!r.open,due:r.due||'',
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
    case 'show-items':if(ui.draft&&ui.draft.collapsed){ui.draft.items=ui.draft.collapsed;ui.draft.collapsed=null;render()}break;
    case 'total-only':{const d=ui.draft;if(!d||d.total==null)break;const cs={};d.items.forEach(x=>{if(x.cat)cs[x.cat]=(cs[x.cat]||0)+Math.abs(toNum(x.amount)||0)});
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
    case 'add-row':d.items.push({name:'',amount:'',cat:'',src:'',flag:true});render();{const n=document.getElementById('n-'+(d.items.length-1));if(n)n.focus()}break;
    case 'del-row':d.items.splice(i,1);if(!d.items.length)d.items.push({name:'',amount:'',cat:'',src:'',flag:true});render();break;
    case 'add-diff':{const sum=d.items.reduce((s,x)=>s+(toNum(x.amount)||0),0);const df=r2(d.total-sum);
      d.items.push({name:'Nicht erkannte Position',amount:fmtIn(df),cat:'',src:'',flag:true,suggest:merchantInfo(d.merchant).cat||'sonstiges'});render();break}
    case 'accept':d.items[i].cat=d.items[i].suggest;d.items[i].src='Vorschlag übernommen';ui.err='';render();break;
    case 'accept-all':d.items.forEach(x=>{if(!x.cat&&x.suggest){x.cat=x.suggest;x.src='Vorschlag übernommen'}});ui.err='';render();break;
    case 'save':saveDraft();break;
    case 'save-dup':ui.dupOk=true;ui.dup=null;saveDraft();break;
    case 'cancel':ui.draft=null;ui.err='';ui.dup=null;if(ui.photoUrl){URL.revokeObjectURL(ui.photoUrl);ui.photoUrl=null}render();break;
    case 'jump':{ev.preventDefault();const n=document.getElementById(b.dataset.to);if(n)n.scrollIntoView({block:'start'});break}
    case 'goal-new':ui.goalNew=true;ui.goalEdit=null;ui.depositFor=null;ui.err='';render();{const n=document.getElementById('g-name');if(n){n.scrollIntoView({block:'center'});n.focus()}}break;
    case 'goal-edit':ui.goalEdit=id;ui.goalNew=false;ui.depositFor=null;ui.err='';render();{const n=document.getElementById('g-name');if(n)n.scrollIntoView({block:'center'})}break;
    case 'goal-cancel':ui.goalEdit=null;ui.goalNew=false;ui.err='';render();break;
    case 'goal-del':ui.confirmGoal=id;render();break;
    case 'goal-del-no':ui.confirmGoal=null;render();break;
    case 'goal-del-yes':state.goals=state.goals.filter(g=>g.id!==id);state.deposits=state.deposits.filter(d=>d.goalId!==id);ui.confirmGoal=null;persist();render();break;
    case 'goal-stop':{const g=state.goals.find(x=>x.id===id);if(g){const nx=addMonths(thisYM(),1);g.rates=(g.rates||[]).filter(r=>r.from!==nx);g.rates.push({from:nx,amount:0});persist()}render();break}
    case 'dep':ui.depositFor=id;ui.depositSign=+b.dataset.sign||1;ui.goalEdit=null;ui.goalNew=false;ui.err='';render();{const n=document.getElementById('dep-amount');if(n)n.focus()}break;
    case 'dep-cancel':ui.depositFor=null;ui.err='';render();break;
    case 'dep-del':state.deposits=state.deposits.filter(d=>d.id!==id);persist();render();break;
    case 'fedit':ui.fixedEdit=id;ui.err='';render();{const n=document.getElementById('fx-head');if(n)n.scrollIntoView({block:'start'})}break;
    case 'fcancel':ui.fixedEdit=null;ui.err='';render();break;
    case 'fdel':state.fixed=state.fixed.filter(f=>f.id!==id);if(ui.fixedEdit===id)ui.fixedEdit=null;persist();render();break;
    case 'rdel':{const t=b.dataset.type==='p'?state.rules.products:state.rules.merchants;delete t[b.dataset.key];persist();render();break}
    case 'cdel':ui.confirmCat=id;render();break;
    case 'cdel-no':ui.confirmCat=null;render();break;
    case 'cdel-yes':{const cid=ui.confirmCat;ui.confirmCat=null;if(!cid||cid==='sonstiges'){render();break}
      state.categories=state.categories.filter(c=>c.id!==cid);
      const fix=o=>{if(o.cat===cid)o.cat='sonstiges'};state.fixed.forEach(fix);state.receipts.forEach(r=>r.items.forEach(fix));
      Object.keys(state.rules.products).forEach(k=>{if(state.rules.products[k]===cid)state.rules.products[k]='sonstiges'});
      Object.values(state.rules.merchants).forEach(fix);delete state.budgets[cid];persist();render();break}
    case 'csv-items':exportCsv('items');break;
    case 'csv-tax':exportCsv('tax',ui.taxYear);render();break;
    case 'year-csv':exportCsv('year',ui.taxYear);render();break;
    case 'year-backup':{const n=document.getElementById('bk-pw')||document.getElementById('bk-plain');ui.backupFor=ui.taxYear;if(n){n.scrollIntoView({block:'center'});n.focus()}break}
    case 'year-done':markYear(ui.taxYear,'csv');markYear(ui.taxYear,'tax');markYear(ui.taxYear,'backup');render();break;
    case 'year-go':ui.taxYear=+b.dataset.y;ui.flashNext='';ui.jumpTo='jahr';go('mehr');break;
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
  if(t.id==='rule-filter'){ui.ruleFilter=t.value;const c=document.getElementById('prod-list');if(c)c.innerHTML=prodList();return}
  if(t.id==='search'){ui.search=t.value;const c=document.getElementById('search-res');if(c)c.innerHTML=searchResults();return}
  if(!d)return;
  if(t.dataset.f==='merchant'){d.merchant=t.value;return}
  if(t.dataset.f==='date'){d.date=t.value;d.dateGuessed=false;return}
  if(t.dataset.f==='total'){const v=toNum(t.value);d.total=t.value.trim()&&!isNaN(v)?v:null;updateSums();return}
  if(t.dataset.row!=null&&t.dataset.k!=='cat'&&t.dataset.k!=='tax'){d.items[+t.dataset.row][t.dataset.k]=t.value;if(t.dataset.k==='amount')updateSums();return}
});
document.addEventListener('change',ev=>{
  const t=ev.target,d=ui.draft;
  if(t.dataset.tpl){const x=state.templates.find(q=>q.id===t.dataset.tpl);if(x&&t.value.trim()){x.name=t.value.trim().slice(0,40);persist()}return}
  if(t.id==='photo'){const f=t.files&&t.files[0];t.value='';runOCR(f);return}
  if(t.id==='tax-year'){ui.taxYear=+t.value;render();return}
  if(t.id==='chart-cat'){ui.chartCat=t.value;render();return}
  if(t.id==='use-budgets'){state.useBudgets=t.checked;persist();render();return}
  if(t.dataset.budget){const v=toNum(t.value);if(t.value.trim()&&!isNaN(v)&&v>0)state.budgets[t.dataset.budget]=r2(v);else delete state.budgets[t.dataset.budget];persist();t.value=state.budgets[t.dataset.budget]?fmtIn(state.budgets[t.dataset.budget]):'';return}
  if(t.id==='fx-kind'){ui.fixedKind=t.value;document.querySelectorAll('#fixed-form .outonly').forEach(n=>n.hidden=t.value==='in');return}
  if(t.dataset.rule){const k=t.dataset.key;if(t.dataset.rule==='p')state.rules.products[k]=t.value;else if(state.rules.merchants[k])state.rules.merchants[k].cat=t.value;persist();return}
  if(t.id==='bk-plain'){ui.plainBackup=t.checked;return}
  if(t.id==='import-file'&&t.files&&t.files[0]){const r=new FileReader();r.onload=()=>{const txt=String(r.result);let enc=false;try{enc=JSON.parse(txt).kassensturz==='backup-enc-1'}catch(e){}
    if(enc&&!val('import-pw')){ui.pendingImport=txt;ui.pendingEnc=true;ui.importMsg='Dieses Backup ist verschlüsselt. Gib das Passwort ein und tippe auf „Wiederherstellen“.';render();const n=document.getElementById('import-pw');if(n)n.focus()}
    else importAny(txt,val('import-pw'))};r.readAsText(t.files[0]);t.value='';return}
  if(!d)return;
  if(t.dataset.f==='merchant'){const before=JSON.stringify(d.items.map(i=>[i.cat,i.suggest]));reclassify();if(JSON.stringify(d.items.map(i=>[i.cat,i.suggest]))!==before)renderKeepFocus();return}
  if(t.dataset.f==='always'){d.always=t.checked;return}
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
  if(f.id==='unlock-form'){
    if(ui.lockUntil>Date.now())return;
    const pin=val('unlock-pin');
    pinOk(pin).then(ok=>{
      if(ok&&pin){ui.locked=false;ui.lockFails=0;ui.lockErr='';render();maybeTutorial();return}
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
    ui.fixedEdit=null;ui.fixedKind=kind;ui.err='';persist();render();return}
  if(f.id==='goal-form'){
    const name=val('g-name').trim(),tRaw=val('g-target').trim(),rRaw=val('g-rate').trim(),sRaw=val('g-start').trim();
    const target=tRaw?toNum(tRaw):0,rate=rRaw?toNum(rRaw):0,startAmt=sRaw?toNum(sRaw):0;
    if(!name){ui.err='Bitte gib dem Sparziel einen Namen.';render();return}
    if(isNaN(target)||target<0||isNaN(rate)||rate<0||isNaN(startAmt)||startAmt<0){ui.err='Beträge bitte als Zahl angeben, z. B. 150,00.';render();return}
    const ym=thisYM();let g=ui.goalEdit&&state.goals.find(x=>x.id===ui.goalEdit);
    if(g){g.name=name;g.target=r2(target);g.due=val('g-due');delete g.example;
      if(r2(rateFor(g,ym))!==r2(rate)){g.rates=(g.rates||[]).filter(r=>r.from!==ym);g.rates.push({from:ym,amount:r2(rate)})}}
    else{g={id:'g'+uid(),name,target:r2(target),due:val('g-due'),rates:rate>0?[{from:ym,amount:r2(rate)}]:[]};state.goals.push(g);
      if(startAmt>0)state.deposits.push({id:uid(),goalId:g.id,date:today(),amount:r2(startAmt),note:'Startguthaben'})}
    ui.goalEdit=null;ui.goalNew=false;ui.err='';persist();render();return}
  if(f.id==='deposit-form'){
    const a=toNum(val('dep-amount')),dt=val('dep-date')||today();
    if(isNaN(a)||a<=0){ui.err='Bitte einen Betrag angeben, z. B. 50,00.';render();return}
    state.deposits.push({id:uid(),goalId:f.dataset.goal,date:dt,amount:r2(a*ui.depositSign),note:ui.depositSign>0?'Einzahlung':'Entnahme'});
    ui.depositFor=null;ui.err='';persist();render();return}
  if(f.id==='cat-form'){
    const n=document.getElementById('cat-name').value.trim();if(!n)return;
    if(state.categories.some(c=>c.name.toLowerCase()===n.toLowerCase())){return}
    const palette=['#4f8a3c','#b5487a','#c97a1a','#3c7fb8','#6a4fb5','#2a9a8a','#a15c3a'];
    state.categories.splice(state.categories.length-1,0,{id:'c'+uid(),name:n,color:palette[state.categories.length%palette.length]});
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
    const img=await c.match('shared-image'),txt=await c.match('shared-text');
    await c.delete('shared-image');await c.delete('shared-text');
    if(img){const blob=await img.blob();runOCR(new File([blob],'geteilt',{type:blob.type||'image/jpeg'}));return}
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
function maybeTutorial(){if(!state.prefs.tutorialDone&&!ui.locked&&!ui.tut){ui.tut={topic:'start',i:0};render()}}
ui.locked=!!getLock();
{const q=new URLSearchParams(location.search);const a=q.get('action');
  if(a==='photo'||a==='text'){ui.action=a;history.replaceState(null,'',location.pathname+'#beleg')}}
route();
maybeTutorial();
if(ui.action){const n=document.getElementById(ui.action==='photo'?'photo-btn':'bon-text');if(n&&!ui.locked)n.focus()}
checkShared();
})();
