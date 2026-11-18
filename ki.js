// Kassensturz – KI-Texterkennung (PaddleOCR PP-OCRv5, kleine Handy-Modelle)
// Läuft komplett im Browser auf dem Gerät (ONNX Runtime, WebAssembly). Fotos und Text verlassen das Gerät nicht.
// Die Dateien liegen im Ordner ki/ der App und werden einmalig geladen, danach dauerhaft im Gerät gespeichert.
'use strict';
const KI_BASE='ki/';
const KI_FILES={det:'pp-ocrv5_mobile_det.onnx',rec:'latin_pp-ocrv5_mobile_rec.onnx',dict:'ppocrv5_latin_dict.txt'};
const KI={ready:null,det:null,rec:null,ch:null,failed:false,loaded:false};

// Darf die KI genutzt bzw. geladen werden?
function kiEnabled(){return state.prefs.ki!==false&&typeof WebAssembly==='object'&&!KI.failed}
// Mobiles Netz oder Datensparmodus: große Dateien erst im WLAN laden
function kiCellular(){try{const c=navigator.connection;return !!(c&&(c.saveData||c.type==='cellular'))}catch(e){return false}}
// Liegen die Modelle schon im Gerät?
async function kiCached(){
  try{if(!('caches' in window))return false;const c=await caches.open(KI_CACHE);
    const hits=await Promise.all(Object.values(KI_FILES).map(f=>c.match(new URL(KI_BASE+f,location.href).href)));return hits.every(Boolean)}catch(e){return false}
}
const KI_CACHE='kassensturz-ki-v1';

function kiLoad(){
  if(KI.ready)return KI.ready;
  KI.ready=(async()=>{
    if(!window.ort)await new Promise((res,rej)=>{const s=document.createElement('script');s.src=KI_BASE+'ort.wasm.min.js';s.onload=res;s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)});
    const ort=window.ort;
    ort.env.wasm.wasmPaths=new URL(KI_BASE,location.href).href;
    ort.env.wasm.numThreads=1;   // ohne besondere Server-Einstellungen sind keine Rechen-Threads möglich
    ort.env.logLevel='error';
    const opt={executionProviders:['wasm'],graphOptimizationLevel:'all'};
    const [det,rec,dict]=await Promise.all([
      ort.InferenceSession.create(KI_BASE+KI_FILES.det,opt),
      ort.InferenceSession.create(KI_BASE+KI_FILES.rec,opt),
      fetch(KI_BASE+KI_FILES.dict).then(r=>{if(!r.ok)throw new Error('dict');return r.text()})]);
    const lines=dict.split(/\r?\n/);if(lines.length&&lines[lines.length-1]==='')lines.pop();
    KI.det=det;KI.rec=rec;KI.ch=['',...lines,' '];KI.loaded=true;   // 0 = Lücke, dann Zeichenliste, zuletzt Leerzeichen
    return true;
  })().catch(e=>{KI.ready=null;KI.failed=true;throw e});
  return KI.ready;
}
// Im Hintergrund laden, sobald die App läuft (nicht im mobilen Netz)
function kiPrefetch(){
  if(!kiEnabled()||KI.ready||kiCellular())return;
  const go=()=>{KI.loading=true;return kiLoad().finally(()=>{KI.loading=false})}
  const run=()=>go().then(()=>{KI.loadErr=false;if(location.hash==='#beleg'||location.hash==='')render()}).catch(()=>{KI.failed=false;KI.loadErr=true;if(location.hash==='#beleg')render()});
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:8000});else setTimeout(run,3000);
}

const KI_MEAN=[0.485,0.456,0.406],KI_STD=[0.229,0.224,0.225];
// Schritt 1: Textzeilen finden (Wahrscheinlichkeitskarte → zusammenhängende Flächen → Kästen)
async function kiDetect(src,W,H){
  const ort=window.ort;
  let k=Math.min(1,960/W);if(W*k<576)k=960/W;          // schmale Bons hochskalieren, breite verkleinern
  if(W*H*k*k>3e6)k=Math.sqrt(3e6/(W*H));
  const w=Math.max(32,Math.round(W*k/32)*32),h=Math.max(32,Math.round(H*k/32)*32);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(src,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data,n=w*h,inp=new Float32Array(3*n);
  for(let i=0;i<n;i++){const r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;   // Reihenfolge wie beim Training: Blau, Grün, Rot
    inp[i]=(b-KI_MEAN[0])/KI_STD[0];inp[n+i]=(g-KI_MEAN[1])/KI_STD[1];inp[2*n+i]=(r-KI_MEAN[2])/KI_STD[2]}
  const out=await KI.det.run({x:new ort.Tensor('float32',inp,[1,3,h,w])});
  const p=out[Object.keys(out)[0]].data;
  // zusammenhängende Flächen über 0,3
  const lab=new Int32Array(n),stack=new Int32Array(n),boxes=[];let id=0;
  for(let s=0;s<n;s++){
    if(lab[s]||p[s]<=0.3)continue;
    id++;let sp=0,cnt=0,sum=0,x0=w,y0=h,x1=0,y1=0;stack[sp++]=s;lab[s]=id;
    while(sp){const q=stack[--sp],qx=q%w,qy=(q-qx)/w;cnt++;sum+=p[q];
      if(qx<x0)x0=qx;if(qx>x1)x1=qx;if(qy<y0)y0=qy;if(qy>y1)y1=qy;
      if(qx>0&&!lab[q-1]&&p[q-1]>0.3){lab[q-1]=id;stack[sp++]=q-1}
      if(qx<w-1&&!lab[q+1]&&p[q+1]>0.3){lab[q+1]=id;stack[sp++]=q+1}
      if(qy>0&&!lab[q-w]&&p[q-w]>0.3){lab[q-w]=id;stack[sp++]=q-w}
      if(qy<h-1&&!lab[q+w]&&p[q+w]>0.3){lab[q+w]=id;stack[sp++]=q+w}}
    if(cnt<6||sum/cnt<0.6)continue;
    const bw=x1-x0+1,bh=y1-y0+1,off=cnt*1.5/(2*(bw+bh));   // Kasten um den Textkern erweitern
    boxes.push([(x0-off)*W/w,(y0-off)*H/h,(x1+1+off)*W/w,(y1+1+off)*H/h]);
  }
  return boxes;
}
// Schritt 2: Jede Zeile lesen (48 Pixel hoch, gebündelt nach Breite)
async function kiRecognize(src,W,H,boxes){
  const ort=window.ort,crops=[];
  for(const b of boxes){
    const x0=Math.max(0,b[0]),y0=Math.max(0,b[1]),x1=Math.min(W,b[2]),y1=Math.min(H,b[3]);
    if(x1-x0<3||y1-y0<3){crops.push(null);continue}
    const nw=Math.max(8,Math.min(1600,Math.round((x1-x0)*48/(y1-y0))));
    const c=document.createElement('canvas');c.width=nw;c.height=48;const x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(src,x0,y0,x1-x0,y1-y0,0,0,nw,48);crops.push({w:nw,d:x.getImageData(0,0,nw,48).data});
  }
  const order=crops.map((c,i)=>i).filter(i=>crops[i]).sort((a,b)=>crops[a].w-crops[b].w),res=new Array(crops.length).fill(null);
  for(let s=0;s<order.length;s+=12){
    const idx=order.slice(s,s+12),mw=Math.max(...idx.map(i=>crops[i].w)),plane=48*mw,inp=new Float32Array(idx.length*3*plane);
    idx.forEach((i,j)=>{const c=crops[i],o=j*3*plane;
      for(let y=0;y<48;y++)for(let xx=0;xx<c.w;xx++){const p=(y*c.w+xx)*4,t=y*mw+xx;
        inp[o+t]=c.d[p]/127.5-1;inp[o+plane+t]=c.d[p+1]/127.5-1;inp[o+2*plane+t]=c.d[p+2]/127.5-1}});
    const out=await KI.rec.run({x:new ort.Tensor('float32',inp,[idx.length,3,48,mw])}),t=out[Object.keys(out)[0]],[, T, C]=t.dims,a=t.data;
    idx.forEach((i,j)=>{let txt='',conf=0,nc=0,prev=0;
      for(let k=0;k<T;k++){const o=(j*T+k)*C;let bi=0,bv=-1;for(let c=0;c<C;c++)if(a[o+c]>bv){bv=a[o+c];bi=c}
        if(bi&&bi!==prev){txt+=KI.ch[bi]||'';conf+=bv;nc++}prev=bi}
      res[i]={t:txt,c:nc?conf/nc:0}});
    setProgress('Lese Text mit KI …',0.35+0.6*Math.min(1,(s+12)/order.length));
  }
  return res;
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
async function kiRead(variants){
  await kiLoad();
  const src=variants.gray,W=src.width,H=src.height;
  setProgress('Suche Textzeilen …',0.15);await new Promise(r=>setTimeout(r,20));
  const boxes=await kiDetect(src,W,H);
  setProgress('Lese Text mit KI …',0.35);
  const texts=await kiRecognize(src,W,H,boxes);
  const o=kiLines(boxes,texts),p=parseReceipt(o.text,{low:o.low});
  const res={text:o.text,p,sc:scoreParse(p)+0.5,engine:'ki'};
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
