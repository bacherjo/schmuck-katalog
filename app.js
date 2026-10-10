(function(){
"use strict";
const $ = s => document.querySelector(s);

/* ---------- fields ---------- */
const TEXT_FIELDS  = ["name","beschreibung","steine","gold","fasser","druck","willi","arbeitszeit","kommentar"];
const PRICE_FIELDS = ["gold_preis","fasser_preis","druck_preis","willi_preis","arbeitszeit_preis"];
const PRICE_LABELS = {gold_preis:"Gold",fasser_preis:"Fasser",druck_preis:"3D Druck",willi_preis:"Willi",arbeitszeit_preis:"Arbeitszeit"};
const BUCKET = "photos";

/* ---------- state ---------- */
let sb=null, user=null;
let pieces=[];
const BRAND="fanijansen fine jewellery";   // shown above the title and in every PDF header
let current=null, savedSnapshot="", pendingSwitch=null, originalPhotos=[];
let pendingUploads=new Set();   // photos uploaded but not yet saved with a piece
const urlCache=new Map();       // storage path -> {url, exp}

/* ---------- helpers ---------- */
function toast(msg,ms){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,ms||2800);}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function uuid(){return (crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==="x"?r:(r&3|8)).toString(16);}));}
function parseEuro(v){
  if(typeof v==="number") return isFinite(v)?v:null;
  let s=String(v??"").replace(/[\s€]/g,"").replace(/eur(o)?$/i,"");
  if(!s) return null;
  if(s.includes(",")&&s.includes(".")) s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(",")) s=s.replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,"");
  if(!/^-?\d*\.?\d+$/.test(s)) return null;
  return Math.round(parseFloat(s)*100)/100;
}
function fmtNum(n){const [i,d]=Math.abs(n).toFixed(2).split(".");return (n<0?"-":"")+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d;}
function fmtPrice(v){const n=parseEuro(v);return n===null?(v?String(v):""):"€ "+fmtNum(n);}
function errMsg(e){return (e&&(e.message||e.error_description))||"unbekannter Fehler";}

/* ---------- start ---------- */
const cfg=window.CATALOGUE_CONFIG||{};
if(!cfg.supabaseUrl||/PASTE/.test(cfg.supabaseUrl)||!cfg.supabaseKey||/PASTE/.test(cfg.supabaseKey)||!window.supabase){
  $("#configView").hidden=false;
  if(!window.supabase) $("#configView .notice").textContent="Die Supabase-Bibliothek wurde nicht geladen. Prüfen Sie, ob der Ordner „vendor“ auf GitHub hochgeladen wurde.";
  return;
}
sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);

let started=false;
sb.auth.onAuthStateChange((event,session)=>{
  const u=session&&session.user;
  if(u&&(!user||user.id!==u.id)){user=u;showApp();}
  else if(!u&&user){user=null;showLogin();}
  else if(!u&&!started){showLogin();}
  started=true;
});
sb.auth.getSession().then(({data})=>{
  if(data&&data.session){ if(!user){user=data.session.user;showApp();} }
  else if(!user){showLogin();}
  started=true;
});

function showLogin(){
  $("#appView").hidden=true; $("#loginView").hidden=false;
  setTimeout(()=>$("#loginEmail").focus(),0);
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("#loginBtn"), err=$("#loginError"); err.hidden=true; btn.disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});
  btn.disabled=false;
  if(error){
    err.textContent=/invalid/i.test(error.message)?"E-Mail oder Passwort ist falsch.":"Anmeldung fehlgeschlagen: "+error.message;
    err.hidden=false;
  } else { $("#loginPassword").value=""; }
});
$("#googleBtn").onclick=async()=>{
  const err=$("#loginError"); err.hidden=true; $("#googleBtn").disabled=true;
  const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
  if(error){
    $("#googleBtn").disabled=false;
    err.textContent=/provider is not enabled|Unsupported provider/i.test(error.message)
      ?"Die Google-Anmeldung ist in Supabase noch nicht eingeschaltet."
      :"Google-Anmeldung fehlgeschlagen: "+error.message;
    err.hidden=false;
  }
};
// After returning from Google: show why a sign-in was refused, then tidy the address bar.
(function(){
  const params=new URLSearchParams((location.hash||"").replace(/^#/,"")+"&"+(location.search||"").replace(/^\?/,""));
  const desc=params.get("error_description"); if(!desc) return;
  const err=$("#loginError");
  err.textContent=/signup|sign up|not allowed/i.test(desc)
    ?"Dieses Google-Konto hat keinen Zugang zum Katalog. Bitte zuerst in Supabase einen Benutzer mit dieser E-Mail-Adresse anlegen."
    :"Google-Anmeldung fehlgeschlagen: "+desc.replace(/\+/g," ");
  err.hidden=false;
  history.replaceState(null,"",location.pathname);
})();
$("#logoutBtn").onclick=()=>guard(async()=>{await cleanupPending();await sb.auth.signOut();});

async function showApp(){
  $("#loginView").hidden=true; $("#appView").hidden=false;
  $("#who").textContent=user.email||"";
  fillForm(blankPiece());
  await reload();
}

/* ---------- data ---------- */
async function reload(){
  const {data,error}=await sb.from("pieces").select("*").order("updated_at",{ascending:false});
  if(error){$("#list").innerHTML=`<div class="empty-state">Die Stücke konnten nicht geladen werden (${esc(error.message)}). Bitte laden Sie die Seite neu.</div>`;return;}
  pieces=data||[];
  await signUrls(pieces.map(p=>p.photos&&p.photos[0]).filter(Boolean));
  renderList();
}
async function signUrls(paths){
  const now=Date.now();
  const need=[...new Set(paths)].filter(p=>{const c=urlCache.get(p);return !c||c.exp<now+60000;});
  if(!need.length) return;
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrls(need,3600);
  if(error||!data) return;
  data.forEach(d=>{ if(d.signedUrl) urlCache.set(d.path,{url:d.signedUrl,exp:now+3600*1000}); });
}
function cachedUrl(p){const c=urlCache.get(p);return c?c.url:"";}
async function hydrateImgs(root){
  const imgs=[...root.querySelectorAll("img[data-photo]")];
  await signUrls(imgs.map(i=>i.dataset.photo));
  imgs.forEach(i=>{const u=cachedUrl(i.dataset.photo); if(u&&i.src!==u) i.src=u;});
}

/* ---------- form state ---------- */
function blankPiece(){const o={id:null,isNew:true,photos:[]};TEXT_FIELDS.forEach(f=>o[f]="");PRICE_FIELDS.forEach(f=>o[f]=null);return o;}
function readForm(){
  const o={};
  TEXT_FIELDS.forEach(f=>o[f]=$("#f-"+f).value.trim());
  PRICE_FIELDS.forEach(f=>o[f]=$("#f-"+f).value.trim());
  o.photos=current.photos.slice();
  return o;
}
function fillForm(p){
  cleanupPending(p.photos||[]);
  current={id:p.id,isNew:!!p.isNew,photos:(p.photos||[]).slice(0,2),updated_at:p.updated_at,nummer:p.nummer??null,share_token:p.share_token||null};
  originalPhotos=current.photos.slice();
  TEXT_FIELDS.forEach(f=>$("#f-"+f).value=p[f]??"");
  PRICE_FIELDS.forEach(f=>{const n=parseEuro(p[f]);$("#f-"+f).value=n===null?"":fmtNum(n);});
  recalc(); renderPhotos(); updateHead();
  savedSnapshot=JSON.stringify(readForm());
  $("#dirtyBanner").hidden=true; pendingSwitch=null;
  $("#deleteBtn").hidden=current.isNew;
  renderList();
}
function isDirty(){return current && JSON.stringify(readForm())!==savedSnapshot;}
function updateHead(){
  $("#headNr").textContent=current.nummer!=null?"Nr. "+current.nummer:"Neues Stück";
  $("#shareState").hidden=!current.share_token;
  $("#headMeta").textContent=current.isNew?"Die Nummer wird beim Speichern vergeben":"Zuletzt gespeichert am "+(current.updated_at?new Date(current.updated_at).toLocaleDateString("de-AT"):"");
}
function recalc(){
  let sum=0, any=false;
  PRICE_FIELDS.forEach(k=>{
    const el=$("#f-"+k), n=parseEuro(el.value);
    el.setAttribute("aria-invalid", el.value.trim()&&n===null?"true":"false");
    if(n!==null){sum+=n;any=true;}
  });
  $("#f-verkaufspreis").value=any?fmtNum(sum):"";
  return any?Math.round(sum*100)/100:null;
}
$("#form").addEventListener("input",e=>{if(/_preis$/.test(e.target.id))recalc();});

/* ---------- photos ---------- */
let targetSlot=0;
function renderPhotos(){
  const box=$("#photos"); box.innerHTML="";
  for(let i=0;i<2;i++){
    const id=current.photos[i]; const slot=document.createElement("div"); slot.className="slot";
    if(id){
      slot.innerHTML=`<img data-photo="${esc(id)}" alt="Foto ${i+1}"><button type="button" class="btn small rm">Entfernen</button>`;
      slot.querySelector(".rm").onclick=()=>{current.photos.splice(i,1);renderPhotos();};
    } else if(i===0||current.photos.length>=1){
      slot.innerHTML=`<button type="button" class="add"><b>+</b>${i===0?"Hauptfoto":"Zweites Foto"}<span class="hint">Anklicken oder Bild hierher ziehen</span></button>`;
      slot.querySelector(".add").onclick=()=>{targetSlot=i;$("#fileInput").click();};
    } else {
      slot.innerHTML=`<span class="hint">Zuerst das Hauptfoto hinzufügen</span>`;
    }
    slot.addEventListener("dragover",e=>{e.preventDefault();slot.classList.add("drag");});
    slot.addEventListener("dragleave",()=>slot.classList.remove("drag"));
    slot.addEventListener("drop",e=>{e.preventDefault();slot.classList.remove("drag");const f=e.dataTransfer.files[0];if(f)handleFile(f,i);});
    box.appendChild(slot);
  }
  hydrateImgs(box);
}
$("#fileInput").onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)handleFile(f,targetSlot);};
function drawToCanvas(src,max){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
      const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
      res(c);
    };
    img.onerror=()=>rej(new Error("decode"));
    img.src=src;
  });
}
const toJpeg=(c,q)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("encode")),"image/jpeg",q||0.88));
async function uploadPhoto(blob){
  const path=uuid()+".jpg";
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:"image/jpeg",upsert:false});
  if(error) throw error;
  return path;
}
async function handleFile(file,slot){
  if(!/^image\//.test(file.type)){toast("Bitte wählen Sie eine Bilddatei (JPEG, PNG oder WebP).");return;}
  const url=URL.createObjectURL(file);
  toast("Foto wird hochgeladen…",20000);
  try{
    const blob=await toJpeg(await drawToCanvas(url,2000));
    const path=await uploadPhoto(blob);
    pendingUploads.add(path);
    if(slot>=current.photos.length) current.photos.push(path); else current.photos[slot]=path;
    current.photos=current.photos.slice(0,2);
    renderPhotos(); toast("Foto hinzugefügt. Bitte das Stück noch speichern.");
  }catch(e){
    toast(e&&e.message==="decode"?"Dieses Bildformat kann nicht gelesen werden. Bitte JPEG oder PNG verwenden.":"Das Foto konnte nicht hochgeladen werden: "+errMsg(e));
  }finally{URL.revokeObjectURL(url);}
}
async function removePhotos(paths){
  if(!paths.length) return;
  paths.forEach(p=>urlCache.delete(p));
  await sb.storage.from(BUCKET).remove(paths).catch(()=>{});
}
// Delete photos that were uploaded for a piece but never saved.
async function cleanupPending(keep){
  const keepSet=new Set(keep||[]);
  const drop=[...pendingUploads].filter(p=>!keepSet.has(p));
  pendingUploads=new Set([...pendingUploads].filter(p=>keepSet.has(p)));
  await removePhotos(drop);
}

/* ---------- list ---------- */
function renderList(){
  const q=$("#search").value.trim().toLowerCase();
  const list=$("#list");
  const hay=p=>[p.nummer!=null?String(p.nummer):""].concat(TEXT_FIELDS.map(f=>p[f]||"")).concat(PRICE_FIELDS.concat(["verkaufspreis"]).map(f=>{const n=parseEuro(p[f]);return n===null?"":fmtNum(n);})).join(" \n ").toLowerCase();
  const shown=pieces.filter(p=>!q||hay(p).includes(q));
  $("#count").textContent=pieces.length+(pieces.length===1?" Stück":" Stücke")+(q?" · "+shown.length+" gefunden":"");
  if(!pieces.length){list.innerHTML=`<div class="empty-state">Noch keine Stücke. Füllen Sie das Formular aus und klicken Sie auf <b>Stück speichern</b>. Es erscheint dann hier.</div>`;return;}
  if(!shown.length){list.innerHTML=`<div class="empty-state">Keine Treffer für „${esc(q)}“.</div>`;return;}
  list.innerHTML=shown.map(p=>{
    const ph=p.photos&&p.photos[0];
    const th=ph?`<img class="thumb" data-photo="${esc(ph)}" alt="">`:`<span class="thumb empty">kein Foto</span>`;
    const meta=(p.beschreibung||"").split("\n")[0]||"—";
    return `<button type="button" class="item" data-id="${esc(p.id)}" aria-current="${!!(current&&current.id===p.id)}">${th}
      <span class="item-main"><span class="item-nr">${p.nummer!=null?"Nr. "+esc(p.nummer):""}</span><span class="item-name">${esc(p.name||"Unbenanntes Stück")}</span><span class="item-meta">${esc(meta)}</span></span>
      <span class="item-price">${esc(fmtPrice(p.verkaufspreis))}</span></button>`;
  }).join("");
  hydrateImgs(list);
  list.querySelectorAll(".item").forEach(b=>b.onclick=()=>guard(()=>{const p=pieces.find(x=>x.id===b.dataset.id);if(p){fillForm(p);if(innerWidth<840)$("#form").scrollIntoView({behavior:"smooth"});}}));
}
$("#search").oninput=renderList;
function guard(fn){
  if(isDirty()){pendingSwitch=fn;$("#dirtyBanner").hidden=false;$("#dirtyBanner").scrollIntoView({block:"nearest"});return;}
  fn();
}
$("#discardBtn").onclick=()=>{const fn=pendingSwitch;$("#dirtyBanner").hidden=true;pendingSwitch=null;if(fn)fn();};
$("#saveSwitchBtn").onclick=async()=>{const fn=pendingSwitch;if(await save()){if(fn)fn();}};
$("#newBtn").onclick=()=>guard(()=>{fillForm(blankPiece());$("#f-name").focus();});

/* ---------- save / delete ---------- */
let saving=false;
async function save(){
  if(saving) return false;
  const f=readForm();
  if(!f.name){toast("Bitte geben Sie dem Stück zuerst einen Namen.");$("#f-name").focus();return false;}
  const row={};
  TEXT_FIELDS.forEach(k=>row[k]=f[k]);
  for(const k of PRICE_FIELDS){
    const n=parseEuro(f[k]);
    if(f[k]&&n===null){toast("Der Preis bei "+PRICE_LABELS[k]+" ist keine Zahl.");$("#f-"+k).focus();return false;}
    row[k]=n;
  }
  row.verkaufspreis=recalc();
  row.photos=f.photos;
  row.updated_at=new Date().toISOString();
  saving=true; $("#saveBtn").disabled=true;
  try{
    let res;
    if(current.id) res=await sb.from("pieces").update(row).eq("id",current.id).select().single();
    else res=await sb.from("pieces").insert(row).select().single();
    if(res.error) throw res.error;
    const saved=res.data;
    const removed=originalPhotos.filter(id=>!saved.photos.includes(id));
    saved.photos.forEach(p=>pendingUploads.delete(p));
    current.id=saved.id; current.isNew=false; current.updated_at=saved.updated_at; current.nummer=saved.nummer??null; current.share_token=saved.share_token||null; originalPhotos=saved.photos.slice();
    savedSnapshot=JSON.stringify(readForm());
    $("#dirtyBanner").hidden=true; $("#deleteBtn").hidden=false; updateHead();
    removePhotos(removed);
    const i=pieces.findIndex(p=>p.id===saved.id); if(i>=0) pieces.splice(i,1);
    pieces.unshift(saved); renderList();
    toast("Gespeichert");
    return true;
  }catch(e){toast("Speichern fehlgeschlagen: "+errMsg(e));return false;}
  finally{saving=false;$("#saveBtn").disabled=false;}
}
$("#form").addEventListener("submit",e=>{e.preventDefault();save();});
let armT=null;
$("#deleteBtn").onclick=async()=>{
  const b=$("#deleteBtn");
  if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Zum Löschen nochmals klicken";clearTimeout(armT);armT=setTimeout(()=>{b.classList.remove("armed");b.textContent="Stück löschen";},4000);return;}
  clearTimeout(armT);b.classList.remove("armed");b.textContent="Stück löschen";
  if(!current.id) return;
  const {error}=await sb.from("pieces").delete().eq("id",current.id);
  if(error){toast("Löschen fehlgeschlagen: "+error.message);return;}
  await removePhotos(originalPhotos.concat(current.photos));
  pieces=pieces.filter(p=>p.id!==current.id);
  toast("Stück gelöscht"); savedSnapshot=""; current.photos=[]; fillForm(blankPiece());
};

/* ---------- PDF ---------- */
async function photoBlob(path){
  const {data,error}=await sb.storage.from(BUCKET).download(path);
  if(error) throw error; return data;
}
async function loadImg(path){
  try{
    const url=URL.createObjectURL(await photoBlob(path));
    try{const c=await drawToCanvas(url,1600);return {data:c.toDataURL("image/jpeg",0.9),w:c.width,h:c.height};}
    finally{URL.revokeObjectURL(url);}
  }catch(e){return null;}
}
const PW=210, PH=297, M=18, CW=PW-2*M, BOTTOM=PH-22;
async function drawPiece(doc,p,opts){
  const firstOnly=!!(opts&&opts.firstPageOnly);
  let y=18;
  const ink=[29,33,33], grey=[105,112,110], rule=[195,200,198], gold=[154,116,40];
  const head=()=>{
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...grey);
    doc.text(BRAND,M,y);
    if(p.nummer!=null){doc.setFont("helvetica","normal");doc.text("Nr. "+p.nummer,PW-M,y,{align:"right"});}
    doc.setDrawColor(...rule);doc.setLineWidth(0.2);doc.line(M,y+2.5,PW-M,y+2.5);
  };
  head();
  const ensure=h=>{if(y+h>BOTTOM){doc.addPage();y=18;head();y+=12;}};
  y+=16;
  doc.setFont("times","normal");doc.setFontSize(26);doc.setTextColor(...ink);
  const tl=doc.splitTextToSize(p.name||"Unbenanntes Stück",CW);doc.text(tl,M,y);y+=(tl.length-1)*10+10;
  const imgs=(await Promise.all((p.photos||[]).slice(0,2).map(loadImg))).filter(Boolean);
  if(imgs.length){
    const H=imgs.length===2?92:118, gap=6, bw=imgs.length===2?(CW-gap)/2:CW;
    imgs.forEach((im,i)=>{
      const sc=Math.min(bw/im.w,H/im.h), w=im.w*sc, h=im.h*sc, bx=M+i*(bw+gap);
      doc.addImage(im.data,"JPEG",bx+(bw-w)/2,y+(H-h)/2,w,h);
    });
    y+=H+10;
  }
  const paragraphs=(title,text)=>{
    doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...grey);doc.text(title,M,y,{charSpace:0.6});y+=6;
    doc.setFont("times","normal");doc.setFontSize(11.5);doc.setTextColor(...ink);
    text.split(/\n+/).forEach(par=>{
      doc.splitTextToSize(par,CW).forEach(line=>{ensure(5.6);doc.text(line,M,y);y+=5.4;});
      y+=2;
    });
  };
  if(p.beschreibung){paragraphs("BESCHREIBUNG",p.beschreibung);y+=2;}
  // each row: label, text field, and its Preis on the same line (right-hand price column)
  const GROUPS=[["Steine","steine",null],["Gold","gold","gold_preis"],["Fasser","fasser","fasser_preis"],["3D Druck","druck","druck_preis"],["Willi (AZ/Material)","willi","willi_preis"],["Arbeitszeit","arbeitszeit","arbeitszeit_preis"]];
  const has=v=>v!==null&&v!==undefined&&String(v).trim()!=="";
  const rows=GROUPS.filter(g=>has(p[g[1]])||(g[2]&&has(p[g[2]])));
  const price=has(p.verkaufspreis)?p.verkaufspreis:null;
  if(firstOnly) return;   // "PDF Seite 1": stop before the separator line and page 2
  ensure(10);
  doc.setDrawColor(...rule);doc.setLineWidth(0.3);doc.line(M,y,PW-M,y);
  if(rows.length||price!==null||p.kommentar){doc.addPage();y=18;head();y+=16;}
  if(rows.length){
    const lblW=42, textW=CW-lblW-40;
    rows.forEach(g=>{
      doc.setFont("helvetica","normal");doc.setFontSize(10.5);
      const lines=has(p[g[1]])?doc.splitTextToSize(String(p[g[1]]),g[2]?textW:CW-lblW):["—"];
      const h=lines.length*4.8+3.4;
      ensure(h);
      doc.setFontSize(8.5);doc.setTextColor(...grey);doc.text(g[0],M,y);
      doc.setFontSize(10.5);doc.setTextColor(...ink);doc.text(lines,M+lblW,y);
      if(g[2]&&has(p[g[2]])){doc.text(fmtPrice(p[g[2]]),PW-M,y,{align:"right"});}
      y+=h;
    });
    y+=1;
    doc.setDrawColor(...rule);doc.setLineWidth(0.2);doc.line(PW-M-50,y,PW-M,y);
    y+=8;
  }
  if(price!==null){
    ensure(18);
    doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...grey);
    doc.text("VERKAUFSPREIS",PW-M,y,{align:"right",charSpace:0.6});y+=8;
    doc.setFont("times","normal");doc.setFontSize(20);doc.setTextColor(...gold);
    doc.text(fmtPrice(price),PW-M,y,{align:"right"});
    y+=14;
  }
  if(p.kommentar){ensure(16);paragraphs("KOMMENTAR",p.kommentar);}
}
function footers(doc){
  const n=doc.getNumberOfPages(); const date=new Date().toLocaleDateString("de-AT");
  for(let i=1;i<=n;i++){
    doc.setPage(i);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(140,146,144);
    doc.text(date,M,PH-12);
    doc.text(i+" / "+n,PW-M,PH-12,{align:"right"});
  }
}
function safeName(s){return String(s).replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"Stueck";}
function formAsPiece(){
  const f=readForm(), p={};
  TEXT_FIELDS.forEach(k=>p[k]=f[k]);
  PRICE_FIELDS.forEach(k=>p[k]=f[k]);
  p.verkaufspreis=recalc(); p.photos=f.photos; p.nummer=current.nummer;
  return p;
}
async function pdfPiece(firstPageOnly){
  const p=formAsPiece(); toast("PDF wird erstellt…",20000);
  try{
    const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
    await drawPiece(doc,p,{firstPageOnly}); footers(doc);
    const base=[p.nummer,p.name].filter(v=>v!=null&&v!=="").join(" ")||"Stueck";
    doc.save(safeName(base+(firstPageOnly?" Seite 1":""))+".pdf"); toast("PDF heruntergeladen");
  }catch(e){toast("Das PDF konnte nicht erstellt werden: "+errMsg(e));}
}
$("#pdfBtn").onclick=()=>pdfPiece(false);
$("#pdf1Btn").onclick=()=>pdfPiece(true);

/* ---------- share by e-mail ---------- */
// Each piece can get a secret link to stueck.html, which shows only name, number, photos and Beschreibung.
function shareLink(token){return location.origin+location.pathname.replace(/[^/]*$/,"")+"stueck.html?t="+token;}
function setShareToken(token){
  current.share_token=token;
  const p=pieces.find(x=>x.id===current.id); if(p) p.share_token=token;
  updateHead();
}
$("#mailBtn").onclick=async()=>{
  if(current.isNew||!current.id){toast("Bitte das Stück zuerst speichern.");return;}
  if(isDirty()){toast("Bitte zuerst die Änderungen speichern.");return;}
  let token=current.share_token;
  if(!token){
    const {data,error}=await sb.from("pieces").update({share_token:uuid()}).eq("id",current.id).select("share_token").single();
    if(error){toast("Der Link konnte nicht erstellt werden: "+error.message);return;}
    token=data.share_token; setShareToken(token);
  }
  const link=shareLink(token);
  const name=$("#f-name").value.trim();
  const subject=name+" – "+BRAND;
  const body="Hallo,\n\nhier finden Sie das Schmuckstück „"+name+"“"+(current.nummer!=null?" (Nr. "+current.nummer+")":"")+":\n"+link+"\n\nHerzliche Grüße\n"+BRAND;
  let copied=false;
  try{await navigator.clipboard.writeText(link);copied=true;}catch(e){}
  location.href="mailto:?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  toast("Ihr E-Mail-Programm wird geöffnet."+(copied?" Der Link ist auch in der Zwischenablage.":""),6000);
};
let unshareArmed=null;
$("#unshareBtn").onclick=async()=>{
  const b=$("#unshareBtn");
  if(!unshareArmed){b.textContent="Wirklich aufheben? Nochmals klicken";unshareArmed=setTimeout(()=>{b.textContent="Freigabe aufheben";unshareArmed=null;},4000);return;}
  clearTimeout(unshareArmed);unshareArmed=null;b.textContent="Freigabe aufheben";
  const {error}=await sb.from("pieces").update({share_token:null}).eq("id",current.id);
  if(error){toast("Die Freigabe konnte nicht aufgehoben werden: "+error.message);return;}
  setShareToken(null);
  toast("Freigabe aufgehoben. Bereits verschickte Links funktionieren nicht mehr.",5000);
};
$("#exportAll").onclick=async()=>{
  if(!pieces.length){toast("Es gibt noch keine gespeicherten Stücke.");return;}
  toast("Katalog mit "+pieces.length+" Stücken wird erstellt…",60000);
  try{
    const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
    for(let i=0;i<pieces.length;i++){ if(i>0) doc.addPage(); await drawPiece(doc,pieces[i]); }
    footers(doc);
    doc.save(safeName("Katalog fanijansen")+".pdf"); toast("Katalog-PDF heruntergeladen");
  }catch(e){toast("Das Katalog-PDF konnte nicht erstellt werden: "+errMsg(e));}
};

/* ---------- backup & import ---------- */
// File format (shared with the export button of the claude.ai version):
// {app:"goldsmith-catalogue", format:2, settings:{workshop}, pieces:[{key, name, ..., photos:[photoKey]}], photos:{photoKey:dataURL}}
function blobToDataUrl(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b);});}
async function dataUrlToBlob(u){const r=await fetch(u);return r.blob();}
function downloadFile(blob,name){
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
$("#backupBtn").onclick=async()=>{
  if(!pieces.length){toast("Es gibt noch nichts zu sichern.");return;}
  try{
    const photos={}; let n=0;
    for(const p of pieces) for(const path of (p.photos||[])){
      toast("Sicherung wird erstellt… Foto "+(++n),60000);
      try{photos[path]=await blobToDataUrl(await photoBlob(path));}catch(e){}
    }
    const out={app:"goldsmith-catalogue",format:2,exportedAt:new Date().toISOString(),settings:{},
      pieces:pieces.map(p=>{const o={key:p.id,nummer:p.nummer};TEXT_FIELDS.concat(PRICE_FIELDS).forEach(k=>o[k]=p[k]);o.photos=p.photos||[];o.created_at=p.created_at;o.updated_at=p.updated_at;return o;}),photos};
    downloadFile(new Blob([JSON.stringify(out)],{type:"application/json"}),"katalog-backup-"+new Date().toISOString().slice(0,10)+".json");
    toast("Sicherung im Download-Ordner gespeichert");
  }catch(e){toast("Die Sicherung konnte nicht erstellt werden: "+errMsg(e));}
};
$("#importBtn").onclick=()=>$("#importInput").click();
$("#importInput").onchange=async e=>{
  const file=e.target.files[0]; e.target.value=""; if(!file) return;
  let data;
  try{data=JSON.parse(await file.text());}catch(err){toast("Diese Datei ist keine Katalog-Sicherung und kein Export.");return;}
  if(!data||data.app!=="goldsmith-catalogue"||data.format!==2||!Array.isArray(data.pieces)){toast("Diese Datei ist keine Katalog-Sicherung und kein Export.");return;}
  const existing=new Set(); pieces.forEach(p=>{existing.add(p.id); if(p.import_key) existing.add(p.import_key);});
  const todo=data.pieces.filter(p=>p&&p.key&&!existing.has(p.key));
  const skipped=data.pieces.length-todo.length;
  if(!todo.length){toast(data.pieces.length===1?"Das Stück aus dieser Datei ist bereits im Katalog.":"Alle "+data.pieces.length+" Stücke aus dieser Datei sind bereits im Katalog.");return;}
  if(!confirm(todo.length+" Stücke aus dieser Datei importieren?"+(skipped?"\n\n"+skipped+" Stücke sind bereits im Katalog und werden übersprungen.":""))) return;
  let done=0, failed=0;
  for(const src of todo){
    toast("Importiere Stück "+(done+failed+1)+" von "+todo.length+"…",60000);
    try{
      const row={import_key:String(src.key)}, notes=[];
      TEXT_FIELDS.forEach(k=>row[k]=String(src[k]??"").trim());
      PRICE_FIELDS.forEach(k=>{
        const raw=src[k]; const n=parseEuro(raw);
        row[k]=n;
        if(n===null&&raw!==null&&raw!==undefined&&String(raw).trim()) notes.push("Preis "+PRICE_LABELS[k]+" beim Import nicht lesbar: "+String(raw).trim());
      });
      if(notes.length) row.kommentar=[row.kommentar,notes.join("\n")].filter(Boolean).join("\n\n");
      const vals=PRICE_FIELDS.map(k=>row[k]).filter(v=>v!==null);
      row.verkaufspreis=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)*100)/100:null;
      row.photos=[];
      for(const k of (src.photos||[]).slice(0,2)){
        const u=data.photos&&data.photos[k]; if(!u) continue;
        row.photos.push(await uploadPhoto(await dataUrlToBlob(u)));
      }
      if(src.created_at) row.created_at=src.created_at;
      row.updated_at=src.updated_at||new Date().toISOString();
      const {error}=await sb.from("pieces").insert(row);
      if(error){await removePhotos(row.photos);throw error;}
      done++;
    }catch(err){failed++;console.error(err);}
  }
  await reload();
  toast(done+(done===1?" Stück":" Stücke")+" importiert"+(failed?" · "+failed+" fehlgeschlagen, bitte die Datei nochmals importieren":""),6000);
};


window.addEventListener("beforeunload",e=>{if(isDirty()){e.preventDefault();e.returnValue="";}});
})();
