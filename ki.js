// Kassensturz – KI-Texterkennung (PaddleOCR PP-OCRv5, kleine Handy-Modelle)
// Läuft komplett im Browser auf dem Gerät (ONNX Runtime, WebAssembly). Fotos und Text verlassen das Gerät nicht.
// Die Dateien liegen im Ordner ki/ der App und werden einmalig geladen, danach dauerhaft im Gerät gespeichert.
'use strict';
const KI_BASE='ki/';
const KI_FILES={det:'pp-ocrv5_mobile_det.onnx',rec:'latin_pp-ocrv5_mobile_rec.onnx',dict:'ppocrv5_latin_dict.txt'};
const KI={ready:null,failed:false,loaded:false};

// Darf die KI genutzt bzw. geladen werden?
function kiEnabled(){return state.prefs.ki!==false&&typeof WebAssembly==='object'&&typeof Worker==='function'&&!KI.failed}
// Mobiles Netz oder Datensparmodus: große Dateien erst im WLAN laden
function kiCellular(){try{const c=navigator.connection;return !!(c&&(c.saveData||c.type==='cellular'))}catch(e){return false}}
// Liegen die Modelle schon im Gerät?
async function kiCached(){
  try{if(!('caches' in window))return false;const c=await caches.open(KI_CACHE);
    const hits=await Promise.all(Object.values(KI_FILES).map(f=>c.match(new URL(KI_BASE+f,location.href).href)));return hits.every(Boolean)}catch(e){return false}
}
const KI_CACHE='kassensturz-ki-v1';

// Die KI rechnet in einem eigenen Hintergrund-Prozess (ki-worker.js), damit die Oberfläche flüssig bleibt
let kiWorker=null,kiMsgId=0;const kiWait=new Map();
function kiCall(cmd,arg,transfer){
  return new Promise((res,rej)=>{const id=++kiMsgId;kiWait.set(id,{res,rej});kiWorker.postMessage({id,cmd,arg},transfer||[])});
}
function kiLoad(){
  if(KI.ready)return KI.ready;
  KI.ready=(async()=>{
    kiWorker=new Worker('ki-worker.js');
    kiWorker.onmessage=e=>{const m=e.data,w=kiWait.get(m.id);if(!w)return;kiWait.delete(m.id);m.ok?w.res(m.r):w.rej(new Error(m.err))};
    kiWorker.onerror=e=>{e.preventDefault&&e.preventDefault();const err=new Error('worker');kiWait.forEach(w=>w.rej(err));kiWait.clear()};
    await kiCall('load');
    KI.loaded=true;return true;
  })().catch(e=>{KI.ready=null;KI.failed=true;try{kiWorker&&kiWorker.terminate()}catch(x){}kiWorker=null;throw e});
  return KI.ready;
}
// Im Hintergrund laden, sobald die App läuft (nicht im mobilen Netz)
function kiPrefetch(){
  if(!kiEnabled()||KI.ready||kiCellular())return;
  const go=()=>{KI.loading=true;return kiLoad().finally(()=>{KI.loading=false})}
  const run=()=>go().then(()=>{KI.loadErr=false;if(location.hash==='#beleg'||location.hash==='')render()}).catch(()=>{KI.failed=false;KI.loadErr=true;if(location.hash==='#beleg')render()});
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:8000});else setTimeout(run,3000);
}

// Schritt 1: Textzeilen finden. Hier nur das Bild auf passende Größe bringen, gerechnet wird im Hintergrund.
async function kiDetect(src,W,H){
  let k=Math.min(1,960/W);if(W*k<576)k=960/W;          // schmale Bons hochskalieren, breite verkleinern
  if(W*H*k*k>3e6)k=Math.sqrt(3e6/(W*H));
  const w=Math.max(32,Math.round(W*k/32)*32),h=Math.max(32,Math.round(H*k/32)*32);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(src,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data;
  return kiCall('det',{d,w,h,W,H},[d.buffer]);
}
// Schritt 2: Zeilen ausschneiden (48 Pixel hoch) und im Hintergrund lesen lassen
async function kiRecognize(src,W,H,boxes){
  const crops=[],tr=[];
  for(const b of boxes){
    const x0=Math.max(0,b[0]),y0=Math.max(0,b[1]),x1=Math.min(W,b[2]),y1=Math.min(H,b[3]);
    if(x1-x0<3||y1-y0<3){crops.push(null);continue}
    const nw=Math.max(8,Math.min(1600,Math.round((x1-x0)*48/(y1-y0))));
    const c=document.createElement('canvas');c.width=nw;c.height=48;const x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(src,x0,y0,x1-x0,y1-y0,0,0,nw,48);const d=x.getImageData(0,0,nw,48).data;crops.push({w:nw,d});tr.push(d.buffer);
  }
  return kiCall('rec',{crops},tr);
}
// Schritt 3: Kästen zu Zeilen ordnen (gleiche Höhe = gleiche Zeile, große Lücke = Spaltenabstand)
function kiLines(boxes,texts){
  const it=boxes.map((b,i)=>({b,r:texts[i]})).filter(z=>z.r&&z.r.t.trim()).sort((a,b)=>(a.b[1]+a.b[3])-(b.b[1]+b.b[3]));
  const rows=[];
  for(const z of it){const cy=(z.b[1]+z.b[3])/2,hh=z.b[3]-z.b[1];
    const r=rows.find(r=>Math.abs(r.cy-cy)<0.5*Math.min(hh,r.h));
    if(r){r.it.push(z);r.cy=(r.cy*(r.it.length-1)+cy)/r.it.length}else rows.push({cy,h:hh,it:[z]})}
  rows.sort((a,b)=>a.cy-b.cy);
  const out=[],low=new Set();let hs=[];
  rows.forEach(r=>{r.it.sort((a,b)=>a.b[0]-b.b[0]);let s='';
    r.it.forEach((z,k)=>{if(k){const gap=z.b[0]-r.it[k-1].b[2];s+=gap>r.h*1.2?'   ':' '}s+=z.r.t});
    if(r.it.some(z=>z.r.c<0.8))low.add(s.trim());out.push(s);hs.push(r.h)});
  hs.sort((a,b)=>a-b);
  return {text:out.join('\n'),low,h:hs.length?hs[hs.length>>1]:0};
}
// Steht die KI für diesen Bon bereit? Lädt sie bei Bedarf (nicht im mobilen Netz, außer sie liegt schon im Gerät)
async function kiUsable(){
  if(!kiEnabled())return false;
  if(KI.loaded)return true;
  if(kiCellular()&&!(await kiCached()))return false;
  try{setProgress((await kiCached())?'Starte KI-Texterkennung …':'Lade KI-Texterkennung (einmalig, ca. 24 MB) …',0.05);await kiLoad();return true}catch(e){KI.failed=false;return false}
}
// Gesamter Ablauf für ein vorbereitetes Bild (gleiche Bildaufbereitung wie die bisherige Texterkennung)
// Immer nur ein Bon gleichzeitig in der KI (Vorlesen im Hintergrund und Lesen im Vordergrund warten aufeinander)
let kiBusy=Promise.resolve();
function kiRead(variants){const run=kiBusy.then(()=>kiReadNow(variants));kiBusy=run.catch(()=>{});return run}
async function kiReadNow(variants){
  await kiLoad();
  const src=variants.gray,W=src.width,H=src.height;
  setProgress('Suche Textzeilen …',0.15);await new Promise(r=>setTimeout(r,20));
  const boxes=await kiDetect(src,W,H);
  setProgress('Lese Text mit KI …',0.35);
  // Von oben nach unten in Häppchen lesen. Sobald Positionen und Summe aufgehen und das Datum gefunden ist,
  // aufhören: Darunter stehen meist nur Kassen-Code, Signatur, Adresse und Grüße.
  const order=boxes.map((b,i)=>i).sort((a,b)=>(boxes[a][1]+boxes[a][3])-(boxes[b][1]+boxes[b][3]));
  const texts=new Array(boxes.length).fill(null),seen=[];let o=null,p=null,stopped=false;
  for(let s=0;s<order.length;){
    let e=Math.min(order.length,s+(s?16:24));
    // Häppchen nicht mitten in einer Zeile enden lassen
    while(e<order.length){const a=boxes[order[e-1]],b=boxes[order[e]];if(Math.abs((a[1]+a[3])-(b[1]+b[3]))/2<0.5*Math.min(a[3]-a[1],b[3]-b[1]))e++;else break}
    const part=order.slice(s,e),r=await kiRecognize(src,W,H,part.map(i=>boxes[i]));
    part.forEach((i,k)=>{texts[i]=r[k];seen.push(i)});s=e;
    setProgress('Lese Text mit KI …',0.35+0.6*s/order.length);
    o=kiLines(seen.map(i=>boxes[i]),seen.map(i=>texts[i]));p=parseReceipt(o.text,{low:o.low});
    if(s<order.length&&verified(p)&&p.dateFound){stopped=true;break}
  }
  if(!o){o=kiLines([],[]);p=parseReceipt('',{low:o.low})}
  const res={text:o.text,p,sc:scoreParse(p)+0.5,engine:'ki',kiRows:`${seen.length}/${boxes.length}${stopped?' (früher fertig)':''}`};
  if(variants.q)res.textH=o.h/(variants.q.scale||1);
  return res;
}
// Kurzer Stand für die Anzeige
function kiStatus(){
  if(!kiEnabled())return '';
  if(KI.loaded)return 'ready';
  if(KI.loadErr)return '';
  if(KI.loading)return 'loading';
  if(kiCellular())return 'wait';
  return 'loading';
}
