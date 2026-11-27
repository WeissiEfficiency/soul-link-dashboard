// Soul-Link-Dashboard: Logik. Pokémon-Namen kommen aus js/pokemon.js, Firebase-Daten aus config.js.
(function(){
"use strict";
/* Versionsschutz: passt index.html nicht zu dieser Datei (Browser-Cache nach einem Deploy), einmal neu laden.
   APP_V setzt tools/bump.py zusammen mit data-v und ?v= in index.html. */
var APP_V="202611270823";
var HTML_V=document.documentElement.getAttribute("data-v");
if(HTML_V&&HTML_V!==APP_V){try{var rk="soullink-reload-"+HTML_V+"-"+APP_V;if(!sessionStorage.getItem(rk)){sessionStorage.setItem(rk,"1");location.reload();return}}catch(e){}}
/* Spieler: Anzahl aus config.js (playerCount, 2 bis 6, Standard 3). Schlüssel p0 … p5, Namen stehen in meta.players. */
var CFG0=window.SOULLINK_CONFIG||{};
var NP=Math.max(2,Math.min(6,parseInt(CFG0.playerCount,10)||3));
var P=[],IDX=[],DEF=[],MARK=["●","■","▲","◆","★","✚"].slice(0,NP);
for(var pi=0;pi<NP;pi++){P.push("p"+pi);IDX.push(pi);DEF.push("Spieler "+(pi+1))}
var NUMW=["","","zweit","dritt","viert","fünft","sechst"][NP], NUMC=["","","Zwei","Drei","Vier","Fünf","Sechs"][NP];
/* Spiele: Daten in js/games.js (Routen, Level-Caps, Region, Dex-Bereich). Das aktuelle Spiel steht in meta.game
   (fehlt = Schwarz/Weiß). Der Admin wählt; gilt sofort, solange nichts eingetragen ist, sonst ab „Neuer Run starten“ (meta.nextGame). */
var GAMES=window.SOULLINK_GAMES;
function gameId(g){g=g===undefined?S.meta.game:g;return g&&GAMES.byId[g]?g:GAMES.def}
function GAME(g){return GAMES.byId[gameId(g)]}
function caps(){return GAME().caps}
function perPlayer(f){var o={};P.forEach(function(p,i){o[p]=f(i)});return o}
var EMPTY_CELLS=function(){return perPlayer(function(){return {sp:"",nick:"",st:""}})};
var NO_DEATHS=function(){return perPlayer(function(){return false})};

function defMeta(){return {players:perPlayer(function(){return {name:""}}),
  run:{no:1,status:"run",enders:NO_DEATHS(),where:"",cause:""},
  tally:perPlayer(function(){return {run:0,death:0,enc:0}}),
  caps:{beaten:{},lv:{}},backupAt:""}}
var S={meta:defMeta(),routes:new Map(),history:[]};
var store=null, mode="local", canWrite=true, loaded=false, routesLoaded=false;
/* Testmodus (index.html?test=1, genutzt von tests/smoke.html): immer lokal mit eigenem Speicher, nie Firebase oder Artifact. */
var TEST=/[?&]test=1(&|$)/.test(location.search);
var auth=null, authUser=null, isAdmin=false, authKnown=false;   // nur im Firebase-Modus
var pend=new Map(), busy=new Set(), metaPend=null, metaBusy=false, timers=new Map(), metaTimer=null;
var ui={filter:"all",q:"",view:"edit",showAll:false,anaGame:"all"};
var $=function(id){return document.getElementById(id)};

function el(tag,attrs,kids){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==="text")e.textContent=attrs[k];else if(k==="class")e.className=attrs[k];else e.setAttribute(k,attrs[k]);}(kids||[]).forEach(function(c){e.appendChild(c)});return e}
function dm(t,s){for(var k in s){var v=s[k];if(v&&typeof v==="object"&&!Array.isArray(v)){t[k]=dm(t[k]&&typeof t[k]==="object"&&!Array.isArray(t[k])?t[k]:{},v)}else t[k]=v}return t}
function clone(o){return JSON.parse(JSON.stringify(o))}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function pname(i){var n=(S.meta.players[P[i]]||{}).name;return n&&n.trim()?n.trim():DEF[i]}
function cellOf(r,i){var c=(r.cells||{})[P[i]]||{};return {sp:c.sp||"",nick:c.nick||"",st:c.st||""}}
function status(r){var s=P.map(function(_,i){return cellOf(r,i).st});
  if(s.indexOf("miss")>-1)return"miss";if(s.indexOf("dead")>-1)return"dead";
  if(s.every(function(x){return x==="alive"}))return"alive";if(s.indexOf("alive")>-1)return"part";return"open"}
var STL={alive:"Lebendig ♡",dead:"Tot (×_×)",miss:"Verpasst",part:"Teilweise",open:"Offen"};

/* ---------- Themes ----------
   Pokédex ist das Design für alle. Nur der Admin (bzw. lokal/Artifact) sieht den Umschalter und kann
   Pastell oder Lovecraft wählen; die Wahl liegt pro Gerät in localStorage, nicht in der Datenbank.
   Farben und Formen stehen in css/style.css unter :root[data-theme=…]; hier nur die Sprüche. */
var THEMES=["pokedex","pastell","lovecraft"], DEFAULT_THEME="pokedex";
var THEME_TXT={
  pokedex:{tag:"{R} · Soul Link · "+NP+" Trainer",run:"Run läuft. Viel Erfolg, Trainer!",won:"Glückwunsch! Ihr habt die Liga bezwungen!",lost:"… alle Pokémon kampfunfähig.",grave:"Noch kein Link gestorben."},
  pastell:{tag:"{R}-Run zu "+NUMW+" (◕‿◕)♡",run:"Run läuft (๑•̀ㅂ•́)و✧",won:"Run gewonnen ✧*。٩(ˊᗜˋ*)و✧*。",lost:"(×_×)",grave:"Noch kein Link gestorben. (◕‿◕)"},
  lovecraft:{tag:NUMC+" Seelen, ein Bund – und etwas, das unter {R} schläft",run:"Der Run währt fort. Etwas beobachtet euch aus der Tiefe.",won:"Bezwungen … vorerst. Die Sterne stehen noch nicht richtig.",lost:"– verschlungen von namenlosem Grauen.",grave:"Noch ruht kein Link in der Tiefe."}};
function themeName(){var t=document.documentElement.getAttribute("data-theme");return THEMES.indexOf(t)>-1?t:DEFAULT_THEME}
function tt(k){return THEME_TXT[themeName()][k].replace("{R}",GAME().region)}
var STC={alive:"Lebendig",dead:"Tot",miss:"Verpasst",part:"Teilweise",open:"Offen"};
function sorted(){return Array.from(S.routes.entries()).sort(function(a,b){return (a[1].order||0)-(b[1].order||0)})}
function killerName(r){return typeof r.killer==="number"&&r.killer>-1?pname(r.killer):""}
function missNames(r){return IDX.filter(function(i){return cellOf(r,i).st==="miss"}).map(pname).join(", ")}
function isLost(st){return st==="dead"||st==="miss"}
function lossBy(r,st){return st==="miss"?missNames(r):(killerName(r)||"offen")}
function lossCause(r,st){return r.cause||(st==="miss"?"nicht gefangen":"")}
function deathNames(r){return IDX.filter(function(i){return (r.deaths||{})[P[i]]}).map(pname).join(", ")}
function nickOf(r){if(typeof r.nick==="string")return r.nick;for(var i=0;i<NP;i++){var n=((r.cells||{})[P[i]]||{}).nick;if(n)return n}return ""}
function spText(d){return d.st==="miss"?"nicht gefangen":(d.sp||(d.st?"gefangen":""))}

/* Spielerabhängiges Markup: Tabellenköpfe (Platzhalter #allHead, #graveHead), Run-Ender-Knöpfe, Spaltenzahl */
function buildPlayerUI(){
  document.documentElement.style.setProperty("--np-cols",String(NP<=4?NP:3));
  [["allHead","ah",true],["graveHead","gh",false]].forEach(function(x){var mk=$(x[0]);if(!mk)return;
    IDX.forEach(function(i){var th=el("th",{id:x[1]+i});if(x[2])th.className="pk"+i;mk.parentNode.insertBefore(th,mk)});mk.remove()});
  var en=$("enders");IDX.forEach(function(i){en.appendChild(el("button",{type:"button",class:"chipb","data-p":String(i),"aria-pressed":"false"},[el("span",{text:MARK[i]}),document.createTextNode(" "),el("span",{class:"en"})]))});
}
buildPlayerUI();

/* ---------- Pokémon-Suche ---------- */
function norm(s){return String(s).toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/♀/g,"w").replace(/♂/g,"m").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"")}
function simp(s){return s.replace(/ph/g,"f").replace(/th/g,"t").replace(/ck/g,"k").replace(/c/g,"k").replace(/qu/g,"kw").replace(/y/g,"i").replace(/v/g,"f").replace(/z/g,"s").replace(/x/g,"ks").replace(/h/g,"").replace(/(.)\1+/g,"$1")}
var NORM=POKE.map(norm), SIMP=NORM.map(simp);
/* Entwicklungsreihen aus js/evo.js (Dupe-Hinweis); Typen kommen über typesOfName() der Schwächen-Karte (js/types.js). */
var EVO=typeof POKE_CHAIN!=="undefined"?POKE_CHAIN:null;
var SPRITE_URL="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/";
var SPRITE_URL_NEW="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
function dexOf(name){var n=norm(name||"");if(!n)return 0;var i=NORM.indexOf(n);if(i>-1)return i+1;   // Regionalformen (z. B. Alola-Vulpix) zählen als Grundform
  var f=FORMS.filter(function(x){return x.n1===n||x.n2===n})[0];return f?f.dex:0}
function spriteUrl(d){return (d<=649?SPRITE_URL:SPRITE_URL_NEW)+d+".png"}   // Schwarz/Weiß bis #649, danach Standard-Sprites
function famOf(d){return EVO&&d?EVO[d-1]:0}
function osa(a,b){var m=a.length,n=b.length;if(!m)return n;if(!n)return m;var d=[];for(var i=0;i<=m;i++){d[i]=[i]}for(var j=1;j<=n;j++)d[0][j]=j;
  for(i=1;i<=m;i++)for(j=1;j<=n;j++){var c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[m][n]}
function inGame(i){var g=GAME(),d=i+1;return d<=g.maxDex||(g.extraDex||[]).indexOf(d)>-1}
function search(q){
  var n=norm(q);if(!n)return [];var out=[],gb=GAME().boost||[0,0];
  if(/^\d+$/.test(n)){var k=String(+n);POKE.forEach(function(_,i){if(!inGame(i))return;var dex=String(i+1);if(dex===k)out.push([i,1000]);else if(dex.indexOf(k)===0)out.push([i,800-dex.length])})}
  else{var sq=simp(n),lim=n.length<=3?0:(n.length<=5?1:(n.length<=8?2:3));
    for(var i=0;i<POKE.length;i++){if(!inGame(i))continue;var t=NORM[i],s=0,at;
      if(t===n)s=1000;
      else if(t.indexOf(n)===0)s=900-(t.length-n.length);
      else if((at=t.indexOf(n))>-1)s=720-at;
      else{var st=SIMP[i];
        if(sq.length>1&&st.indexOf(sq)===0)s=660;
        else if(sq.length>2&&st.indexOf(sq)>-1)s=620;
        else if(lim){var d=Math.min(osa(n,t.slice(0,n.length)),osa(n,t.slice(0,n.length+1)),osa(n,t.slice(0,Math.max(1,n.length-1))),osa(n,t));
          if(d<=lim)s=540-d*70}}
      if(s){if(i+1>=gb[0]&&i+1<=gb[1])s+=25;out.push([i,s])}}}
  out.sort(function(a,b){return b[1]-a[1]||a[0]-b[0]});return out.slice(0,8).map(function(x){return x[0]});
}
var pk=el("ul",{id:"pk",role:"listbox","aria-label":"Pokémon-Vorschläge",hidden:""});document.body.appendChild(pk);
/* Vorschlagsliste: Einträge {t: Name, s: Dex-Text, ...}. Routenfelder nutzen search(), die Schwächen-Karte wkSearch() (mit Regionalformen). */
var pkFor=null,pkRes=[],pkAct=-1;
function pokeHits(q){return search(q).map(function(i){return {t:POKE[i],s:"#"+String(i+1).padStart(3,"0"),dex:i+1}})}
function showPk(inp,res){
  res=res||pokeHits(inp.value);
  if(pkFor&&pkFor!==inp)closePk();
  if(!res.length){closePk();return}
  pkFor=inp;pkRes=res;pkAct=0;pk.textContent="";
  res.forEach(function(h,k){pk.appendChild(el("li",{id:"pk"+k,role:"option","aria-selected":String(k===0),"data-k":k},[el("span",{text:h.t}),el("small",{text:h.s})]))});
  var r=inp.getBoundingClientRect();pk.style.left=(r.left+window.scrollX)+"px";pk.style.top=(r.bottom+window.scrollY+4)+"px";pk.style.width=Math.max(r.width,230)+"px";pk.hidden=false;
  inp.setAttribute("aria-expanded","true");inp.setAttribute("aria-activedescendant","pk0");
}
function closePk(){pk.hidden=true;if(pkFor){pkFor.setAttribute("aria-expanded","false");pkFor.removeAttribute("aria-activedescendant")}pkFor=null}
function movePk(d){if(pk.hidden||!pkRes.length)return;pkAct=(pkAct+d+pkRes.length)%pkRes.length;
  Array.prototype.forEach.call(pk.children,function(li,k){li.setAttribute("aria-selected",String(k===pkAct))});
  pkFor.setAttribute("aria-activedescendant","pk"+pkAct);pk.children[pkAct].scrollIntoView({block:"nearest"})}
function pickPk(k){var inp=pkFor,h=pkRes[k];if(!inp||!h)return;inp.value=h.t;closePk();if(inp.id==="wkQ")wkPick(h);else onCellInput(inp)}
function pkKeys(e,t,hits){
  if(e.key==="ArrowDown"){if(pk.hidden)showPk(t,hits&&hits());else movePk(1);e.preventDefault()}
  else if(e.key==="ArrowUp"){movePk(-1);e.preventDefault()}
  else if(e.key==="Enter"&&!pk.hidden&&pkFor===t){pickPk(pkAct);e.preventDefault()}
  else if(e.key==="Escape"){closePk()}}
pk.addEventListener("mousedown",function(e){var li=e.target.closest("li");if(li){e.preventDefault();pickPk(+li.getAttribute("data-k"))}});
window.addEventListener("resize",closePk);

/* ---------- Speicher ---------- */
function setSync(s,t){$("sync").setAttribute("data-s",s);$("syncT").textContent=t}
function makeArtifactStore(db){return {
  watchDoc:function(path,cb,err){return db.doc(path).onSnapshot(function(s){cb(s.exists?s.data():null,!!(s.metadata&&s.metadata.fromCache))},err)},
  watchCol:function(path,cb,err){return db.collection(path).onSnapshot(function(q){cb(q.docs.map(function(d){return {id:d.id,data:d.data()}}),!!(q.metadata&&q.metadata.fromCache))},err)},
  merge:async function(path,part){try{await db.doc(path).update(part)}catch(e){var s=await db.doc(path).get();if(s.exists)throw e;await db.doc(path).set(part)}},
  set:function(path,data){return db.doc(path).set(data)},
  del:function(path){return db.doc(path).delete()}}}
function makeFirebaseStore(fs){return {
  watchDoc:function(path,cb,err){return fs.doc(path).onSnapshot(function(s){cb(s.exists?s.data():null,s.metadata.fromCache)},err)},
  watchCol:function(path,cb,err){return fs.collection(path).onSnapshot(function(q){cb(q.docs.map(function(d){return {id:d.id,data:d.data()}}),q.metadata.fromCache)},err)},
  merge:function(path,part){return fs.doc(path).set(part,{merge:true})},
  set:function(path,data){return fs.doc(path).set(data)},
  del:function(path){return fs.doc(path).delete()}}}
function makeLocalStore(){
  var KEY=TEST?"soullink-test-data":"soullink-bw-data",data={},subs=[];
  try{data=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){data={}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}subs.forEach(function(f){f()})}
  function col(path){return Object.keys(data).filter(function(k){var a=k.split("/");return a.length===2&&a[0]===path})}
  return {
    watchDoc:function(path,cb){var f=function(){cb(data[path]?clone(data[path]):null,false)};subs.push(f);setTimeout(f,0)},
    watchCol:function(path,cb){var f=function(){cb(col(path).map(function(k){return {id:k.split("/")[1],data:clone(data[k])}}),false)};subs.push(f);setTimeout(f,0)},
    merge:function(path,part){data[path]=dm(data[path]||{},clone(part));save();return Promise.resolve()},
    set:function(path,d){data[path]=clone(d);save();return Promise.resolve()},
    del:function(path){delete data[path];save();return Promise.resolve()}}}

function patchRoute(id,part,delay){
  var r=S.routes.get(id);if(!r||!canWrite)return;dm(r,clone(part));
  pend.set(id,dm(pend.get(id)||{},clone(part)));
  clearTimeout(timers.get(id));timers.set(id,setTimeout(function(){flush(id)},delay||450));
}
async function flush(id){
  if(!store||busy.has(id)||!pend.has(id))return;
  var p=pend.get(id);pend.delete(id);busy.add(id);
  try{await store.merge("routes/"+id,p)}catch(e){setSync("warn","Speichern fehlgeschlagen")}
  busy.delete(id);if(pend.has(id))flush(id);
}
function patchMeta(part){
  if(!canWrite)return;dm(S.meta,clone(part));metaPend=dm(metaPend||{},clone(part));
  clearTimeout(metaTimer);metaTimer=setTimeout(flushMeta,450);
}
async function flushMeta(){
  if(!store||metaBusy||!metaPend)return;var p=metaPend;metaPend=null;metaBusy=true;
  try{await store.merge("meta/main",p)}catch(e){setSync("warn","Speichern fehlgeschlagen")}
  metaBusy=false;if(metaPend)flushMeta();
}

/* ---------- Routen-Zeilen ---------- */
var listEl=$("list"), rowEls=new Map();
function buildRow(id){
  var row=el("article",{class:"row","data-id":id});
  var info=el("div",{class:"rinfo"});
  info.appendChild(el("div",{class:"rtop"},[el("span",{class:"no"}),el("span",{class:"pill"}),el("span",{class:"tag",text:"Extra"}),
    el("button",{type:"button",class:"teamb","data-act":"team","aria-pressed":"false"})]));
  info.appendChild(el("input",{type:"text",class:"rn","aria-label":"Routenname","data-f":"name"}));
  info.appendChild(el("input",{type:"text",class:"rnk",placeholder:"Spitzname","aria-label":"Spitzname (gilt für alle)","data-f":"rnick"}));
  info.appendChild(el("p",{class:"hint"}));
  info.appendChild(el("button",{type:"button",class:"rm","data-act":"rm",text:"Route entfernen"}));
  var cells=el("div",{class:"cells"});
  for(var i=0;i<NP;i++){
    var c=el("div",{class:"cell","data-p":i});
    c.appendChild(el("div",{class:"who"},[el("span",{text:MARK[i]}),el("span",{class:"wn"})]));
    c.appendChild(el("div",{class:"spw"},[el("img",{class:"spi",alt:"",loading:"lazy",hidden:""}),
      el("input",{type:"text",class:"sp",placeholder:"Pokémon (optional)","aria-label":"Pokémon, optional","data-f":"sp",role:"combobox","aria-autocomplete":"list","aria-controls":"pk","aria-expanded":"false",autocomplete:"off"})]));
    c.appendChild(el("div",{class:"tyl"}));
    var seg=el("div",{class:"seg",role:"group","aria-label":"Zustand"});
    [["alive","✓","Lebt"],["dead","✕","Tot"],["miss","∅","Nicht gefangen"]].forEach(function(b){
      seg.appendChild(el("button",{type:"button","data-act":"st","data-v":b[0],title:b[2],"aria-label":b[2],"aria-pressed":"false",text:b[1]}))});
    c.appendChild(seg);cells.appendChild(c);
  }
  var foot=el("div",{class:"foot",hidden:""});
  foot.appendChild(el("div",{class:"field"},[el("label",{text:"Encounter getötet von"}),el("select",{"data-f":"killer","aria-label":"Encounter getötet von"})]));
  var dch=el("div",{class:"chips",role:"group","aria-label":"Tod bei"});
  for(var q=0;q<NP;q++)dch.appendChild(el("button",{type:"button",class:"chipb","data-act":"death","data-p":q,"aria-pressed":"false"},[el("span",{text:MARK[q]+" "}),el("span",{class:"dn"})]));
  foot.appendChild(el("div",{class:"field"},[el("span",{class:"lbl",text:"Tod bei (im Kampf gefallen)"}),dch]));
  foot.appendChild(el("div",{class:"field"},[el("label",{text:"Ursache"}),el("input",{type:"text","data-f":"cause",placeholder:"z. B. Trainer, Crit, Fehlklick","aria-label":"Ursache"})]));
  foot.appendChild(el("button",{type:"button",class:"btn","data-act":"revive",text:"Link wiederbeleben"}));
  row.appendChild(info);row.appendChild(cells);row.appendChild(foot);
  return row;
}
function fill(inp,val){if(document.activeElement!==inp&&inp.value!==val)inp.value=val}
function fillSelect(sel){
  if(sel.options.length!==NP+1){sel.textContent="";[["-1","Nicht festgelegt"]].concat(IDX.map(function(i){return[String(i),pname(i)]})).forEach(function(o){sel.appendChild(el("option",{value:o[0],text:o[1]}))})}
  else{for(var j=0;j<NP;j++)sel.options[j+1].textContent=pname(j)}
}
function updateRow(row,id,idx){
  var r=S.routes.get(id);if(!r)return;var st=status(r);
  row.setAttribute("data-st",st);row.setAttribute("data-extra",r.extra?"1":"0");
  row.querySelector(".no").textContent=String(idx+1).padStart(2,"0");
  row.querySelector(".pill").textContent=STL[st];
  row.querySelector(".tag").hidden=!r.extra;
  var h=row.querySelector(".hint");h.textContent=r.hint||"";h.hidden=!r.hint;
  fill(row.querySelector('[data-f="name"]'),r.name||"");
  fill(row.querySelector('[data-f="rnick"]'),nickOf(r));
  row.querySelector(".rm").hidden=!r.custom;
  var tb=row.querySelector(".teamb"),inT=onTeam(r),full=!inT&&teamIds().length>=6;
  tb.hidden=!(inT||st==="alive");tb.setAttribute("aria-pressed",String(inT));tb.textContent=inT?"★ Im Team":"☆ Ins Team";
  tb.disabled=!canWrite||full;tb.title=full?"Das Team ist voll (6 Links)":"";
  for(var i=0;i<NP;i++){
    var c=row.querySelector('.cell[data-p="'+i+'"]'),d=cellOf(r,i);
    c.setAttribute("data-v",d.st);
    c.querySelector(".wn").textContent=pname(i);
    fill(c.querySelector('[data-f="sp"]'),d.sp);cellExtras(c,r,id,i,d);
    c.querySelectorAll(".seg button").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-v")===d.st))});
  }
  row.querySelector(".foot").hidden=st!=="dead";
  var sel=row.querySelector("select");fillSelect(sel);sel.value=String(typeof r.killer==="number"?r.killer:-1);
  fill(row.querySelector('[data-f="cause"]'),r.cause||"");
  row.querySelectorAll(".chipb").forEach(function(cb){var qi=+cb.getAttribute("data-p");cb.querySelector(".dn").textContent=pname(qi);cb.setAttribute("aria-pressed",String(!!(r.deaths||{})[P[qi]]))});
}
/* ---------- Team, Typen, Dupes ----------
   Team: Haken pro Route (routes/<id>.team), zählt nur bei komplett lebenden Links, höchstens sechs.
   Typ-Hinweis: pro Spieler zwei Team-Pokémon mit gleichem Primärtyp. Dupe-Hinweis: Familie (Entwicklungsreihe)
   hat dieser Spieler in einer früheren Route schon gefangen. Beides nur Hinweise, nichts wird gesperrt. */
function onTeam(r){return !!r.team&&status(r)==="alive"}
function teamIds(){return sorted().filter(function(e){return onTeam(e[1])}).map(function(e){return e[0]})}
function earlierCatch(i,fam,id){var r0=S.routes.get(id),o0=r0?r0.order||0:0,hit=null;
  if(!fam)return null;
  sorted().forEach(function(e){if(hit||e[0]===id||(e[1].order||0)>=o0)return;var d=cellOf(e[1],i);
    if((d.st==="alive"||d.st==="dead")&&famOf(dexOf(d.sp))===fam)hit=e[1]});
  return hit}
function cellExtras(c,r,id,i,d){
  var dx=dexOf(d.sp),img=c.querySelector(".spi"),ty=c.querySelector(".tyl");
  if(dx){var u=spriteUrl(dx);if(img.getAttribute("src")!==u)img.src=u;img.hidden=false}else{img.hidden=true;img.removeAttribute("src")}
  ty.textContent="";
  var tys=dx?typesOfName(d.sp)||[]:[];if(tys.length)ty.appendChild(tyList(tys,true));
  var hit=dx&&d.st!=="miss"?earlierCatch(i,famOf(dx),id):null;
  if(hit)ty.appendChild(el("b",{class:"dupe",text:"⚠ Dupe: Familie schon gefangen ("+(hit.name||"Route")+")"}));
  ty.hidden=!ty.children.length;
}
function teamClashes(ids){var out=[];
  IDX.forEach(function(i){var seen={};ids.forEach(function(id){var r=S.routes.get(id),t0=(typesOfName(cellOf(r,i).sp)||[])[0];if(t0===undefined)return;var t=TYPES[t0];(seen[t]=seen[t]||[]).push(nickOf(r)||r.name||id)});
    Object.keys(seen).forEach(function(t){if(seen[t].length>1)out.push({i:i,type:t,names:seen[t]})})});
  return out}
function renderTeam(){
  var ids=teamIds(),box=$("team");box.textContent="";
  $("teamNote").textContent=ids.length+" von 6 Links";
  if(!ids.length)box.appendChild(el("p",{class:"empty2",text:"Noch kein Link im Team. Bei einer lebenden Route „☆ Ins Team“ anklicken."}));
  var cl=teamClashes(ids),bad={};cl.forEach(function(c){c.names.forEach(function(n){bad[c.i+"|"+n]=c.type})});
  ids.forEach(function(id){var r=S.routes.get(id),nm=nickOf(r)||r.name||"";
    var card=el("div",{class:"card tm"},[el("div",{class:"tmh"},[el("b",{text:nm}),el("small",{text:nickOf(r)?r.name||"":""})])]);
    IDX.forEach(function(i){var d=cellOf(r,i),dx=dexOf(d.sp),line=el("div",{class:"tmp","data-p":String(i)});
      line.appendChild(dx?el("img",{class:"spi",alt:"",src:spriteUrl(dx),loading:"lazy"}):el("span",{class:"spi spx",text:MARK[i]}));
      var tx=typesOfName(d.sp)||[];
      line.appendChild(el("div",null,[el("span",{class:"tmn",text:d.sp||pname(i)}),tx.length?tyList(tx,true):el("small",{text:d.sp?"":"Pokémon nicht eingetragen"})]));
      if(bad[i+"|"+nm])line.setAttribute("data-clash","1");
      card.appendChild(line)});
    box.appendChild(card)});
  var w=$("teamWarn");w.textContent="";
  cl.forEach(function(c){w.appendChild(el("div",{text:"⚠ "+pname(c.i)+": "+c.names.join(" und ")+" haben beide den Primärtyp "+c.type+"."}))});
  w.hidden=!cl.length;
}
function matches(r,st){
  if(ui.filter!=="all"&&st!==ui.filter)return false;
  var q=ui.q.trim().toLowerCase();if(!q)return true;
  var hay=[r.name||"",nickOf(r)];for(var i=0;i<NP;i++){hay.push(cellOf(r,i).sp)}
  return hay.join(" ").toLowerCase().indexOf(q)>-1;
}
/* Routen erscheinen nacheinander: alles bis zur ersten noch offenen Standard-Route nach der letzten
   bearbeiteten. Eigene Routen immer, das Fossil (extra) blockiert nicht. Filter, Suche oder "Alle zeigen" zeigen alles. */
function revealLimit(arr){
  var last=-1;arr.forEach(function(e,i){if(!e[1].custom&&status(e[1])!=="open")last=i});
  for(var i=last+1;i<arr.length;i++){var r=arr[i][1];if(!r.custom&&!r.extra)return r.order||0}
  return Infinity;
}
function revealOn(){return ui.filter==="all"&&!ui.q.trim()&&!ui.showAll}
function renderList(){
  var arr=sorted(),seen={},shown=0,pos=0,lim=revealLimit(arr),rev=revealOn(),later=0;
  arr.forEach(function(e,idx){
    var id=e[0],row=rowEls.get(id);
    if(!row){row=buildRow(id);rowEls.set(id,row);if(!canWrite)row.querySelectorAll("input,select,button").forEach(function(x){x.disabled=true})}
    seen[id]=1;updateRow(row,id,idx);
    var vis=matches(e[1],status(e[1]));
    if(vis&&!e[1].custom&&(e[1].order||0)>lim){later++;if(rev)vis=false}
    row.hidden=!vis;if(vis)shown++;
    if(listEl.children[pos]!==row)listEl.insertBefore(row,listEl.children[pos]||null);
    pos++;
  });
  rowEls.forEach(function(row,id){if(!seen[id]){row.remove();rowEls.delete(id)}});
  var em=$("empty"),seed=$("seedBtn");
  if(arr.length===0){em.hidden=!routesLoaded;$("emptyT").textContent="Noch keine Routen. Lege die Standard-Routen an oder spiel unten ein Backup ein. (・・;)";seed.hidden=!canWrite}
  else{$("emptyT").textContent="Keine Route passt zum Filter. (・・;)";seed.hidden=true;em.hidden=shown>0||ui.view!=="edit"}
  $("rtCount").textContent=shown+" von "+arr.length+" Routen";
  var mb=$("moreBtn"),useful=later>0&&ui.filter==="all"&&!ui.q.trim();mb.hidden=!useful;
  if(useful)mb.textContent=ui.showAll?"Nur bisherige Routen zeigen":"Alle Routen zeigen ("+later+" weitere)";
  mb.setAttribute("aria-expanded",String(ui.showAll));
}

/* ---------- Gesamtliste ---------- */
function renderAllView(){
  for(var g=0;g<NP;g++)$("ah"+g).textContent=MARK[g]+" "+pname(g);
  var body=$("allBody");body.textContent="";
  sorted().forEach(function(e,idx){var r=e[1],st=status(r);if(!matches(r,st))return;
    var tr=el("tr",{"data-st":st},[el("td",{class:"n",text:String(idx+1).padStart(2,"0")}),el("td",{class:"k",text:(r.name||"")+(r.extra?" ✦":"")}),el("td",null,[el("span",{class:"mon"+(isLost(st)?" d":""),text:nickOf(r)})])]);
    for(var i=0;i<NP;i++){var d=cellOf(r,i),td=el("td");
      if(d.st==="miss")td.appendChild(el("span",{class:"sm2",text:"∅ nicht gefangen"}));
      else if(d.st||d.sp)td.appendChild(el("span",{class:d.sp?"":"sm2",text:(d.st==="dead"?"✕ ":"")+(d.sp||"gefangen")}));
      tr.appendChild(td)}
    tr.appendChild(el("td",null,[el("span",{class:"chip "+st,text:STC[st]})]));
    tr.appendChild(el("td",{text:isLost(st)?lossBy(r,st):""}));
    tr.appendChild(el("td",{text:st==="dead"?deathNames(r):""}));
    tr.appendChild(el("td",{text:isLost(st)?lossCause(r,st):""}));
    body.appendChild(tr)});
  if(!body.children.length)body.appendChild(el("tr",null,[el("td",{colspan:String(7+NP),text:"Keine Route passt zum Filter.",class:"sm2"})]));
}
function allText(){
  var lines=["Soul Link Run "+S.meta.run.no];sorted().forEach(function(e,idx){var r=e[1],st=status(r);if(!matches(r,st))return;
    var parts=IDX.map(function(i){var d=cellOf(r,i);return pname(i)+": "+(spText(d)||"-")});
    lines.push(String(idx+1).padStart(2,"0")+" "+(r.name||"")+(nickOf(r)?" – "+nickOf(r):"")+" | "+parts.join(" | ")+" | "+STC[st]+(isLost(st)?" (Encounter: "+lossBy(r,st)+(deathNames(r)?"; Tod bei "+deathNames(r):"")+(lossCause(r,st)?"; "+lossCause(r,st):"")+")":""))});
  return lines.join("\n");
}

/* ---------- Überblick, Spieler, Friedhof ---------- */
function renderStats(){
  var arr=sorted().map(function(e){return e[1]}),c={alive:0,dead:0,miss:0,part:0,open:0};
  arr.forEach(function(r){c[status(r)]++});
  var items=[["Routen",arr.length],["Aktive Links",c.alive+c.part],["Tote Links",c.dead],["Verpasst",c.miss],["Offen",c.open]];
  var k=$("kpis");k.textContent="";
  items.forEach(function(it){k.appendChild(el("div",{class:"card kpi"},[el("b",{text:String(it[1])}),el("span",{text:it[0]})]))});
  $("kpiNote").textContent=(c.alive+c.dead)+" komplette Links gefangen";
  var pl=$("players");
  if(!pl.children.length){for(var i=0;i<NP;i++){
    pl.appendChild(el("div",{class:"card pc","data-i":i},[
      el("div",{class:"nm"},[el("span",{class:"mk",text:MARK[i],"aria-hidden":"true"}),el("input",{type:"text","aria-label":"Name Spieler "+(i+1),"data-i":i})]),
      el("div",{class:"badgeline"}),el("div",{class:"pstats"})]))}}
  for(var i2=0;i2<NP;i2++){
    var card2=pl.children[i2],inp2=card2.querySelector("input");
    fill(inp2,(S.meta.players[P[i2]]||{}).name||"");inp2.placeholder=DEF[i2];
    var alive=0,dead=0,got=0;
    arr.forEach(function(r){var d=cellOf(r,i2);if(d.st==="alive"||d.st==="dead")got++;if(d.st==="alive")alive++;if(d.st==="dead")dead++});
    var bl=card2.querySelector(".badgeline");bl.textContent="";
    if(S.meta.run.status==="lost"&&(S.meta.run.enders||{})[P[i2]])bl.appendChild(el("span",{class:"badge",text:"Run-Ender (×_×)"}));
    var ps=card2.querySelector(".pstats");ps.textContent="";
    [["Gefangen",got],["Leben",alive],["Tot",dead]].forEach(function(s){ps.appendChild(el("div",null,[el("b",{text:String(s[1])}),el("span",{text:s[0]})]))});
  }
  for(var g=0;g<NP;g++)$("gh"+g).textContent=pname(g);
  var gb=$("grave");gb.textContent="";var deadRows=sorted().filter(function(e){return isLost(status(e[1]))});
  if(!deadRows.length)gb.appendChild(el("tr",null,[el("td",{colspan:String(5+NP),class:"sm2",text:tt("grave")})]));
  deadRows.forEach(function(e){var r=e[1],st=status(r);
    var tr=el("tr",null,[el("td",{class:"k",text:r.name||""}),el("td",{class:"k",text:nickOf(r)}),el("td",{text:lossBy(r,st)})]);
    for(var i=0;i<NP;i++){var d=cellOf(r,i);tr.appendChild(el("td",{text:d.st==="miss"?"∅":(d.sp||"–")}))}
    tr.appendChild(el("td",{text:deathNames(r)}));tr.appendChild(el("td",{text:lossCause(r,st)}));gb.appendChild(tr)});
}

/* ---------- Run, Zähler, Level-Caps ---------- */
var TK=[["run","Run"],["death","Death"],["enc","Encounter"]];
function live(i){var o={run:0,death:0,enc:0},rn=S.meta.run;
  if(rn.status==="lost"&&(rn.enders||{})[P[i]])o.run=1;
  S.routes.forEach(function(r){var st=status(r);
    if(st==="dead"){if((r.deaths||{})[P[i]])o.death++;if(r.killer===i)o.enc++}
    else if(st==="miss"&&cellOf(r,i).st==="miss")o.enc++});
  return o}
function missLive(i){var n=0;S.routes.forEach(function(r){if(status(r)==="miss"&&cellOf(r,i).st==="miss")n++});return n}
function baseOf(i,k){var t=(S.meta.tally||{})[P[i]]||{};return +t[k]||0}
function totalOf(i,k){return baseOf(i,k)+live(i)[k]}
function renderTally(){
  var tb=$("tally");
  if(!tb.children.length){for(var i=0;i<NP;i++){var tr=el("tr");
    tr.appendChild(el("td",{class:"k"},[el("span",{class:"mk sm",text:MARK[i],"aria-hidden":"true"}),el("span",{class:"tn"})]));
    TK.forEach(function(k){var td=el("td");td.appendChild(el("div",{class:"stepper"},[
      el("button",{type:"button",class:"stp","data-t":k[0],"data-p":i,"data-d":"-1","aria-label":k[1]+" verringern",text:"−"}),
      el("input",{type:"text",inputmode:"numeric","data-t":k[0],"data-p":i,"aria-label":k[1]}),
      el("button",{type:"button",class:"stp","data-t":k[0],"data-p":i,"data-d":"1","aria-label":k[1]+" erhöhen",text:"+"})]));
      td.appendChild(el("small",{class:"lv"}));tr.appendChild(td)});
    tb.appendChild(tr)}}
  for(var j=0;j<NP;j++){var row=tb.children[j],lv=live(j);
    row.querySelector(".tn").textContent=pname(j);
    TK.forEach(function(k,ki){var td=row.children[ki+1],inp=td.querySelector("input");
      inp.setAttribute("aria-label",k[1]+" "+pname(j));fill(inp,String(baseOf(j,k[0])+lv[k[0]]));
      td.querySelector(".lv").textContent=lv[k[0]]?"+"+lv[k[0]]+" dieser Run":""})}
}
function setTotal(i,key,v){if(!(v>=0))return;var part={tally:{}};part.tally[P[i]]={};part.tally[P[i]][key]=v-live(i)[key];patchMeta(part);renderTally();renderAna()}
function setRunNo(n){if(!(n>=1))return;patchMeta({run:{no:n}});renderRun()}
function capLv(c){var o=((S.meta.caps||{}).lv||{})[c.id];return typeof o==="number"&&o>0?o:c.lv}
function beaten(c){return !!(((S.meta.caps||{}).beaten||{})[c.id])}
function nextCap(){var C=caps();for(var i=0;i<C.length;i++)if(!beaten(C[i]))return C[i];return null}
function badgeCount(){return caps().filter(function(c){return c.gym&&beaten(c)}).length}
function renderCaps(){
  var box=$("caps"),nx=nextCap(),CAPS=caps();
  if(box.getAttribute("data-g")!==gameId()){box.textContent="";box.setAttribute("data-g",gameId())}
  if(!box.children.length){CAPS.forEach(function(c){
    box.appendChild(el("div",{class:"card cap","data-id":c.id},[
      el("button",{type:"button",class:"tick","data-id":c.id,"aria-pressed":"false","aria-label":c.name+" besiegt"}),
      el("div",null,[el("span",{class:"cn",text:c.name}),el("span",{class:"cp",text:c.place})]),
      el("label",{class:"lvw"},[el("span",{text:"Lv"}),el("input",{type:"text",inputmode:"numeric","data-id":c.id,"aria-label":"Level-Cap "+c.name})])]))})}
  CAPS.forEach(function(c,i){var card=box.children[i],on=beaten(c);
    card.setAttribute("data-on",on?"1":"0");card.setAttribute("data-next",nx&&nx.id===c.id?"1":"0");
    var t=card.querySelector(".tick");t.setAttribute("aria-pressed",String(on));t.textContent=on?"✓":"";
    fill(card.querySelector("input"),String(capLv(c)))});
  $("capLv").textContent=nx?String(capLv(nx)):"✓";
  $("capWho").textContent=nx?"bis "+nx.name:"alle geschafft";
}
/* Run-Status: "Verloren" setzt man per Knopf, "Gewonnen" ergibt sich, sobald jede Route gespielt ist
   (jeder hat gefangen oder verpasst, oder der Link ist tot). Das Fossil (extra) zählt nicht mit. */
function played(r){var st=status(r);return st!=="open"&&st!=="part"}
function routesLeft(){var n=0,any=false;S.routes.forEach(function(r){if(r.extra)return;any=true;if(!played(r))n++});return any?n:-1}
function runState(){var s=S.meta.run.status;if(s==="lost"||s==="won")return s;return routesLoaded&&routesLeft()===0?"won":"run"}
var lastRunState=null;
function renderRun(){
  var r=S.meta.run,state=runState();
  fill($("runNo"),String(r.no));
  var chip=$("runChip");chip.className="chip "+state;chip.textContent={run:"Läuft",lost:"Verloren",won:"Gewonnen"}[state];
  $("runLost").hidden=state!=="run";$("runWon").hidden=!(state==="run"&&backupAllowed());
  var back=$("runBack");back.hidden=!(r.status==="lost"||(r.status==="won"&&backupAllowed()));back.textContent=r.status==="won"?"Doch nicht gewonnen":"Doch nicht verloren";$("newRun").hidden=state==="run";
  var left=routesLeft();$("runHint").textContent=state==="run"&&left>0?"Gewonnen ist der Run automatisch, sobald jede Route gespielt ist (noch "+left+(left===1?" Route":" Routen")+").":"";
  if(loaded&&routesLoaded){if(state==="won"&&lastRunState&&lastRunState!=="won")fireworks();lastRunState=state}
  var lost=state==="lost";$("runEnd").hidden=!lost;
  $("enders").querySelectorAll("button").forEach(function(b){var i=+b.getAttribute("data-p");b.querySelector(".en").textContent=pname(i);b.setAttribute("aria-pressed",String(!!(r.enders||{})[P[i]]))});
  fill($("runWhere"),r.where||"");fill($("runCause"),r.cause||"");
  var names=IDX.filter(function(i){return (r.enders||{})[P[i]]}).map(pname).join(" und "),line=$("runLine");
  if(lost)line.textContent=(names?"Run beendet von "+names:"Run verloren")+" "+tt("lost");
  else if(state==="won")line.textContent=tt("won");
  else line.textContent=tt("run");
}

/* ---------- Schwächen-Karte ----------
   Gegner wählen (Pokémon samt Regionalformen oder ein bis zwei Typen). Gezeigt wird, welche Angriffstypen wie stark wirken,
   wogegen die Typen des Gegners stark sind und wie die lebenden Pokémon des Runs dagegen stehen. Die Typentabelle richtet sich
   nach der Generation des gewählten Spiels (Gen 1 ohne Unlicht, Stahl, Fee und mit den alten Ausnahmen, Gen 2 bis 5 ohne Fee).
   Reiner Anzeige-Zustand, nichts davon wird gespeichert. Typen der Pokémon stehen in js/types.js. */
var TYPES=["Normal","Feuer","Wasser","Pflanze","Elektro","Eis","Kampf","Gift","Boden","Flug","Psycho","Käfer","Gestein","Geist","Drache","Unlicht","Stahl","Fee"];
var TY_AB=["Nor","Feu","Was","Pfl","Ele","Eis","Kam","Gif","Bod","Flu","Psy","Käf","Ges","Gei","Dra","Unl","Sta","Fee"];
var TY_LT=[0,3,4,5,8,9,11,12,16,17];   // helle Typfarben bekommen dunkle Schrift
/* Je Angriffstyp: [sehr effektiv, nicht sehr effektiv, wirkungslos] gegen diese Typen, Stand ab Gen 6 */
var EFF=[[[],[12,16],[13]],[[3,5,11,16],[1,2,12,14]],[[1,8,12],[2,3,14]],[[2,8,12],[1,3,7,9,11,14,16]],[[2,9],[3,4,14],[8]],[[3,8,9,14],[1,2,5,16]],
  [[0,5,12,15,16],[7,9,10,11,17],[13]],[[3,17],[7,8,12,13],[16]],[[1,4,7,12,16],[3,11],[9]],[[3,6,11],[4,12,16]],[[6,7],[10,16],[15]],
  [[3,10,15],[1,6,7,9,13,16,17]],[[1,5,9,11],[6,8,16]],[[10,13],[15],[0]],[[14],[16],[17]],[[10,13],[6,15,17]],[[5,12,17],[1,2,4,16]],[[6,14,15],[1,7,16]]];
var chartCache={};
function tyGen(){return GAME().gen||5}
function tyEra(g){return g<=1?1:g<=5?2:6}
function tyCount(g){return [0,15,17,0,0,0,18][tyEra(g)]}
function chart(g){var e=tyEra(g);if(chartCache[e])return chartCache[e];
  var m=TYPES.map(function(_,a){var row=TYPES.map(function(){return 1});
    EFF[a][0].forEach(function(d){row[d]=2});EFF[a][1].forEach(function(d){row[d]=0.5});(EFF[a][2]||[]).forEach(function(d){row[d]=0});return row});
  if(e<6){m[13][16]=0.5;m[15][16]=0.5}                                   // bis Gen 5: Stahl widersteht Geist und Unlicht
  if(e===1){m[13][10]=0;m[11][7]=2;m[7][11]=2;m[5][1]=1}                 // Gen 1: Geist trifft Psycho nicht, Käfer/Gift gegenseitig stark, Eis neutral gegen Feuer
  return chartCache[e]=m}
function mult(m,a,defs){return defs.reduce(function(x,d){return x*m[a][d]},1)}
function decTypes(s){var o=[s.charCodeAt(0)-97];if(s.charAt(1)!=="-")o.push(s.charCodeAt(1)-97);return o}
function monTypes(dex,g){var best=null;
  POKE_TYPES_PAST.forEach(function(p){if(p[0]===dex&&g<=p[1]&&(!best||p[1]<best[1]))best=p});
  return decTypes(best?best[2]:POKE_TYPES.substr((dex-1)*2,2))}
var FORMS=POKE_FORMS.map(function(f){var b=POKE[f[0]-1];return {t:f[1]+"-"+b+(f[3]?" ("+f[3]+")":""),s:"#"+String(f[0]).padStart(3,"0"),dex:f[0],gen:f[2],ty:decTypes(f[4]),n1:norm(f[1]+b+f[3]),n2:norm(b+f[1]+f[3])}});
function formsOn(){var g=tyGen();return FORMS.filter(function(f){return g>=f.gen&&inGame(f.dex-1)})}
function typesOfName(name){var n=norm(name||"");if(!n)return null;
  var f=formsOn().filter(function(x){return x.n1===n||x.n2===n})[0];if(f)return f.ty;
  var i=NORM.indexOf(n);return i>-1&&inGame(i)?monTypes(i+1,tyGen()):null}
function wkSearch(q){var n=norm(q);if(!n)return [];var on=formsOn(),out=[],seen={};
  function add(h){if(!seen[h.t]){seen[h.t]=1;out.push(h)}}
  on.forEach(function(f){if(f.n1.indexOf(n)===0)add(f)});                 // „Alola…“ zuerst die Formen
  pokeHits(q).forEach(function(h){add(h);on.forEach(function(f){if(f.dex===h.dex)add(f)})});
  return out.slice(0,10)}
var wk={label:"",dex:0,form:false,types:[]};
function fmtX(x){return x===0?"0×":x===0.25?"¼×":x===0.5?"½×":x+"×"}
function tyBadge(t,sm){return el("span",{class:"ty"+(TY_LT.indexOf(t)>-1?" lt":"")+(sm?" sm":""),style:"--tyc:var(--ty"+t+")",text:TYPES[t]})}
function tyList(ts,sm){return el("div",{class:"tys"},ts.map(function(t){return tyBadge(t,sm)}))}
function wkScore(m,own){
  return {atk:Math.max.apply(null,own.map(function(a){return mult(m,a,wk.types)})),   // beste eigene Typ-Attacke gegen den Gegner
          def:Math.max.apply(null,wk.types.map(function(t){return mult(m,t,own)}))}}  // härtester Treffer vom Typ des Gegners
function wkVal(sc){return sc.atk/Math.max(sc.def,0.125)}
function renderWk(){
  var g=tyGen(),n=tyCount(g),m=chart(g);
  if(wk.dex&&!wk.form)wk.types=monTypes(wk.dex,g);
  wk.types=wk.types.filter(function(t){return t<n});
  var box=$("wkTypes");
  if(box.children.length!==n){box.textContent="";for(var t=0;t<n;t++)box.appendChild(el("button",{type:"button",class:"ty tyb"+(TY_LT.indexOf(t)>-1?" lt":""),style:"--tyc:var(--ty"+t+")","data-ty":String(t),"aria-pressed":"false",text:TYPES[t]}))}
  Array.prototype.forEach.call(box.children,function(b){b.setAttribute("aria-pressed",String(wk.types.indexOf(+b.getAttribute("data-ty"))>-1))});
  $("wkClear").hidden=!(wk.types.length||$("wkQ").value);
  var e=tyEra(g);
  $("wkGen").textContent="Typentabelle "+(e===1?"Gen 1":e===2?"Gen 2 bis 5":"ab Gen 6")+" für "+GAME().title+(e===1?": ohne Unlicht, Stahl und Fee, Geist wirkt nicht gegen Psycho.":e===2?": noch ohne Fee.":".");
  renderWkChart(m,n);
  var out=$("wkOut");out.textContent="";
  if(!wk.types.length){out.appendChild(el("p",{class:"empty2",text:"Wähle links einen Gegner. Dann siehst du, womit ihr angreifen solltet, was der Gegner hart trifft und welche eurer Pokémon gut dagegen stehen."}));return}
  out.appendChild(el("div",{class:"wk-h"},[el("b",{text:wk.label||"Gegner"}),tyList(wk.types)]));
  var all=[];for(var a=0;a<n;a++)all.push(a);
  // Angreifen mit …
  var b1=el("div",{class:"wk-b"},[el("h3",{text:"Angreifen mit"})]),neu=0;
  [[4,"sehr effektiv"],[2,"effektiv"],[0.5,"schwach"],[0.25,"sehr schwach"],[0,"wirkungslos"]].forEach(function(x){
    var ts=all.filter(function(a){return mult(m,a,wk.types)===x[0]});if(!ts.length)return;
    b1.appendChild(el("div",{class:"wk-r","data-x":String(x[0])},[el("div",{class:"wk-x"},[el("b",{text:fmtX(x[0])}),el("small",{text:x[1]})]),tyList(ts)]))});
  all.forEach(function(a){if(mult(m,a,wk.types)===1)neu++});
  if(neu)b1.appendChild(el("p",{class:"note",text:"Alle anderen "+neu+" Typen treffen normal (1×)."}));
  out.appendChild(b1);
  // Der Gegner trifft hart mit …
  var b2=el("div",{class:"wk-b"},[el("h3",{text:"Der Gegner trifft hart"})]);
  wk.types.forEach(function(t){var ts=all.filter(function(d){return m[t][d]===2});
    b2.appendChild(el("div",{class:"wk-r"},[el("div",{class:"wk-x"},[tyBadge(t),el("small",{text:"stark gegen"})]),ts.length?tyList(ts):el("span",{class:"sm2",text:"keinen Typ"})]))});
  var tough=all.filter(function(d){return wk.types.every(function(t){return m[t][d]<=0.5})});
  if(tough.length)b2.appendChild(el("div",{class:"wk-r","data-x":"tough"},[el("div",{class:"wk-x"},[el("b",{text:"Hält aus"}),el("small",{text:"alle seine Typen"})]),tyList(tough)]));
  out.appendChild(b2);
  renderWkTeam(out,m);
}
function renderWkTeam(out,m){
  var rows=[];
  sorted().forEach(function(e){var r=e[1];if(isLost(status(r)))return;var mons=[],any=false;
    for(var i=0;i<NP;i++){var c=cellOf(r,i),ty=c.st==="alive"?typesOfName(c.sp):null;
      mons.push(c.st!=="alive"?null:{sp:c.sp,ty:ty,sc:ty?wkScore(m,ty):null});if(ty)any=true}
    if(any)rows.push({r:r,mons:mons})});
  var b=el("div",{class:"wk-b"},[el("h3",{text:"Euer Team"})]);out.appendChild(b);
  if(!rows.length){b.appendChild(el("p",{class:"empty2",text:"Sobald lebende Pokémon in den Routen stehen, siehst du hier, wer gegen diesen Gegner gut steht."}));return}
  var best=IDX.map(function(i){var v=0;rows.forEach(function(x){var q=x.mons[i];if(q&&q.sc)v=Math.max(v,wkVal(q.sc))});return v});
  var hr=el("tr",null,[el("th",{text:"Link"})]);IDX.forEach(function(i){hr.appendChild(el("th",{class:"pk"+i,text:MARK[i]+" "+pname(i)}))});
  var body=el("tbody");
  rows.forEach(function(x){var tr=el("tr",null,[el("td",{class:"k",text:nickOf(x.r)||x.r.name||""})]);
    x.mons.forEach(function(q,i){var td=el("td");tr.appendChild(td);if(!q)return;
      td.appendChild(el("span",{class:"wk-mon",text:q.sp||"gefangen"}));
      if(!q.sc){td.appendChild(el("small",{class:"sm2",text:q.sp?"Typ unbekannt":""}));return}
      td.appendChild(tyList(q.ty,true));
      td.appendChild(el("div",{class:"wk-sc"},[
        el("span",{class:q.sc.atk>=2?"good":q.sc.atk<1?"bad":"",text:"trifft "+fmtX(q.sc.atk)}),
        el("span",{class:q.sc.def<=0.5?"good":q.sc.def>=2?"bad":"",text:"kassiert "+fmtX(q.sc.def)})]));
      if(best[i]>1&&wkVal(q.sc)===best[i]){td.className="best";td.appendChild(el("span",{class:"wk-tip",text:"Tipp"}))}})
    body.appendChild(tr)});
  b.appendChild(el("div",{class:"tw0"},[el("table",{class:"mini wk-tt"},[el("thead",null,[hr]),body])]));
  b.appendChild(el("p",{class:"note",text:"trifft = stärkste Attacke vom eigenen Typ, kassiert = härtester Treffer vom Typ des Gegners. Tipp = bester Konter je Spieler. Fähigkeiten (z. B. Schwebe), Items und Attacken anderer Typen sind nicht eingerechnet."}));
}
function renderWkChart(m,n){
  var box=$("wkChart");box.textContent="";var on=function(d){return wk.types.indexOf(d)>-1};
  var hr=el("tr",null,[el("th",{class:"c0",text:"Angriff ↓ · Ziel →"})]);
  for(var d=0;d<n;d++)hr.appendChild(el("th",{class:"ty-h"+(TY_LT.indexOf(d)>-1?" lt":"")+(on(d)?" on":""),style:"--tyc:var(--ty"+d+")",title:TYPES[d],text:TY_AB[d]}));
  var body=el("tbody");
  for(var a=0;a<n;a++){var tr=el("tr",null,[el("th",{class:"ty-r"+(TY_LT.indexOf(a)>-1?" lt":""),style:"--tyc:var(--ty"+a+")",text:TYPES[a]})]);
    for(d=0;d<n;d++){var x=m[a][d];tr.appendChild(el("td",{"data-x":String(x),class:on(d)?"on":"",title:TYPES[a]+" gegen "+TYPES[d]+": "+fmtX(x),text:x===1?"":fmtX(x).replace("×","")}))}
    body.appendChild(tr)}
  box.appendChild(el("table",{class:"mini tychart"},[el("thead",null,[hr]),body]));
}
function wkPick(h){wk={label:h.t,dex:h.dex,form:!!h.ty,types:h.ty?h.ty.slice():monTypes(h.dex,tyGen())};renderWk()}
function wkReset(){wk={label:"",dex:0,form:false,types:[]};$("wkQ").value="";closePk();renderWk()}
var wkQ=$("wkQ");
wkQ.addEventListener("input",function(){var v=wkQ.value,res=wkSearch(v),nv=norm(v);showPk(wkQ,res);
  var hit=res.filter(function(h){return norm(h.t)===nv||h.n1===nv||h.n2===nv})[0];
  if(hit)wkPick(hit);else if(!v.trim()&&wk.label){wk={label:"",dex:0,form:false,types:[]};renderWk()}else $("wkClear").hidden=!(wk.types.length||v)});
wkQ.addEventListener("keydown",function(e){pkKeys(e,wkQ,function(){return wkSearch(wkQ.value)})});
wkQ.addEventListener("focusout",function(){setTimeout(function(){if(document.activeElement!==wkQ&&pkFor===wkQ)closePk()},120)});
$("wkClear").addEventListener("click",wkReset);
$("wkTypes").addEventListener("click",function(e){var b=e.target.closest(".tyb");if(!b)return;var t=+b.getAttribute("data-ty");
  if(wk.label){wk={label:"",dex:0,form:false,types:[t]};wkQ.value=""}
  else{var k=wk.types.indexOf(t);if(k>-1)wk.types.splice(k,1);else if(wk.types.length<2)wk.types.push(t);else wk.types[1]=t}
  renderWk()});

/* ---------- Auswertung ---------- */
function barRow(label,p,val,max,extra){var w=max>0?Math.round(val/max*100):0;
  return el("div",{class:"bar","data-p":p},[el("span",{class:"nmb",text:label}),el("div",{class:"tr"},[el("div",{class:"fl",style:"width:"+w+"%"})]),el("span",{class:"vl"},[document.createTextNode(String(val))].concat(extra?[el("small",{text:extra})]:[]))])}
function topList(map,n){return Object.keys(map).map(function(k){return [k,map[k]]}).sort(function(a,b){return b[1].n-a[1].n}).slice(0,n)}
function hGame(h){return h.game||GAMES.def}
/* Verpasst pro Spieler in einem gespeicherten Run. Ältere Runs ohne perPlayer.miss: nur der erste, der nicht gefangen hat (killer). */
function missOfHist(h,i){var p=(h.perPlayer||{})[P[i]]||{};if(typeof p.miss==="number")return p.miss;
  return (h.deadLinks||[]).filter(function(d){return d.cause==="nicht gefangen"&&d.killer===i}).length}
function anaGames(){var s={};S.history.forEach(function(h){s[hGame(h.data)]=1});s[gameId()]=1;
  return GAMES.list.filter(function(g){return s[g.id]}).map(function(g){return g.id})}
function bars(box,vals){var sum=vals.reduce(function(a,b){return a+b},0),max=Math.max.apply(null,vals);
  vals.forEach(function(v,i){box.appendChild(barRow(pname(i),i,v,max,sum?Math.round(v/sum*100)+" %":""))});return sum}
function renderAna(){
  var gs=anaGames(),gsel=$("anaGame");
  if(ui.anaGame!=="all"&&gs.indexOf(ui.anaGame)<0)ui.anaGame="all";
  gsel.textContent="";gsel.appendChild(el("option",{value:"all",text:"Alle Spiele"}));
  gs.forEach(function(id){gsel.appendChild(el("option",{value:id,text:GAME(id).name}))});
  gsel.value=ui.anaGame;gsel.hidden=gs.length<2;
  var fg=ui.anaGame,curIn=fg==="all"||gameId()===fg;
  var H=S.history.map(function(h){return h.data}).filter(function(h){return fg==="all"||hGame(h)===fg}).sort(function(a,b){return (a.no||0)-(b.no||0)});
  /* Alle Spiele: Zähler aus dem Run-Kasten (inkl. Startwerten). Ein Spiel: Summe der gespeicherten Runs plus laufender Run, falls er dieses Spiel ist. */
  var tv=function(i,k){if(fg==="all")return totalOf(i,k);
    return H.reduce(function(a,h){return a+(+(((h.perPlayer||{})[P[i]]||{})[k])||0)},0)+(curIn?live(i)[k]:0)};
  var tot=$("anaTotals");tot.textContent="";
  TK.forEach(function(k){var box=el("div",{class:"card box"},[el("h3")]),sum=bars(box,IDX.map(function(i){return tv(i,k[0])}));
    box.firstChild.textContent=k[1]+" gesamt: "+sum;tot.appendChild(box)});
  var mb=el("div",{class:"card box"},[el("h3")]),ms=bars(mb,IDX.map(function(i){return H.reduce(function(a,h){return a+missOfHist(h,i)},0)+(curIn?missLive(i):0)}));
  mb.firstChild.textContent="Verpasst gesamt: "+ms;
  mb.appendChild(el("p",{class:"note",text:"Wie oft jemand auf einer Route nicht gefangen hat (gespeicherte Runs und laufender Run). Steckt auch in den Encountern."}));
  tot.appendChild(mb);
  $("anaNote").textContent=(H.length?H.length+(H.length===1?" Run gespeichert":" Runs gespeichert"):(fg==="all"?"Runs werden ab dem nächsten „Neuer Run starten“ gespeichert":"Noch kein Run gespeichert"))+(fg!=="all"?" · "+GAME(fg).name:"");
  var k=$("anaKpis");k.textContent="";
  var avg=function(f){return H.length?(H.reduce(function(a,h){return a+f(h)},0)/H.length):0};
  var best=H.slice().sort(function(a,b){return (b.badges||0)-(a.badges||0)||(b.links||0)-(a.links||0)})[0];
  [["Gespeicherte Runs",String(H.length)],["Ø Links pro Run",H.length?avg(function(h){return h.links||0}).toFixed(1).replace(".",","):"–"],["Ø Orden pro Run",H.length?avg(function(h){return h.badges||0}).toFixed(1).replace(".",","):"–"],["Bester Run",best?"Run "+best.no+" · "+(best.badges||0)+" Orden":"–"]]
    .forEach(function(it){k.appendChild(el("div",{class:"card kpi"},[el("b",{text:it[1],style:"font-size:28px"}),el("span",{text:it[0]})]))});
  var where={},routes={},stop={};
  H.forEach(function(h){var c=h.lastCap;if(h.status==="lost"&&c&&c!=="alle"){stop[c]=stop[c]||{n:0,label:c};stop[c].n++}});
  H.forEach(function(h){var w=(h.where||"").trim();if(h.status==="lost"&&w){var key=w.toLowerCase();where[key]=where[key]||{n:0,label:w};where[key].n++}
    (h.deadLinks||[]).forEach(function(d){var key=(d.route||"?");routes[key]=routes[key]||{n:0,label:key};routes[key].n++})});
  [["anaWhere",where,"Noch keine verlorenen Runs mit „Wo / gegen wen“ gespeichert."],["anaStop",stop,"Noch keine verlorenen Runs gespeichert."],["anaRoutes",routes,"Noch keine toten Links in gespeicherten Runs."]].forEach(function(x){
    var box=$(x[0]);box.textContent="";var top=topList(x[1],6);
    if(!top.length){box.appendChild(el("p",{class:"empty2",text:x[2]}));return}
    var max=top[0][1].n;top.forEach(function(t){box.appendChild(barRow(t[1].label,"x",t[1].n,max))})});
  var hb=$("histBody");hb.textContent="";
  if(!H.length)hb.appendChild(el("tr",null,[el("td",{colspan:"8",class:"sm2",text:"Noch kein Run gespeichert. Ältere Runs stecken nur in den Gesamtzahlen oben."})]));
  H.slice().reverse().forEach(function(h){var res={lost:"Verloren",won:"Gewonnen",run:"Abgebrochen"}[h.status]||"–";
    var en=IDX.filter(function(i){return (h.enders||{})[P[i]]}).map(pname).join(", ");
    var dt=h.endedAt?new Date(h.endedAt).toLocaleDateString("de-DE"):"";
    hb.appendChild(el("tr",null,[el("td",{class:"k"},[document.createTextNode("Run "+h.no),el("small",{class:"hg",text:GAME(h.game||GAMES.def).title})]),el("td",null,[el("span",{class:"chip "+(h.status||"run"),text:res})]),el("td",{text:en}),el("td",{text:h.where||""}),el("td",{text:String(h.badges||0)}),el("td",{text:String(h.links||0)}),el("td",{text:String((h.deadLinks||[]).length)}),el("td",{text:dt})]))});
}
function renderAll(){renderGame();renderRun();renderTeam();renderCaps();renderWk();renderTally();renderStats();renderList();if(ui.view==="all")renderAllView();renderAna();renderBk()}

/* ---------- Backup-Erinnerung ---------- */
var BK_DAYS=7, autoBk=null;   // autoBk: letztes automatisches Backup (GitHub Action, config.js autoBackupUrl)
function ageOf(iso){var t=Date.parse(iso||"");return isNaN(t)?null:Math.floor((Date.now()-t)/864e5)}
function ageText(iso){var a=ageOf(iso);return new Date(iso).toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"})+(a===0?" (heute)":a===1?" (gestern)":" (vor "+a+" Tagen)")}
function canon(x){if(Array.isArray(x))return "["+x.map(canon).join(",")+"]";
  if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+":"+canon(x[k])}).join(",")+"}";
  return JSON.stringify(x)}
function dataKey(meta,routes,history){var m=clone(meta);delete m.backupAt;return canon({meta:m,routes:routes,history:history})}
function autoBkCurrent(){   // entspricht das automatische Backup genau den aktuellen Daten?
  if(!autoBk)return false;var r={},h={};S.routes.forEach(function(v,id){r[id]=v});S.history.forEach(function(x){h[x.id]=x.data});
  return dataKey(dm(defMeta(),clone(autoBk.meta||{})),autoBk.routes||{},autoBk.history||{})===dataKey(S.meta,r,h);
}
function loadAutoBackup(){
  var url=(window.SOULLINK_CONFIG||{}).autoBackupUrl;if(!url||mode!=="firebase")return;
  fetch(url,{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(o){if(o&&o.app==="soullink-bw"){autoBk=o;renderBk()}}).catch(function(){});
}
function renderBk(){
  var man=S.meta.backupAt||"",auto=autoBk?autoBk.exportedAt:"",last=$("bkLast"),warn=$("bkWarn");
  var parts=[];if(auto)parts.push("Automatisch: "+ageText(auto));if(man)parts.push("Von Hand: "+ageText(man));
  last.textContent=parts.length?"Letzte Sicherung. "+parts.join(" · "):"Noch keine Sicherung gemacht.";
  var ages=[ageOf(man),ageOf(auto)].filter(function(a){return a!==null}),age=ages.length?Math.min.apply(null,ages):null;
  var show=loaded&&routesLoaded&&canWrite&&backupAllowed()&&S.routes.size>0&&(age===null||age>=BK_DAYS)&&!autoBkCurrent();
  warn.hidden=!show;
  if(show)$("bkWarnT").textContent=age===null?"Es gibt noch keine Sicherung der Daten.":"Die letzte Sicherung ist "+age+" Tage alt.";
}
function markBackup(){patchMeta({backupAt:new Date().toISOString()});renderBk()}

/* ---------- Neuer Run ---------- */
function startNewRun(){
  if(!canWrite||!store)return;
  var r=S.meta.run,c={alive:0,dead:0};S.routes.forEach(function(x){var s=status(x);if(s in c)c[s]++});
  var dead=sorted().filter(function(e){return isLost(status(e[1]))}).map(function(e){var x=e[1],st=status(x),mi=IDX.filter(function(i){return cellOf(x,i).st==="miss"});
    return {route:x.name||"",nick:nickOf(x),mons:IDX.map(function(i){return cellOf(x,i).sp}),killer:st==="miss"?(mi.length?mi[0]:-1):(typeof x.killer==="number"?x.killer:-1),deaths:clone(x.deaths||{}),cause:lossCause(x,st)}});
  var per={},tally={};for(var i=0;i<NP;i++){var lv=live(i);per[P[i]]={run:lv.run,death:lv.death,enc:lv.enc,miss:missLive(i)};tally[P[i]]={run:baseOf(i,"run")+lv.run,death:baseOf(i,"death")+lv.death,enc:baseOf(i,"enc")+lv.enc}}
  var nc=nextCap();
  var hist={no:+r.no||0,status:runState(),enders:clone(r.enders||{}),where:r.where||"",cause:r.cause||"",endedAt:new Date().toISOString(),badges:badgeCount(),lastCap:nc?nc.name:"alle",links:c.alive+c.dead,deadLinks:dead,perPlayer:per};
  if(S.meta.game)hist.game=S.meta.game;   // ohne gesetztes Spiel: Schwarz/Weiß (und alte Firestore-Regeln bleiben gültig)
  var hid="run"+hist.no+"-"+Date.now().toString(36);
  S.history.push({id:hid,data:hist});
  store.set("history/"+hid,hist).catch(function(){setSync("warn","Run-Verlauf nicht gespeichert")});
  var next={tally:tally,run:{no:(+r.no||0)+1,status:"run",enders:NO_DEATHS(),where:"",cause:""}};
  var ng=S.meta.nextGame;
  if(ng&&GAMES.byId[ng]&&ng!==gameId()){patchMeta(next);switchGame(ng);return}
  var n=0;S.routes.forEach(function(x,id){patchRoute(id,{nick:"",team:false,cells:EMPTY_CELLS(),killer:-1,cause:"",deaths:NO_DEATHS()},450+n*90);n++});
  var beat={};caps().forEach(function(cp){beat[cp.id]=false});next.caps={beaten:beat};
  patchMeta(next);
  ui.showAll=false;renderAll();
}

/* ---------- Eingaben ---------- */
function rowsOf(t){var row=t.closest(".row");return row?row.getAttribute("data-id"):null}
function onCellInput(t){
  var id=rowsOf(t);if(!id)return;var f=t.getAttribute("data-f"),r=S.routes.get(id),cell=t.closest(".cell");
  if(f==="name")patchRoute(id,{name:t.value});
  else if(f==="cause")patchRoute(id,{cause:t.value});
  else if(f==="rnick"){var nk=t.value.trim(),cs={};
    for(var k=0;k<NP;k++){var cc=cellOf(r,k);if(nk&&!cc.st&&status(r)!=="miss")cs[P[k]]={st:"alive"};else if(!nk&&cc.st==="alive"&&!cc.sp)cs[P[k]]={st:""}}
    patchRoute(id,{nick:t.value,cells:cs})}
  else if(cell){var pi=+cell.getAttribute("data-p"),p=P[pi],part={};part[p]={};part[p][f]=t.value;
    var cur=cellOf(r,pi),has=!!(t.value.trim()||nickOf(r).trim());
    if(!cur.st&&has)part[p].st=status(r)==="miss"?"dead":"alive";else if(cur.st==="alive"&&!has)part[p].st="";
    patchRoute(id,{cells:part})}
  var row=t.closest(".row");updateRow(row,id,Array.from(listEl.children).indexOf(row));renderStats();renderRun();renderTeam();if(wk.types.length)renderWk();
}
listEl.addEventListener("input",function(e){var t=e.target;onCellInput(t);if(t.getAttribute("data-f")==="sp")showPk(t)});
listEl.addEventListener("keydown",function(e){var t=e.target;if(t.getAttribute("data-f")==="sp")pkKeys(e,t)});
listEl.addEventListener("focusout",function(e){if(e.target===pkFor)setTimeout(function(){if(document.activeElement!==pkFor)closePk()},120)});
listEl.addEventListener("change",function(e){
  var t=e.target;if(t.getAttribute("data-f")!=="killer")return;patchRoute(rowsOf(t),{killer:+t.value});renderAll();
});
listEl.addEventListener("click",function(e){
  var b=e.target.closest("button[data-act]");if(!b||b.disabled)return;var id=rowsOf(b),r=S.routes.get(id),act=b.getAttribute("data-act");
  if(act==="st"){
    var ci=+b.closest(".cell").getAttribute("data-p"),v=b.getAttribute("data-v"),cur=cellOf(r,ci).st,cells={},extra={};
    var next=cur===v?"":v;cells[P[ci]]={st:next};
    if(next==="dead"){
      for(var i=0;i<NP;i++)if(i!==ci&&cellOf(r,i).st==="alive"){cells[P[i]]={st:"dead"}}
      if(!(typeof r.killer==="number"&&r.killer>-1))extra.killer=ci;
      extra.deaths={};extra.deaths[P[ci]]=true;
    }else if(next==="miss"){
      for(var m=0;m<NP;m++)if(m!==ci&&cellOf(r,m).st==="alive")cells[P[m]]={st:"dead"};
    }else{extra.deaths={};extra.deaths[P[ci]]=false;
      if(cur==="miss"&&!IDX.some(function(j){return j!==ci&&cellOf(r,j).st==="miss"}))
        for(var a=0;a<NP;a++)if(a!==ci&&cellOf(r,a).st==="dead"&&!(r.deaths||{})[P[a]])cells[P[a]]={st:"alive"};
    }
    patchRoute(id,dm({cells:cells},extra));
    if(status(r)!=="dead"&&(r.killer>-1||r.cause||deathNames(r)))patchRoute(id,{killer:-1,cause:"",deaths:NO_DEATHS()});
  }else if(act==="death"){
    var di=+b.getAttribute("data-p"),dd={};dd[P[di]]=!((r.deaths||{})[P[di]]);
    var pp={deaths:dd};if(dd[P[di]]&&!(typeof r.killer==="number"&&r.killer>-1))pp.killer=di;
    patchRoute(id,pp);
  }else if(act==="revive"){
    var c2={};for(var k=0;k<NP;k++)if(cellOf(r,k).st==="dead")c2[P[k]]={st:"alive"};
    patchRoute(id,{cells:c2,killer:-1,cause:"",deaths:NO_DEATHS()});
  }else if(act==="team"){
    if(!r.team&&teamIds().length>=6)return;
    patchRoute(id,{team:!onTeam(r)});
  }else if(act==="rm"){
    if(b.getAttribute("data-sure")!=="1"){b.setAttribute("data-sure","1");b.textContent="Wirklich entfernen?";return}
    S.routes.delete(id);pend.delete(id);if(store)store.del("routes/"+id).catch(function(){setSync("warn","Löschen fehlgeschlagen")});
  }
  renderAll();
});
$("addBtn").addEventListener("click",function(){
  if(!canWrite||!store)return;
  var max=0;S.routes.forEach(function(r){if((r.order||0)>max)max=r.order||0});
  var id="c"+Date.now().toString(36),r={order:Math.floor(max)+1,name:"Neue Route",nick:"",custom:true,team:false,killer:-1,cause:"",deaths:NO_DEATHS(),cells:EMPTY_CELLS()};
  S.routes.set(id,r);setView("edit");renderAll();
  store.set("routes/"+id,r).catch(function(){setSync("warn","Speichern fehlgeschlagen")});
  var row=rowEls.get(id);if(row){var inp=row.querySelector('[data-f="name"]');row.scrollIntoView({block:"center"});inp.focus();inp.select()}
});
async function seedRoutes(){
  if(!canWrite||!store)return;$("seedBtn").disabled=true;
  var R=GAME().routes;
  for(var i=0;i<R.length;i++){var d=R[i],r=newRoute(d);
    S.routes.set(d.id,r);try{await store.set("routes/"+d.id,r)}catch(e){setSync("warn","Speichern fehlgeschlagen")}await sleep(40)}
  $("seedBtn").disabled=false;renderAll();
}
function newRoute(d){var r={order:d.order,name:d.name,nick:"",custom:false,team:false,killer:-1,cause:"",deaths:NO_DEATHS(),cells:EMPTY_CELLS()};
  if(d.extra){r.extra=true;r.hint=d.hint||""}return r}
/* Spiel wechseln: Routen des neuen Spiels anlegen (gleiche IDs werden überschrieben), übrige Routen löschen,
   Level-Caps zurücksetzen (auch eigene Level, die IDs g1 … g8 usw. gelten in jedem Spiel). */
function runEmpty(){var any=false;S.routes.forEach(function(r){if(nickOf(r))any=true;for(var i=0;i<NP;i++){var c=cellOf(r,i);if(c.st||c.sp)any=true}});return !any&&S.meta.run.status!=="lost"}
async function switchGame(g){
  if(!canWrite||!store||!GAMES.byId[g])return;
  var c=S.meta.caps||{},beat={},lv={};
  Object.keys(c.beaten||{}).concat(GAME(g).caps.map(function(x){return x.id})).forEach(function(k){beat[k]=false});
  Object.keys(c.lv||{}).forEach(function(k){lv[k]=0});
  patchMeta({game:g,nextGame:"",caps:{beaten:beat,lv:lv}});
  var R=GAME(g).routes,keep={},old=Array.from(S.routes.keys());R.forEach(function(d){keep[d.id]=1});
  old.forEach(function(id){clearTimeout(timers.get(id));pend.delete(id);S.routes.delete(id)});
  var objs=R.map(function(d){var r=newRoute(d);S.routes.set(d.id,r);return r});   // eigene Kopie: ein Snapshot zwischendurch kann S.routes kurz ändern
  ui.showAll=false;renderAll();
  for(var i=0;i<R.length;i++){try{await store.set("routes/"+R[i].id,objs[i])}catch(e){setSync("warn","Speichern fehlgeschlagen")}await sleep(40)}
  for(var j=0;j<old.length;j++)if(!keep[old[j]]){try{await store.del("routes/"+old[j])}catch(e){setSync("warn","Löschen fehlgeschlagen")}await sleep(40)}
}
function pickGame(g){
  if(!canWrite||!backupAllowed()||!GAMES.byId[g])return;
  if(g===gameId()){patchMeta({nextGame:""});renderGame();return}
  if(runEmpty()){switchGame(g);return}
  patchMeta({nextGame:g});renderGame();
}
var gameSel=$("gameSel");
GAMES.list.forEach(function(g){gameSel.appendChild(el("option",{value:g.id,text:g.name+" ("+g.region+", Gen "+g.gen+")"}))});
gameSel.addEventListener("change",function(){pickGame(gameSel.value)});
$("anaGame").addEventListener("change",function(){ui.anaGame=this.value;renderAna()});
function renderGame(){
  var g=GAME(),ng=S.meta.nextGame&&GAMES.byId[S.meta.nextGame]&&S.meta.nextGame!==gameId()?GAMES.byId[S.meta.nextGame]:null;
  document.title="Soul Link "+g.title;$("gameH").textContent=g.title;$("tagline").textContent=tt("tag");
  $("gameBox").hidden=!(canWrite&&backupAllowed());
  fill(gameSel,ng?ng.id:g.id);
  $("gameNote").textContent=ng?"Gilt ab „Neuer Run starten“. Bis dahin läuft "+g.name+".":"Wechsel gilt sofort, solange im Run nichts eingetragen ist, sonst ab „Neuer Run starten“. Routen und Level-Caps sind ein Vorschlag und lassen sich ändern.";
}
$("seedBtn").addEventListener("click",seedRoutes);
$("moreBtn").addEventListener("click",function(){ui.showAll=!ui.showAll;renderList()});
function setView(v){ui.view=v;
  $("viewSeg").querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",String(x.getAttribute("data-v")===v))});
  listEl.hidden=v!=="edit";$("viewAll").hidden=v!=="all";$("listFoot").hidden=v!=="edit";
  renderList();if(v==="all")renderAllView();
}
$("viewSeg").addEventListener("click",function(e){var b=e.target.closest("button");if(b)setView(b.getAttribute("data-v"))});
$("filter").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;ui.filter=b.getAttribute("data-v");
  this.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});renderList();if(ui.view==="all")renderAllView()});
$("q").addEventListener("input",function(){ui.q=this.value;renderList();if(ui.view==="all")renderAllView()});
function copyText(txt,note,onOk){
  function fail(){note.textContent="Kopieren blockiert, bitte Text manuell markieren";note.classList.add("err")}
  try{navigator.clipboard.writeText(txt).then(function(){note.classList.remove("err");note.textContent="Kopiert ✧";if(onOk)onOk()},fail)}catch(e){fail()}
  setTimeout(function(){note.textContent=""},3500);
}
$("copyBtn").addEventListener("click",function(){copyText(allText(),$("copyNote"))});
$("players").addEventListener("input",function(e){var t=e.target,i=t.getAttribute("data-i");if(i===null)return;
  var part={players:{}};part.players[P[+i]]={name:t.value};patchMeta(part);
  renderRun();renderTally();renderAna();for(var g=0;g<NP;g++)$("gh"+g).textContent=pname(g);
  rowEls.forEach(function(row,id){updateRow(row,id,Array.from(listEl.children).indexOf(row))});
  if(ui.view==="all")renderAllView()});
$("runWhere").addEventListener("input",function(){patchMeta({run:{where:this.value}})});
$("runCause").addEventListener("input",function(){patchMeta({run:{cause:this.value}})});
$("runLost").addEventListener("click",function(){if(!canWrite)return;patchMeta({run:{status:"lost"}});renderAll()});
$("runWon").addEventListener("click",function(){if(!canWrite||!backupAllowed())return;patchMeta({run:{status:"won"}});renderAll()});
$("runBack").addEventListener("click",function(){if(!canWrite)return;patchMeta({run:{status:"run"}});renderAll()});

/* ---------- Feuerwerk beim Sieg (Farben aus dem aktiven Theme) ----------
   Raketen mit Funkenregen, dazu Explosionen als Pixelbild: Pokéball, dann die überlebenden Pokémon (Pikachu als Ersatz). */
var FW_SHAPES={
  ball:["....KKKKK....","..KKRRRRRKK..",".KRRRRRRRRRK.",".KRRRRRRRRRK.","KRRRRRRRRRRRK","KRRRRKKKRRRRK","KKKKKKWKKKKKK","KWWWWKKKWWWWK","KWWWWWWWWWWWK",".KWWWWWWWWWK.",".KWWWWWWWWWK.","..KKWWWWWKK..","....KKKKK...."],
  pika:["K.............K","KK...........KK",".KY.........YK.",".YY.........YY.","..YY.......YY..","..YYYYYYYYYYY..",".YYYYYYYYYYYYY.",".YYKKYYYYYKKYY.",".YYKKYYYYYKKYY.","YYYYYYYKYYYYYYY","YRRYYYYYYYYYRRY","YRRYYKYYYKYYRRY",".YYYYYKKKYYYYY.","..YYYYYYYYYYY..","....YYYYYYY...."]
};
/* Figuren der überlebenden Pokémon (spriteUrl), je Spieler bis zu zwei zufällige Pokémon aus komplett
   lebenden Links, höchstens sechs. Fehlt ein Sprite, springt Pikachu ein. */
function winDex(){
  var per=IDX.map(function(){return []});
  sorted().forEach(function(e){if(status(e[1])!=="alive")return;for(var i=0;i<NP;i++){var d=dexOf(cellOf(e[1],i).sp);if(d)per[i].push(d)}});
  var out=[];
  for(var round=0;round<2;round++)for(var i=0;i<NP;i++){var pool=per[i].filter(function(d){return out.indexOf(d)<0});if(pool.length&&out.length<6)out.push(pool[Math.floor(Math.random()*pool.length)])}
  return out;
}
function bitmapShape(name,pal){var m=FW_SHAPES[name],cells=[];
  for(var r=0;r<m.length;r++)for(var c=0;c<m[r].length;c++)if(m[r][c]!==".")cells.push([c,r,pal[m[r][c]]]);
  return {cols:m[0].length,rows:m.length,cells:cells}}
function spriteShape(dex){return new Promise(function(res){
  var im=new Image();im.crossOrigin="anonymous";
  im.onload=function(){try{
    var w=im.width,h=im.height,c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");x.drawImage(im,0,0);
    var d=x.getImageData(0,0,w,h).data,x0=w,y0=h,x1=-1,y1=-1,X,Y;
    for(Y=0;Y<h;Y++)for(X=0;X<w;X++)if(d[(Y*w+X)*4+3]>127){if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y}
    if(x1<0){res(null);return}
    var st=Math.max(1,Math.ceil(Math.max(x1-x0+1,y1-y0+1)/44)),cols=Math.ceil((x1-x0+1)/st),rows=Math.ceil((y1-y0+1)/st),cells=[];
    for(var r=0;r<rows;r++)for(var cc=0;cc<cols;cc++){var px=Math.min(x1,x0+cc*st+(st>>1)),py=Math.min(y1,y0+r*st+(st>>1)),i=(py*w+px)*4;
      if(d[i+3]>=128)cells.push([cc,r,"rgb("+d[i]+","+d[i+1]+","+d[i+2]+")"])}
    res({cols:cols,rows:rows,cells:cells});
  }catch(e){res(null)}};
  im.onerror=function(){res(null)};
  im.src=spriteUrl(dex);
})}
function fireworks(){
  try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return}catch(e){}
  var cs=getComputedStyle(document.documentElement),cv0=function(v,d){return cs.getPropertyValue(v).trim()||d};
  var cols=["--pink","--sky","--mint","--lemon","--lilac","--p0","--p1","--p2"].map(function(v){return cs.getPropertyValue(v).trim()}).filter(Boolean);
  if(!cols.length)return;
  var PAL={K:cv0("--ink","#1d1d2b"),R:cv0("--pink","#e3262a"),W:cv0("--surface","#fff"),Y:cv0("--lemon","#f8d030")};
  // Figuren: erst der Pokéball, dann die Pokémon (Sprites laden schon, während die Raketen steigen)
  var figs=[{shape:bitmapShape("ball",PAL)}],dexes=winDex();
  if(!dexes.length)figs.push({shape:bitmapShape("pika",PAL)});
  dexes.forEach(function(dx){var f={shape:undefined};figs.push(f);spriteShape(dx).then(function(sh){f.shape=sh})});
  var cv=document.createElement("canvas");cv.className="fw";cv.setAttribute("aria-hidden","true");document.body.appendChild(cv);
  var ctx=cv.getContext("2d"),W=innerWidth,H=innerHeight,dpr=window.devicePixelRatio||1;
  cv.width=W*dpr;cv.height=H*dpr;ctx.scale(dpr,dpr);
  var G=0.12,rockets=[],sparks=[],pix=[],t0=performance.now(),last=t0,plan=[],XS=[0.5,0.27,0.73,0.38,0.62,0.3,0.7];
  var span=1800+figs.length*1600;
  for(var t=0;t<span;t+=420+Math.random()*200)plan.push({t:t,k:"r"});
  figs.forEach(function(f,i){plan.push({t:1800+i*1600,k:"s",f:f,x:XS[i%XS.length]})});
  plan.sort(function(a,b){return a.t-b.t});
  function pick(){return cols[Math.floor(Math.random()*cols.length)]}
  function rocket(x,h,c,fig){rockets.push({x:x,y:H,vx:fig?0:(Math.random()-0.5)*1.6,vy:-Math.sqrt(2*G*h),c:c,fig:fig})}
  function burst(x,y,c){var n=100+Math.floor(Math.random()*50),c2=pick();
    for(var k=0;k<n;k++){var a=Math.random()*Math.PI*2,sp=2+Math.random()*5;sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,dec:0.008+Math.random()*0.008,c:k%3?c:c2})}}
  function shapeBurst(x,y,sh,now){
    var cell=Math.max(4,Math.min(24,Math.min(W,H)*0.4/Math.max(sh.cols,sh.rows)));
    sh.cells.forEach(function(q){pix.push({x0:x,y0:y,tx:x+(q[0]-sh.cols/2+0.5)*cell,ty:y+(q[1]-sh.rows/2+0.5)*cell,sz:cell*0.9,c:q[2],born:now,vy:0,dy:0,ph:Math.random()*6})});
    burst(x,y,PAL.Y);}
  function frame(now){
    var f=Math.min(3,Math.max(0,(now-last)/16.7));last=now;
    while(plan.length&&now-t0>=plan[0].t){var p=plan.shift();
      if(p.k==="r")rocket(W*(0.12+Math.random()*0.76),H*(0.45+Math.random()*0.3),pick(),null);
      else rocket(W*p.x,H*0.6,PAL.Y,p.f)}
    ctx.globalCompositeOperation="destination-out";ctx.fillStyle="rgba(0,0,0,"+Math.min(1,0.2*f)+")";ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation="source-over";
    rockets=rockets.filter(function(r){r.x+=r.vx*f;r.y+=r.vy*f;r.vy+=G*f;ctx.globalAlpha=1;ctx.fillStyle=r.c;ctx.beginPath();ctx.arc(r.x,r.y,r.fig?4:3,0,7);ctx.fill();
      if(r.vy>=-0.6){if(r.fig)shapeBurst(r.x,r.y,r.fig.shape||bitmapShape("pika",PAL),now);else burst(r.x,r.y,r.c);return false}return true});
    sparks=sparks.filter(function(s){s.vx*=Math.pow(0.985,f);s.vy=s.vy*Math.pow(0.985,f)+0.05*f;s.x+=s.vx*f;s.y+=s.vy*f;s.life-=s.dec*f;
      if(s.life<=0)return false;ctx.globalAlpha=s.life;ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(s.x,s.y,3,0,7);ctx.fill();return true});
    pix=pix.filter(function(q){var age=(now-q.born)/1000,x,y,al=1;
      if(age<0.55){var e=1-Math.pow(1-age/0.55,3);x=q.x0+(q.tx-q.x0)*e;y=q.y0+(q.ty-q.y0)*e}
      else if(age<2.3){x=q.tx;y=q.ty;al=0.82+0.18*Math.sin(now/90+q.ph)}
      else{q.vy+=0.06*f;q.dy+=q.vy*f;x=q.tx;y=q.ty+q.dy;al=1-(age-2.3)/1.3;if(al<=0)return false}
      ctx.globalAlpha=al;ctx.fillStyle=q.c;ctx.fillRect(x-q.sz/2,y-q.sz/2,q.sz,q.sz);return true});
    ctx.globalAlpha=1;
    if(plan.length||rockets.length||sparks.length||pix.length)requestAnimationFrame(frame);else cv.remove();
  }
  requestAnimationFrame(frame);
  setTimeout(function(){cv.remove()},40000);
}
$("enders").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;var i=+b.getAttribute("data-p"),part={run:{enders:{}}};part.run.enders[P[i]]=!(S.meta.run.enders||{})[P[i]];patchMeta(part);renderAll()});
$("runNoM").addEventListener("click",function(){setRunNo((+S.meta.run.no||1)-1)});
$("runNoP").addEventListener("click",function(){setRunNo((+S.meta.run.no||0)+1)});
$("runNo").addEventListener("change",function(){var v=parseInt(this.value,10);if(isNaN(v)||v<1){renderRun();return}setRunNo(v)});
$("tally").addEventListener("click",function(e){var b=e.target.closest("button.stp");if(!b)return;var i=+b.getAttribute("data-p"),k=b.getAttribute("data-t");setTotal(i,k,totalOf(i,k)+(+b.getAttribute("data-d")))});
$("tally").addEventListener("change",function(e){var t=e.target;if(t.tagName!=="INPUT")return;var v=parseInt(t.value,10),i=+t.getAttribute("data-p"),k=t.getAttribute("data-t");if(isNaN(v)||v<0){renderTally();return}setTotal(i,k,v)});
$("caps").addEventListener("click",function(e){var b=e.target.closest(".tick");if(!b)return;var id=b.getAttribute("data-id"),part={caps:{beaten:{}}};
  part.caps.beaten[id]=!((S.meta.caps||{}).beaten||{})[id];patchMeta(part);renderCaps()});
$("caps").addEventListener("change",function(e){var t=e.target;if(t.tagName!=="INPUT")return;var v=parseInt(t.value,10),id=t.getAttribute("data-id");
  if(isNaN(v)||v<1){renderCaps();return}var part={caps:{lv:{}}};part.caps.lv[id]=v;patchMeta(part);renderCaps()});
var nrTimer;
$("newRun").addEventListener("click",function(){
  var b=this;
  if(b.getAttribute("data-sure")!=="1"){b.setAttribute("data-sure","1");var ng=S.meta.nextGame&&GAMES.byId[S.meta.nextGame]&&S.meta.nextGame!==gameId()?GAMES.byId[S.meta.nextGame]:null;b.textContent="Wirklich? Run "+((+S.meta.run.no||0)+1)+(ng?" in "+ng.title:"")+" starten";clearTimeout(nrTimer);nrTimer=setTimeout(function(){b.removeAttribute("data-sure");b.textContent="Neuer Run starten"},6000);return}
  clearTimeout(nrTimer);b.removeAttribute("data-sure");b.textContent="Neuer Run starten";startNewRun();
});

/* ---------- Backup ---------- */
function exportData(){var o={app:"soullink-bw",version:2,exportedAt:new Date().toISOString(),meta:clone(S.meta),routes:{},history:{}};
  S.routes.forEach(function(r,id){o.routes[id]=clone(r)});S.history.forEach(function(h){o.history[h.id]=clone(h.data)});return JSON.stringify(o)}
async function importData(txt){
  var o=JSON.parse(txt);if(!o||o.app!=="soullink-bw"||!o.meta||!o.routes)throw new Error("Das ist kein Soul-Link-Backup.");
  await store.set("meta/main",dm(defMeta(),o.meta));
  var ids=Object.keys(o.routes);
  for(var i=0;i<ids.length;i++){await store.set("routes/"+ids[i],o.routes[ids[i]]);await sleep(40)}
  var old=Array.from(S.routes.keys());for(var j=0;j<old.length;j++)if(!o.routes[old[j]]){await store.del("routes/"+old[j]);await sleep(40)}
  var hs=Object.keys(o.history||{});for(var h=0;h<hs.length;h++){await store.set("history/"+hs[h],o.history[hs[h]]);await sleep(40)}
  return ids.length;
}
$("bkCopy").addEventListener("click",function(){copyText(exportData(),$("bkS1"),markBackup)});
$("bkDl").addEventListener("click",function(){var a=el("a",{href:URL.createObjectURL(new Blob([exportData()],{type:"application/json"})),download:"soullink-backup-run"+S.meta.run.no+".json"});document.body.appendChild(a);a.click();a.remove();markBackup()});
$("bkWarnGo").addEventListener("click",function(){var box=$("bkBox");box.open=true;box.scrollIntoView({behavior:"smooth",block:"start"});($("bkDl").hidden?$("bkCopy"):$("bkDl")).focus({preventScroll:true})});
$("bkFile").addEventListener("change",function(){var f=this.files&&this.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){$("bkIn").value=String(rd.result||"")};rd.readAsText(f)});
var bkTimer;
$("bkGo").addEventListener("click",async function(){
  var b=this,s=$("bkS2");s.classList.remove("err");
  if(!canWrite||!store){s.textContent="Speichern ist hier nicht möglich.";s.classList.add("err");return}
  var txt=$("bkIn").value.trim();if(!txt){s.textContent="Bitte zuerst ein Backup einfügen oder eine Datei wählen.";s.classList.add("err");return}
  try{var o=JSON.parse(txt);if(o.app!=="soullink-bw")throw 0}catch(e){s.textContent="Das ist kein gültiges Soul-Link-Backup.";s.classList.add("err");return}
  if(b.getAttribute("data-sure")!=="1"){b.setAttribute("data-sure","1");b.textContent="Wirklich ersetzen?";s.textContent="Backup von Run "+(o.meta&&o.meta.run?o.meta.run.no:"?")+" mit "+Object.keys(o.routes||{}).length+" Routen. Die aktuellen Daten werden ersetzt.";
    clearTimeout(bkTimer);bkTimer=setTimeout(function(){b.removeAttribute("data-sure");b.textContent="Backup einspielen"},8000);return}
  clearTimeout(bkTimer);b.removeAttribute("data-sure");b.textContent="Backup einspielen";b.disabled=true;s.textContent="Spiele ein …";
  try{var n=await importData(txt);s.textContent="Fertig: "+n+" Routen eingespielt ✧";$("bkIn").value=""}catch(e){s.textContent="Fehler: "+(e&&e.message?e.message:"Einspielen fehlgeschlagen");s.classList.add("err")}
  b.disabled=false;
});

/* ---------- Anmeldung und Rechte (nur Firebase-Modus) ----------
   Anzeigen nur nach Freigabe (setGate), lesen könnten die Firestore-Regeln aber noch jeden lassen. Schreiben darf, wer mit Google angemeldet ist und entweder Admin ist
   (config.js adminUid) oder dessen E-Mail in access/main steht. Backup und Freischaltung nur für den Admin.
   Die echte Prüfung machen die Firestore-Regeln; die Seite blendet nur passend ein und aus. */
function backupAllowed(){return mode!=="firebase"||isAdmin}
/* Zugang: Im Firebase-Modus sehen nur der Admin und die unter „Schreibrechte“ eingetragenen Konten das Dashboard,
   alle anderen die Willkommensseite (#gate). Daten werden erst nach der Freigabe abonniert. */
var subscribed=false;
function setGate(st){   // st: "" = Dashboard zeigen, sonst "load" | "out" | "no"
  document.body.classList.toggle("gated",!!st);var g=$("gate");g.setAttribute("data-s",st||"");if(!st)return;
  var who=authUser?(authUser.email||authUser.displayName||""):"";
  $("gateT").textContent={load:"Einen Moment …",out:"Willkommen, Trainer!",no:"Kein Zugang"}[st];
  $("gateP").textContent={load:"Anmeldung wird geprüft.",out:"Dieses Dashboard ist nur für die Mitspieler dieses Soul Links. Meldet euch mit eurem Google-Konto an, um es zu sehen.",no:who+" ist nicht freigeschaltet. Melde dich mit dem Konto an, das der Admin eingetragen hat."}[st];
  if(st==="no"&&authUser&&!CFG0.adminUid)$("gateP").textContent="Noch kein Admin eingerichtet. Deine Firebase-UID: "+authUser.uid+" – trage sie mit „python tools/setup.py --admin "+authUser.uid+"“ ein und lade die Regeln neu hoch (siehe docs/INSTALLATION.md).";
  var b=$("gateBtn");b.hidden=st==="load";b.textContent=st==="no"?"Abmelden":"Mit Google anmelden";
  if(st!=="load")setSync("warn",st==="out"?"Nicht angemeldet":"Kein Zugang");
}
function setCanWrite(v){
  if(canWrite===v)return;canWrite=v;document.body.classList.toggle("ro",!v);
  rowEls.forEach(function(row){row.remove()});rowEls.clear();   // Zeilen neu bauen, damit Felder (de)aktiviert werden
  renderAll();if(loaded)setSync("live",v?LIVE_LABEL:"Nur Lesen");
}
function applyRole(){
  $("bkSec").hidden=!backupAllowed();
  $("accSec").hidden=!(mode==="firebase"&&isAdmin);
  applyThemeRole();
  renderBk();renderRun();renderGame();
}
function renderAuth(){
  var box=$("auth"),t=$("authT"),b=$("authBtn");box.hidden=mode!=="firebase";if(box.hidden)return;
  if(!authKnown){t.textContent="";b.hidden=true;return}
  b.hidden=false;
  if(!authUser){t.textContent="";b.textContent="Mit Google anmelden";box.removeAttribute("data-s");return}
  var who=authUser.displayName||authUser.email||"Angemeldet";
  b.textContent="Abmelden";
  if(canWrite){t.textContent=who+(isAdmin?" (Admin)":"");box.setAttribute("data-s","ok")}
  else{t.textContent=(authUser.email||who)+" ist nicht freigeschaltet";box.setAttribute("data-s","no")}
}
var accUnsub=null;
function watchAccess(){
  if(accUnsub){accUnsub();accUnsub=null}
  if(!isAdmin)return;
  accUnsub=firebase.firestore().doc("access/main").onSnapshot(function(s){
    var ta=$("accEmails");if(document.activeElement!==ta)ta.value=((s.exists&&s.data().emails)||[]).join("\n");
  },function(){$("accS").textContent="Freischaltungen konnten nicht geladen werden.";$("accS").classList.add("err")});
}
async function onAuth(u){
  authUser=u;authKnown=true;var adminUid=(window.SOULLINK_CONFIG||{}).adminUid||"";
  isAdmin=!!(u&&adminUid&&u.uid===adminUid);
  var ok=false;
  if(u&&isAdmin)ok=true;
  else if(u){try{await firebase.firestore().doc("access/main").get();ok=true}catch(e){ok=false}}   // lesbar nur für Freigeschaltete
  if(!ok&&subscribed){location.reload();return}   // abgemeldet oder Zugang entzogen: Seite ohne geladene Daten neu aufbauen
  setCanWrite(ok);applyRole();renderAuth();watchAccess();
  setGate(ok?"":(u?"no":"out"));
  if(ok&&!subscribed)subscribe();
}
$("authBtn").addEventListener("click",function(){
  if(!auth)return;
  if(authUser){auth.signOut();return}
  var p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});
  auth.signInWithPopup(p).catch(function(e){
    var c=e&&e.code||"";
    if(c==="auth/popup-blocked"||c==="auth/operation-not-supported-in-this-environment")auth.signInWithRedirect(p);
    else if(c!=="auth/popup-closed-by-user"&&c!=="auth/cancelled-popup-request")setSync("warn","Anmeldung fehlgeschlagen");
  });
});
$("gateBtn").addEventListener("click",function(){$("authBtn").click()});
$("accSave").addEventListener("click",function(){
  var s=$("accS");s.classList.remove("err");
  var list=$("accEmails").value.split(/[\s,;]+/).map(function(x){return x.trim().toLowerCase()}).filter(Boolean);
  var bad=list.filter(function(x){return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)});
  if(bad.length){s.textContent="Keine gültige E-Mail: "+bad.join(", ");s.classList.add("err");return}
  list=list.filter(function(x,i){return list.indexOf(x)===i});
  if(list.length>10){s.textContent="Höchstens 10 Adressen.";s.classList.add("err");return}
  firebase.firestore().doc("access/main").set({emails:list})   // eigenes Dokument, nicht Teil von meta/routes
    .then(function(){s.textContent="Gespeichert ✧ ("+list.length+" freigeschaltet)"},function(){s.textContent="Speichern fehlgeschlagen";s.classList.add("err")});
});

/* ---------- Theme-Umschalter (nur Admin) ---------- */
function themeChoiceAllowed(){return mode==="firebase"?(authKnown&&isAdmin):true}
function storedTheme(){try{return localStorage.getItem("soullink-theme")}catch(e){return null}}
function applyThemeRole(){
  var ok=themeChoiceAllowed();$("themeSeg").hidden=!ok;
  if(mode==="firebase"&&!authKnown)return;   // Anmeldung noch offen: nichts umschalten, sonst flackert es beim Admin
  setTheme(ok?(storedTheme()||DEFAULT_THEME):DEFAULT_THEME,false);
}
function setTheme(t,save){
  if(THEMES.indexOf(t)<0)t=DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme",t);
  if(save){try{localStorage.setItem("soullink-theme",t)}catch(e){}}
  $("themeSeg").querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-t")===t))});
  renderAll();
}
$("themeSeg").addEventListener("click",function(e){var b=e.target.closest("button");if(b&&themeChoiceAllowed())setTheme(b.getAttribute("data-t"),true)});
setTheme(themeName(),false);

/* ---------- Start ---------- */
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.onload=res;s.onerror=function(){rej(new Error("Script "+src))};document.head.appendChild(s)})}
var LIVE_LABEL="Live synchronisiert";
function ready(fromCache){if(!fromCache){loaded=true;clearTimeout(tm);setSync(mode==="local"?"warn":"live",canWrite?LIVE_LABEL:"Nur Lesen");renderBk()}}
function subscribe(){
  subscribed=true;tm=setTimeout(function(){if(!loaded)setSync("warn","Daten noch nicht erreichbar")},10000);
  var err=function(){setSync("warn","Verbindung getrennt")};
  store.watchDoc("meta/main",function(d,fc){
    if(d&&!metaPend&&!metaBusy){S.meta=dm(defMeta(),clone(d));renderAll()}
    ready(fc)},err);
  store.watchCol("routes",function(docs,fc){
    var ids={};
    docs.forEach(function(d){ids[d.id]=1;if(pend.has(d.id)||busy.has(d.id))return;S.routes.set(d.id,clone(d.data))});
    Array.from(S.routes.keys()).forEach(function(id){if(!ids[id]&&!pend.has(id))S.routes.delete(id)});
    if(!fc)routesLoaded=true;renderAll();ready(fc)},err);
  store.watchCol("history",function(docs){S.history=docs.map(function(d){return {id:d.id,data:clone(d.data)}});renderAna()},err);
}
renderAll();
var tm=null;
(async function(){
  var CFG=window.SOULLINK_CONFIG||null;
  try{
    if(!TEST&&CFG&&CFG.firebase&&CFG.firebase.projectId&&CFG.firebase.projectId.indexOf("DEIN")!==0){
      mode="firebase";LIVE_LABEL="Live synchronisiert";
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
      firebase.initializeApp(CFG.firebase);store=makeFirebaseStore(firebase.firestore());
      $("bkDl").hidden=false;
      setCanWrite(false);applyRole();renderAuth();setGate("load");   // bis die Anmeldung geklärt ist: Willkommensseite
      auth=firebase.auth();auth.onAuthStateChanged(onAuth);
      loadAutoBackup();
    }else if(!TEST&&window.claude&&window.claude.use){
      mode="artifact";
      var user=await claude.use("user");
      if(user&&user.can){try{var w=await user.can("data.write");if(w===false)canWrite=false}catch(e){}}
      var db=await claude.use("db");
      if(!db){setSync("warn","Zum Speichern bitte in claude.ai anmelden");return}
      if(!canWrite)document.body.classList.add("ro");
      store=makeArtifactStore(db);
    }else{
      mode="local";LIVE_LABEL=TEST?"Testmodus":"Nur auf diesem Gerät gespeichert";store=makeLocalStore();$("bkDl").hidden=false;
    }
  }catch(e){mode="local";LIVE_LABEL="Online-Speicher nicht erreichbar, nur lokal";store=makeLocalStore();$("bkDl").hidden=false;setCanWrite(true);applyRole();renderAuth()}
  if(mode!=="firebase"){applyThemeRole();setGate("");subscribe()}   // lokal/Artifact: keine Anmeldung; Firebase abonniert erst in onAuth()
})();
})();
