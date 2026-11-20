// Kassensturz – KI-Texterkennung im Hintergrund-Prozess (Web Worker)
// Das Rechnen läuft hier getrennt von der Oberfläche: Die App bleibt beim Start und beim Lesen bedienbar.
// Bekommt nur Bildpunkte vom eigenen Gerät und schickt Kästen bzw. Text zurück. Keine Verbindung nach außen.
'use strict';
const BASE=new URL('ki/',self.location.href).href;
const FILES={det:'pp-ocrv5_mobile_det.onnx',rec:'latin_pp-ocrv5_mobile_rec.onnx',dict:'ppocrv5_latin_dict.txt'};
const MEAN=[0.485,0.456,0.406],STD=[0.229,0.224,0.225];
let det=null,rec=null,ch=null,ready=null;

function load(){
  if(ready)return ready;
  ready=(async()=>{
    importScripts(BASE+'ort.wasm.min.js');
    ort.env.wasm.wasmPaths=BASE;
    ort.env.wasm.numThreads=1;   // ohne besondere Server-Einstellungen sind keine Rechen-Threads möglich
    ort.env.logLevel='error';
    const opt={executionProviders:['wasm'],graphOptimizationLevel:'all'};
    const [d,r,dict]=await Promise.all([
      ort.InferenceSession.create(BASE+FILES.det,opt),
      ort.InferenceSession.create(BASE+FILES.rec,opt),
      fetch(BASE+FILES.dict).then(x=>{if(!x.ok)throw new Error('dict');return x.text()})]);
    const lines=dict.split(/\r?\n/);if(lines.length&&lines[lines.length-1]==='')lines.pop();
    det=d;rec=r;ch=['',...lines,' '];   // 0 = Lücke, dann Zeichenliste, zuletzt Leerzeichen
    return true;
  })().catch(e=>{ready=null;throw e});
  return ready;
}

// Schritt 1: Textzeilen finden (Wahrscheinlichkeitskarte → zusammenhängende Flächen → Kästen)
async function detect({d,w,h,W,H}){
  const n=w*h,inp=new Float32Array(3*n);
  for(let i=0;i<n;i++){const r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;   // Reihenfolge wie beim Training: Blau, Grün, Rot
    inp[i]=(b-MEAN[0])/STD[0];inp[n+i]=(g-MEAN[1])/STD[1];inp[2*n+i]=(r-MEAN[2])/STD[2]}
  const out=await det.run({x:new ort.Tensor('float32',inp,[1,3,h,w])});
  const p=out[Object.keys(out)[0]].data;
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

// Schritt 2: Zeilen lesen (48 Pixel hoch, gebündelt nach Breite)
async function recognize({crops}){
  const order=crops.map((c,i)=>i).filter(i=>crops[i]).sort((a,b)=>crops[a].w-crops[b].w),res=new Array(crops.length).fill(null);
  // Nur ähnlich lange Zeilen gemeinsam lesen: Auffüllen kurzer Zeilen kostet Zeit und kann das Ergebnis verfälschen
  const groups=[];for(const i of order){const g=groups[groups.length-1];if(g&&g.length<12&&crops[i].w<=crops[g[0]].w*1.25)g.push(i);else groups.push([i])}
  for(const idx of groups){
    const mw=Math.max(...idx.map(i=>crops[i].w)),plane=48*mw,inp=new Float32Array(idx.length*3*plane);
    idx.forEach((i,j)=>{const c=crops[i],o=j*3*plane;
      for(let y=0;y<48;y++)for(let xx=0;xx<c.w;xx++){const p=(y*c.w+xx)*4,t=y*mw+xx;
        inp[o+t]=c.d[p]/127.5-1;inp[o+plane+t]=c.d[p+1]/127.5-1;inp[o+2*plane+t]=c.d[p+2]/127.5-1}});
    const out=await rec.run({x:new ort.Tensor('float32',inp,[idx.length,3,48,mw])}),t=out[Object.keys(out)[0]],[, T, C]=t.dims,a=t.data;
    idx.forEach((i,j)=>{let txt='',conf=0,nc=0,prev=0;
      for(let k=0;k<T;k++){const o=(j*T+k)*C;let bi=0,bv=-1;for(let c=0;c<C;c++)if(a[o+c]>bv){bv=a[o+c];bi=c}
        if(bi&&bi!==prev){txt+=ch[bi]||'';conf+=bv;nc++}prev=bi}
      res[i]={t:txt,c:nc?conf/nc:0}});
  }
  return res;
}

// Nachrichten der App: immer nur eine Aufgabe gleichzeitig, der Reihe nach
let queue=Promise.resolve();
self.onmessage=e=>{
  const {id,cmd,arg}=e.data;
  queue=queue.then(async()=>{
    try{
      await load();
      const r=cmd==='det'?await detect(arg):cmd==='rec'?await recognize(arg):true;
      self.postMessage({id,ok:true,r});
    }catch(err){self.postMessage({id,ok:false,err:String(err&&err.message||err)})}
  });
};
