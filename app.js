const STORAGE_KEY = 'mtgTournamentManagerPWA_v1';
const VERSION = 1;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const nowISO = () => new Date().toISOString();
const formatDate = iso => new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));

let state = loadState();
let view = 'home';
let selectedTournamentId = null;
let modal = null;

function defaultState(){ return {version:VERSION, players:[], tournaments:[]}; }
function loadState(){
  try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? {...defaultState(),...JSON.parse(raw)} : defaultState(); }
  catch { return defaultState(); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function playerById(id){ return state.players.find(p=>p.id===id); }
function tournamentById(id){ return state.tournaments.find(t=>t.id===id); }
function activeTournament(){ return selectedTournamentId ? tournamentById(selectedTournamentId) : null; }
function eventLabel(v){ return ({prerelease:'Prerelease',sealed:'Sealed',draft:'Draft',casual:'Casual',league:'Lega',competitive:'Competitivo',other:'Altro'})[v]||v; }
function formatLabel(v){ return ({round_robin:'Round Robin',swiss:'Swiss'})[v]||v; }

function init(){
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
}

function render(){
  const app = $('#app');
  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="brand"><div class="brandmark">M</div><div><h1>MTG Tournament Manager</h1><small>Local-first · iPad</small></div></div>
        <button class="btn secondary small" id="backupBtn">Backup</button>
      </header>
      <main class="shell">${renderView()}</main>
      <nav class="nav">
        ${navButton('home','Home')}${navButton('players','Giocatori')}${navButton('new','Nuovo torneo')}${navButton('history','Storico')}
      </nav>
      ${renderModal()}
    </div>`;
  bindCommon();
  bindView();
}
function navButton(id,label){ return `<button data-view="${id}" class="${view===id?'active':''}">${label}</button>`; }
function renderView(){
  if(view==='players') return renderPlayers();
  if(view==='new') return renderNewTournament();
  if(view==='history') return renderHistory();
  if(view==='tournament') return renderTournament();
  return renderHome();
}
function hero(title,subtitle){ return `<section class="hero"><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></section>`; }

function renderHome(){
  const active = state.tournaments.filter(t=>t.status==='active');
  const last = [...state.tournaments].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  return `${hero('Tournament control, senza server.','Tutti i dati restano su questo iPad. Puoi usarlo offline dopo l’installazione.')}
  <div class="grid">
    ${stat('Giocatori',state.players.length)}${stat('Tornei',state.tournaments.length)}${stat('Attivi',active.length)}${stat('Completati',state.tournaments.filter(t=>t.status==='closed').length)}
  </div>
  <div class="section-title"><h2>Tornei attivi</h2><button class="btn small" data-view="new">Nuovo torneo</button></div>
  ${active.length ? `<div class="list">${active.map(t=>tournamentItem(t)).join('')}</div>` : `<div class="empty">Nessun torneo attivo.</div>`}
  ${last ? `<div class="section-title"><h2>Ultimo torneo</h2></div>${tournamentItem(last)}`:''}`;
}
function stat(label,value){ return `<div class="card stat span-3"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`; }
function tournamentItem(t){
  return `<div class="list-item" data-open-tournament="${t.id}"><div class="avatar">${t.format==='round_robin'?'RR':'S'}</div><div class="meta"><strong>${esc(t.name)}</strong><small>${formatLabel(t.format)} · ${eventLabel(t.eventType)} · ${t.participantIds.length} giocatori</small></div><span class="spacer"></span><span class="badge ${t.status==='closed'?'green':'blue'}">${t.status==='closed'?'Chiuso':'Attivo'}</span></div>`;
}

function renderPlayers(){
  const sorted=[...state.players].sort((a,b)=>a.name.localeCompare(b.name,'it'));
  return `${hero('Giocatori','Anagrafica condivisa da tutti i tornei.')}
  <div class="grid"><div class="card span-4"><h3>Aggiungi giocatore</h3><form id="playerForm"><div class="field"><label>Nome</label><input class="input" id="playerName" autocomplete="off" placeholder="Nome giocatore" required /></div><button class="btn block">Aggiungi</button></form></div>
  <div class="span-8"><div class="section-title" style="margin-top:0"><h2>${sorted.length} giocatori</h2></div>${sorted.length?`<div class="list">${sorted.map(p=>`<div class="list-item"><div class="avatar">${esc(p.name.trim().charAt(0).toUpperCase())}</div><div class="meta"><strong>${esc(p.name)}</strong><small>Aggiunto ${formatDate(p.createdAt)}</small></div><span class="spacer"></span><button class="btn danger small" data-delete-player="${p.id}">Elimina</button></div>`).join('')}</div>`:`<div class="empty">Aggiungi il primo giocatore.</div>`}</div></div>`;
}

function renderNewTournament(){
  if(state.players.length<2) return `${hero('Nuovo torneo','Crea prima almeno due giocatori.')}<div class="notice warn">Servono almeno due giocatori nell’anagrafica.</div>`;
  return `${hero('Nuovo torneo','Round Robin per giocare tutti contro tutti; Swiss per tornei a turni abbinati.')}
  <form class="card" id="tournamentForm">
    <div class="grid">
      <div class="span-6 field"><label>Nome torneo</label><input class="input" id="tName" placeholder="Prerelease — nome espansione" required /></div>
      <div class="span-3 field"><label>Formato</label><select id="tFormat"><option value="round_robin">Round Robin</option><option value="swiss">Swiss</option></select></div>
      <div class="span-3 field"><label>Tipologia evento</label><select id="tEvent"><option value="prerelease">Prerelease</option><option value="sealed">Sealed</option><option value="draft">Draft</option><option value="casual">Casual</option><option value="league">Lega</option><option value="competitive">Competitivo</option><option value="other">Altro</option></select></div>
    </div>
    <div class="section-title"><h2>Partecipanti</h2><button type="button" class="btn ghost small" id="selectAll">Seleziona tutti</button></div>
    <div class="checklist">${[...state.players].sort((a,b)=>a.name.localeCompare(b.name,'it')).map(p=>`<label class="check"><input type="checkbox" name="participant" value="${p.id}" /><span>${esc(p.name)}</span></label>`).join('')}</div>
    <div style="height:16px"></div><button class="btn block" type="submit">Crea torneo</button>
  </form>`;
}

function renderHistory(){
  const ts=[...state.tournaments].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return `${hero('Storico tornei','Apri un torneo concluso per consultare turni e classifica finale.')}
  ${ts.length?`<div class="list">${ts.map(t=>tournamentItem(t)).join('')}</div>`:`<div class="empty">Ancora nessun torneo.</div>`}`;
}

function renderTournament(){
  const t=activeTournament(); if(!t){view='home';return renderHome();}
  const standings=computeStandings(t);
  const current=t.rounds.length ? t.rounds[t.rounds.length-1] : null;
  const canNext=current ? roundComplete(current) : true;
  return `${hero(t.name,`${formatLabel(t.format)} · ${eventLabel(t.eventType)} · ${t.participantIds.length} giocatori`)}
  <div class="row wrap">
    <span class="badge ${t.status==='closed'?'green':'blue'}">${t.status==='closed'?'Torneo concluso':'Torneo attivo'}</span>
    ${t.format==='round_robin'?`<span class="badge">Bo3</span>`:''}
    <span class="spacer"></span>
    <button class="btn secondary small" id="exportStandings">Esporta classifica CSV</button>
    ${t.status==='active'?`<button class="btn secondary small" id="closeTournament">Chiudi torneo</button>`:''}
  </div>
  <div class="section-title"><h2>Classifica</h2><p>${t.rounds.filter(roundComplete).length} round completati</p></div>
  ${standingsTable(standings)}
  <div class="section-title"><h2>Turni</h2>${t.status==='active' ? nextRoundButton(t,canNext) : ''}</div>
  ${t.rounds.length ? [...t.rounds].reverse().map((r,i)=>renderRound(t,r,i===0)).join('') : `<div class="empty">Nessun turno generato.</div>`}`;
}
function nextRoundButton(t,canNext){
  const total=t.format==='round_robin'?roundRobinRoundCount(t.participantIds.length):recommendedSwissRounds(t.participantIds.length);
  const done=t.rounds.length>=total;
  if(done) return `<span class="badge green">Calendario completo</span>`;
  return `<button class="btn small" id="nextRound" ${canNext?'':'disabled'}>${t.rounds.length?'Genera prossimo round':'Genera Round 1'}</button>`;
}
function standingsTable(rows){
  return `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Giocatore</th><th>Pt</th><th>V</th><th>P</th><th>N</th><th>OMW%</th><th>GWP%</th><th>OGW%</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="rank">${i+1}</td><td><strong>${esc(r.name)}</strong></td><td><strong>${r.points}</strong></td><td>${r.wins}</td><td>${r.losses}</td><td>${r.draws}</td><td>${pct(r.omw)}</td><td>${pct(r.gwp)}</td><td>${pct(r.ogw)}</td></tr>`).join('')}</tbody></table></div>`;
}
function pct(v){return `${(v*100).toFixed(1)}%`;}
function renderRound(t,r,isCurrent){
  const matches=r.matches.map(m=>{
    if(m.bye){const p=playerById(m.p1); return `<div class="bye"><strong>${esc(p?.name||'')}</strong> riceve un bye (3 punti, 2–0)</div>`;}
    const p1=playerById(m.p1),p2=playerById(m.p2); const opts=['','0','1','2'];
    const select=(side,val)=>`<select data-score="${side}" data-match="${m.id}">${opts.map(o=>`<option value="${o}" ${String(val??'')===o?'selected':''}>${o===''?'—':o}</option>`).join('')}</select>`;
    return `<div class="match"><div class="player">${esc(p1?.name||'')}</div><div class="scorebox">${select('s1',m.s1)}<span class="dash">—</span>${select('s2',m.s2)}</div><div class="player right">${esc(p2?.name||'')}</div><button class="btn small save-result" data-save-match="${m.id}">Salva</button></div>`;
  }).join('');
  return `<section class="round" style="margin-bottom:14px"><div class="round-head"><strong>Round ${r.number}</strong>${isCurrent?'<span class="badge blue">Corrente</span>':''}${roundComplete(r)?'<span class="badge green">Completo</span>':''}</div><div class="round-body">${matches}</div></section>`;
}

function renderModal(){
  if(!modal) return '';
  if(modal.type==='backup') return `<div class="modal-backdrop"><div class="modal"><h2>Backup e ripristino</h2><p class="muted">I dati sono salvati localmente su questo iPad. Esporta periodicamente un backup JSON.</p><div class="row wrap"><button class="btn" id="downloadBackup">Esporta backup</button><label class="btn secondary" style="display:inline-grid;place-items:center"><input type="file" id="importBackup" accept="application/json,.json" hidden />Importa backup</label><button class="btn ghost" id="closeModal">Chiudi</button></div><div class="notice warn" style="margin-top:16px">Importare un backup sostituisce i dati presenti sul dispositivo.</div></div></div>`;
  return '';
}

function bindCommon(){
  $$('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;selectedTournamentId=null;render();});
  $$('[data-open-tournament]').forEach(el=>el.onclick=()=>{selectedTournamentId=el.dataset.openTournament;view='tournament';render();});
  $('#backupBtn').onclick=()=>{modal={type:'backup'};render();};
  $('#closeModal')?.addEventListener('click',()=>{modal=null;render();});
  $('#downloadBackup')?.addEventListener('click',downloadBackup);
  $('#importBackup')?.addEventListener('change',importBackup);
}
function bindView(){
  $('#playerForm')?.addEventListener('submit',e=>{e.preventDefault();const name=$('#playerName').value.trim();if(!name)return;if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('Giocatore già presente.');state.players.push({id:uid('p'),name,createdAt:nowISO()});saveState();render();});
  $$('[data-delete-player]').forEach(b=>b.onclick=()=>{const id=b.dataset.deletePlayer;if(state.tournaments.some(t=>t.participantIds.includes(id)))return alert('Questo giocatore compare già in un torneo e non può essere eliminato.');if(confirm('Eliminare il giocatore?')){state.players=state.players.filter(p=>p.id!==id);saveState();render();}});
  $('#selectAll')?.addEventListener('click',()=>$$('input[name="participant"]').forEach(x=>x.checked=true));
  $('#tournamentForm')?.addEventListener('submit',createTournament);
  $('#nextRound')?.addEventListener('click',generateNextRound);
  $$('[data-save-match]').forEach(b=>b.onclick=()=>saveMatch(b.dataset.saveMatch));
  $('#closeTournament')?.addEventListener('click',closeTournament);
  $('#exportStandings')?.addEventListener('click',exportStandings);
}

function createTournament(e){
  e.preventDefault(); const name=$('#tName').value.trim(); const format=$('#tFormat').value; const eventType=$('#tEvent').value; const participantIds=$$('input[name="participant"]:checked').map(x=>x.value);
  if(participantIds.length<2)return alert('Seleziona almeno due partecipanti.');
  const t={id:uid('t'),name,format,eventType,status:'active',createdAt:nowISO(),closedAt:null,participantIds,rounds:[]};
  state.tournaments.push(t);saveState();selectedTournamentId=t.id;view='tournament';render();
}
function generateNextRound(){
  const t=activeTournament(); if(!t||t.status!=='active')return;
  if(t.rounds.length && !roundComplete(t.rounds[t.rounds.length-1]))return alert('Completa tutti i risultati del round corrente.');
  const total=t.format==='round_robin'?roundRobinRoundCount(t.participantIds.length):recommendedSwissRounds(t.participantIds.length);
  if(t.rounds.length>=total)return alert('Tutti i round previsti sono già stati generati.');
  let round;
  if(t.format==='round_robin') round=roundRobinSchedule(t.participantIds)[t.rounds.length]; else round=createSwissRound(t);
  t.rounds.push(round);saveState();render();
}
function saveMatch(matchId){
  const t=activeTournament(); let m=null; for(const r of t.rounds){m=r.matches.find(x=>x.id===matchId);if(m)break;} if(!m)return;
  const s1el=$(`[data-score="s1"][data-match="${matchId}"]`),s2el=$(`[data-score="s2"][data-match="${matchId}"]`); const a=s1el.value,b=s2el.value;
  if(a===''||b==='')return alert('Inserisci entrambi i risultati.'); const s1=Number(a),s2=Number(b);
  if(t.format==='round_robin' && s1===2 && s2===2)return alert('Un Bo3 non può terminare 2–2.');
  m.s1=s1;m.s2=s2;saveState();render();
}
function closeTournament(){
  const t=activeTournament(); if(t.rounds.length && !roundComplete(t.rounds[t.rounds.length-1]))return alert('Completa il round corrente prima di chiudere il torneo.');
  if(confirm('Chiudere definitivamente il torneo?')){t.status='closed';t.closedAt=nowISO();saveState();render();}
}
function roundComplete(r){return r.matches.every(m=>m.bye || (Number.isInteger(m.s1)&&Number.isInteger(m.s2)));}
function roundRobinRoundCount(n){if(n<=1)return 0;return n%2===0?n-1:n;}
function recommendedSwissRounds(n){return n<=1?0:Math.ceil(Math.log2(n));}
function roundRobinSchedule(ids){
  const arr=[...ids]; if(arr.length%2)arr.push(null); const n=arr.length; const rounds=[]; let rot=[...arr];
  for(let r=0;r<n-1;r++){
    const matches=[];
    for(let i=0;i<n/2;i++){
      const a=rot[i],b=rot[n-1-i];
      if(a===null||b===null){const p=a??b;matches.push({id:uid('m'),p1:p,p2:null,s1:2,s2:0,bye:true});}
      else matches.push({id:uid('m'),p1:a,p2:b,s1:null,s2:null,bye:false});
    }
    rounds.push({number:r+1,matches});
    rot=[rot[0],rot[n-1],...rot.slice(1,n-1)];
  }
  return rounds;
}
function createSwissRound(t){
  const num=t.rounds.length+1; const standings=computeStandings(t); const points=Object.fromEntries(standings.map(x=>[x.id,x.points])); let ids=[...t.participantIds];
  if(num===1) ids=shuffle(ids); else ids.sort((a,b)=>(points[b]||0)-(points[a]||0)||playerById(a).name.localeCompare(playerById(b).name,'it'));
  let bye=null; if(ids.length%2){bye=chooseSwissBye(t,ids,points);ids=ids.filter(x=>x!==bye);}
  const pairs=bestSwissPairs(t,ids,points); const matches=pairs.map(([a,b])=>({id:uid('m'),p1:a,p2:b,s1:null,s2:null,bye:false}));
  if(bye)matches.push({id:uid('m'),p1:bye,p2:null,s1:2,s2:0,bye:true});
  return {number:num,matches};
}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function previousOpponents(t,id){const s=new Set();for(const r of t.rounds)for(const m of r.matches)if(!m.bye){if(m.p1===id)s.add(m.p2);if(m.p2===id)s.add(m.p1);}return s;}
function hadBye(t,id){return t.rounds.some(r=>r.matches.some(m=>m.bye&&m.p1===id));}
function chooseSwissBye(t,ids,points){const min=Math.min(...ids.map(id=>points[id]||0));const low=ids.filter(id=>(points[id]||0)===min);const fresh=low.filter(id=>!hadBye(t,id));return shuffle(fresh.length?fresh:low)[0];}
function bestSwissPairs(t,ids,points){
  const opp=Object.fromEntries(ids.map(id=>[id,previousOpponents(t,id)])); let best=null,bestPenalty=Infinity;
  function rec(rest,pairs,penalty){if(penalty>=bestPenalty)return;if(!rest.length){best=pairs;bestPenalty=penalty;return;}const a=rest[0];for(let i=1;i<rest.length;i++){const b=rest[i];const p=(opp[a].has(b)?1000:0)+Math.abs((points[a]||0)-(points[b]||0))*10;rec(rest.slice(1,i).concat(rest.slice(i+1)),pairs.concat([[a,b]]),penalty+p);}}
  rec(ids,[],0);return best||[];
}

function computeStandings(t){
  const stats={};
  t.participantIds.forEach(id=>stats[id]={id,name:playerById(id)?.name||'?',points:0,wins:0,losses:0,draws:0,matches:0,gameWins:0,gameLosses:0,opponents:[]});
  for(const r of t.rounds){for(const m of r.matches){if(!m.bye && (!Number.isInteger(m.s1)||!Number.isInteger(m.s2)))continue; if(m.bye){const a=stats[m.p1];a.points+=3;a.wins++;a.matches++;a.gameWins+=2;continue;} const a=stats[m.p1],b=stats[m.p2];a.matches++;b.matches++;a.gameWins+=m.s1;a.gameLosses+=m.s2;b.gameWins+=m.s2;b.gameLosses+=m.s1;a.opponents.push(b.id);b.opponents.push(a.id);if(m.s1>m.s2){a.points+=3;a.wins++;b.losses++;}else if(m.s2>m.s1){b.points+=3;b.wins++;a.losses++;}else{a.points++;b.points++;a.draws++;b.draws++;}}}
  const mwp=id=>{const s=stats[id];return s.matches?Math.max(s.points/(s.matches*3),1/3):0;};
  const gwp=id=>{const s=stats[id],g=s.gameWins+s.gameLosses;return g?Math.max(s.gameWins/g,1/3):0;};
  const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
  const rows=Object.values(stats).map(s=>({...s,mwp:mwp(s.id),gwp:gwp(s.id),omw:avg(s.opponents.map(mwp)),ogw:avg(s.opponents.map(gwp))}));
  rows.sort((a,b)=>b.points-a.points||b.omw-a.omw||b.gwp-a.gwp||b.ogw-a.ogw||a.name.localeCompare(b.name,'it'));return rows;
}

function download(name,text,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadBackup(){download(`mtg-manager-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2));}
function importBackup(e){const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data.players||!data.tournaments)throw new Error();if(confirm('Sostituire tutti i dati con questo backup?')){state=data;saveState();modal=null;view='home';selectedTournamentId=null;render();}}catch{alert('Backup non valido.');}};reader.readAsText(f);}
function exportStandings(){const t=activeTournament(),rows=computeStandings(t);const head=['Posizione','Giocatore','Punti','Vittorie','Sconfitte','Pareggi','OMW%','GWP%','OGW%'];const csv=[head,...rows.map((r,i)=>[i+1,r.name,r.points,r.wins,r.losses,r.draws,(r.omw*100).toFixed(2),(r.gwp*100).toFixed(2),(r.ogw*100).toFixed(2)])].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');download(`${t.name.replace(/[^\w\-]+/g,'_')}-classifica.csv`,csv,'text/csv;charset=utf-8');}

init();
