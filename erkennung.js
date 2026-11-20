// Kassensturz – Belegerkennung: Text auswerten, Texterkennung, PDF und QR-Codes
// Die Dateien werden in dieser Reihenfolge geladen und teilen sich ihre Namen:
// daten.js → erkennung.js → ansichten.js → app.js
'use strict';
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
  l=l.replace(/\b(\d{1,2})\s?\.\s?(\d{1,2})\s?\.\s?((?:19|20)\d{2})\b/g,'$1.$2.$3');   // „12. 11 . 2026“ → „12.11.2026“
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
  lines.forEach((l,i)=>{if(i&&/^bezeichnung/i.test(l.replace(/\s+/g,''))&&/artikel|menge|einzel/i.test(lines[i-1].replace(/\s+/g,'')))nameBelow=headBelow=true});   // auch „Beze ichnung“, „Art ike Inr“
  // Gelernt: Bei diesem Händler steht der Name unter der Preiszeile
  {const lay=merchant&&typeof state!=='undefined'&&state.rules&&state.rules.layout&&state.rules.layout[normKey(merchant)];if(lay&&lay.below)nameBelow=headBelow=true}
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
  return {merchant,below:nameBelow,date:dt?dt.iso:'',dateFound:!!dt,total,totalVotes,items,gross,fix:gross?null:fix,due:findDue(lines,dt&&dt.iso),type:merchantType(merchant)};
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
// Aus Korrekturen gelernt (je Händler): verlesene Namen ersetzen, Störzeilen weglassen
function learnedFor(merchant){const mk=normKey(merchant||'');return {fix:(state.rules.fix||{})[mk]||{},drop:(state.rules.drop||{})[mk]||{}}}
function makeDraft(parsed){
  const mi=merchantInfo(parsed.merchant),lf=learnedFor(parsed.merchant);
  const orig={merchant:parsed.merchant,date:parsed.date||'',total:parsed.total,items:parsed.items.map(i=>[i.name,i.amount])};
  let items=parsed.items.filter(i=>!lf.drop[normKey(i.name)]).map(i=>{const f=lf.fix[normKey(i.name)];return f?{...i,o:i.name,name:f,lfix:true}:{...i,o:i.name}});
  if(!items.length) items=[{name:parsed.merchant||'',amount:parsed.total||0}];
  const type=parsed.type||merchantType(parsed.merchant);
  const fx=fixHintFor(parsed.merchant,type);
  const mkItems=list=>list.map(it=>{const sk=it.lfix?null:similarKnown(it.name,parsed.merchant);if(sk)it={...it,name:sk.name,sim:true};const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      if(!tax&&c.cat==='versich')tax=taxSuggest(it.name,c.cat);
      return {name:it.name,o:it.o||'',amount:fmtIn(it.amount),cat:c.cat,src:(it.sim||it.lfix)&&c.src?c.src+(it.lfix?' · Lesefehler korrigiert':' · Name korrigiert'):c.src,flag:c.flag,suggest:c.suggest,tax,check:!!it.check}});
  const sum=r2(items.reduce((a,x)=>a+x.amount,0));
  let collapsed=null;
  // Positionen gehen nicht auf, aber der Laden hat nur eine Kategorie: sicheren Gesamtbetrag nehmen
  if(parsed.total!=null&&Math.abs(sum-parsed.total)>=0.01&&mi.single&&parsed.items.length){
    collapsed=mkItems(items);items=[{name:parsed.merchant||'Einkauf',amount:parsed.total}];
  }
  return {id:null,refund:false,merchant:parsed.merchant,date:parsed.date||today(),dateGuessed:!parsed.dateFound,total:parsed.total,always:false,
    gross:parsed.gross||null,open:!!parsed.due,due:parsed.due||'',fixHint:fx?fx.id:null,collapsed,
    items:items.map(it=>{const sk=it.lfix?null:similarKnown(it.name,parsed.merchant);if(sk)it={...it,name:sk.name,sim:true};const c=classify(it.name,mi);const k=normKey(it.name);
      let tax=state.rules.tax[k]||'';
      if(!tax&&type==='craft'&&CRAFT_LABOR.test(k))tax='handwerker';
      if(!tax&&type==='medical')tax='krankheit';
      if(!tax&&c.cat==='versich')tax=taxSuggest(it.name,c.cat);
      return {name:it.name,o:it.o||'',amount:fmtIn(it.amount),cat:c.cat,src:(it.sim||it.lfix)&&c.src?c.src+(it.lfix?' · Lesefehler korrigiert':' · Name korrigiert'):c.src,flag:c.flag,suggest:c.suggest,tax,check:!!it.check}}),pages:parsed.pages||0,orig,below:!!parsed.below,warn:parsed.warn||[],q:parsed.q||null,fix:collapsed?null:(parsed.fix||null),giro:parsed.giro||null,tse:parsed.tse||null,pay:parsed.tse?parsed.tse.pay:''};
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
  // Zuerst die KI-Texterkennung (falls im Gerät vorhanden). Geht ihr Ergebnis rechnerisch auf, ist sie fertig.
  let kiRes=null;
  if(await kiUsable()){
    try{ocrPass='';pageNote='';kiRes=fin(await kiRead(v0),v0,rot0);if(verified(kiRes.p)){delete kiRes.runs;return kiRes}}catch(e){kiRes=null}
  }
  if(fixed){const r=fin(await ocrCanvases(v0,false),v0,rot0);return kiRes&&kiRes.sc>r.sc?kiRes:r}
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
  // Lag der Bon gedreht, die KI auf der richtigen Lage noch einmal lesen lassen
  if(kiRes&&best.rot!==kiRes.rot&&!verified(best.p)){try{const k2=fin(await kiRead(prep(best.rot)),prep(best.rot),best.rot);if(k2.sc>best.sc)best=k2}catch(e){}}
  // Ergebnis, das rechnerisch aufgeht, gewinnt; sonst das mit der besseren Bewertung
  else if(kiRes&&(verified(kiRes.p)&&!verified(best.p)||!verified(best.p)&&kiRes.sc>best.sc))best=kiRes;
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
  if(keepPhoto===true)ui.photoUrl=url;
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
    res.p.warn=verified(res.p)?[]:w;res.p.rot=res.rot||0;res.p.q={sharp:q.sharp,textH:res.textH,angle:q.angle,inverted:q.inverted,rot:res.rot,engine:res.engine||'tess',kiRows:res.kiRows||''};
    if(keepPhoto==='bg')res.photoUrl=url;
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
    let res;
    // Beim Stapel-Scan wurde dieser Beleg vielleicht schon im Hintergrund gelesen
    if(ui.pre&&ui.pre.file===file&&o.rot==null){const pre=ui.pre;ui.pre=null;ui.ocr.label='Lese Beleg …';render();
      const out=await pre.promise;if(out.e)throw out.e;res=out.r;if(res.photoUrl){ui.photoUrl=res.photoUrl;delete res.photoUrl}}
    else res=await readOne(file,true,o.rot||0,o.rot!=null);
    ui.ocr=null;ui.paste=res.text||'';ui.rot=res.rot||0;
    if(!ui.paste.trim()){ui.err=pdf?'In diesem PDF wurde kein Text gefunden.':'Auf dem Foto wurde kein Text gefunden. Fotografiere den Bon gerade, formatfüllend und gut beleuchtet, oder kopiere den Text mit Google Lens.';render();return}
    parseNow(applyCodes(res.p,res.codes));
    if(ui.queue&&ui.queue.length)setTimeout(prefetchNext,400);
  }catch(e){ui.ocr=null;ui.err=ocrErr(e,pdf);render()}
}
// Stapel-Scan: den nächsten Beleg schon lesen, während der aktuelle geprüft wird
function prefetchNext(){
  if(!ui.queue||!ui.queue.length||ui.pre)return;
  const f=ui.queue[0];
  ui.pre={file:f,promise:readOne(f,'bg').then(r=>({r}),e=>({e}))};
}
// Vorgelesenen Beleg verwerfen (Stapel abgebrochen)
function dropPrefetch(){
  const pre=ui.pre;ui.pre=null;
  if(pre)pre.promise.then(o=>{if(o.r&&o.r.photoUrl)URL.revokeObjectURL(o.r.photoUrl)});
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
  ui.draft=makeDraft(p);ui.draft.text=t;ui.draft.removed=[];ui.repDone=0;ui.dupOk=false;ui.dup=null;ui.err='';render();window.scrollTo(0,0);
}

