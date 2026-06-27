
//     import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
//     import { getFirestore, collection, onSnapshot, query, orderBy, getDocs, getDocsFromServer } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
    const firebaseConfig={apiKey:"AIzaSyCdMfitam8d7UwVfP2I3jbuDIYvW-lAB-c",authDomain:"youth-tasks.firebaseapp.com",projectId:"youth-tasks",storageBucket:"youth-tasks.firebasestorage.app",messagingSenderId:"824413713361",appId:"1:824413713361:web:6c84c4ce1efab73b3c66f0",measurementId:"G-PKMFQ4Z1PZ"};
    const app=initializeApp(firebaseConfig);const db=getFirestore(app);const $=id=>document.getElementById(id);const clean=v=>String(v??"").replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]));
    const FINAL_TEAMS=[{slot:1,name:"Dishan",captain:"Dishan",division:"Division 1",referee:"Shapthi",color:"#9be15d",players:["Lakeesha","Deanna","Andy","Shaven","Navindu","Joshua"]},{slot:2,name:"Mishael",captain:"Mishael",division:"Division 1",referee:"Shapthi",color:"#45d6ff",players:["Nishmi","Ashcharya","Anuk W","Dilhan C","Lukesh","Dwane"]},{slot:3,name:"Bhagya",captain:"Bhagya",division:"Division 1",referee:"Shapthi",color:"#b893ff",players:["Abigail","Leon","Yohan","Sithanga","Anuk Het","Dilhan"]},{slot:4,name:"Ciara",captain:"Ciara",division:"Division 2",referee:"Yohan",color:"#ff7bd8",players:["Tayara","Shem","Mario Silva","Yashen","Dulain","Shapthi"]},{slot:5,name:"Samuel",captain:"Samuel",division:"Division 2",referee:"Yohan",color:"#f7bd57",players:["Bianca","Onesh","Nuran","Andrew","Sahas"]},{slot:6,name:"Oshara",captain:"Oshara",division:"Division 2",referee:"Yohan",color:"#f5f0e6",players:["Dyleena","Shannal","Dan","Migara","Vinuja","Vishal"]}];
    let selectedEventId=new URLSearchParams(location.search).get("event")||"fomo-v2",events=[],teamsRaw=[],matchesRaw=[],settingsRaw=[],activeDivision="All",firebaseOk=false;
    function fmtTime(v){if(!v)return"TBC";const [h,m]=String(v).split(':').map(Number);if(Number.isNaN(h)||Number.isNaN(m))return v;return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
    function mins(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):99999}
    function stateClass(s){s=String(s||'').toLowerCase();return s==='live'?'live':s==='completed'?'completed':'upcoming'}
    function scoreValue(m,side){const keys=side==='A'?['scoreA','teamAScore','aScore','pointsA','teamAPoints']:['scoreB','teamBScore','bScore','pointsB','teamBPoints'];for(const k of keys){if(m&&m[k]!==undefined&&m[k]!==null&&m[k]!=='')return Number(m[k])||0;}return 0;}
    function docsForEvent(id){return {teams:teamsRaw.filter(t=>(t.tournamentId||"fomo-v2")===id),matches:matchesRaw.filter(m=>(m.tournamentId||"fomo-v2")===id),settings:settingsRaw.find(s=>s.id===id)}}
    function eventHasLiveData(id){const d=docsForEvent(id);return !!(d.settings || d.teams.length || d.matches.length)}
    function bestLiveEventId(){
      const ids=[...teamsRaw,...matchesRaw].map(x=>x.tournamentId||"fomo-v2").filter(Boolean);
      settingsRaw.forEach(s=>ids.push(s.id));
      events.forEach(e=>{if(/fomo|frisbee|ultimate|tournament/i.test(String(e.title||'')))ids.push(e.id)});
      if(!ids.length)return selectedEventId||"fomo-v2";
      const score={};
      ids.forEach(id=>{score[id]=(score[id]||0)+1});
      teamsRaw.forEach(t=>{const id=t.tournamentId||"fomo-v2";score[id]=(score[id]||0)+3});
      matchesRaw.forEach(m=>{const id=m.tournamentId||"fomo-v2";score[id]=(score[id]||0)+5});
      settingsRaw.forEach(s=>{score[s.id]=(score[s.id]||0)+8;if(/fomo|ultimate/i.test(`${s.title||''} ${s.subtitle||''}`))score[s.id]+=10});
      return Object.entries(score).sort((a,b)=>b[1]-a[1])[0][0];
    }
    function findDefaultEvent(){
      const requested=new URLSearchParams(location.search).get("event");
      if(requested && eventHasLiveData(requested)){selectedEventId=requested;return;}
      if(requested && !eventHasLiveData(requested) && (teamsRaw.length||matchesRaw.length||settingsRaw.length)){selectedEventId=bestLiveEventId();return;}
      if(!requested){selectedEventId=bestLiveEventId();}
    }
    function rawTeamsForId(){return teamsRaw.filter(t=>(t.tournamentId||"fomo-v2")===selectedEventId)}
    function teams(){
      const docs=rawTeamsForId();
      if(docs.length){
        return [...docs].sort((a,b)=>Number(a.slot||99)-Number(b.slot||99)||String(a.name||'').localeCompare(String(b.name||''))).map((t,i)=>({
          ...t,
          name:t.name||`Team ${i+1}`,
          captain:t.captain||t.name||`Team ${i+1}`,
          division:t.division||"Open",
          referee:t.referee||"TBC",
          color:t.color||FINAL_TEAMS[i]?.color||"#bfff45",
          players:Array.isArray(t.players)?t.players:[]
        }));
      }
      return FINAL_TEAMS.map(t=>({...t,id:`final-${t.slot}`,tournamentId:selectedEventId}));
    }
    function matches(){return matchesRaw.filter(m=>(m.tournamentId||"fomo-v2")===selectedEventId).sort((a,b)=>mins(a.time)-mins(b.time)||String(a.label||'').localeCompare(String(b.label||'')))}
    function settings(){return settingsRaw.find(s=>s.id===selectedEventId)||{venue:"Infinity Sports Arena",startTime:"15:00",title:"FOMO 2.0"}}
    function teamById(id){return teams().find(t=>t.id===id)||teamsRaw.find(t=>t.id===id)||FINAL_TEAMS.find(t=>t.id===id)||{}}
    function teamName(m,side){const t=teamById(side==='A'?m.teamAId:m.teamBId);return t.name||m[`team${side}Name`]||`Team ${side}`}
    function mDiv(m){const a=teamById(m.teamAId),b=teamById(m.teamBId);return m.division||(a.division&&a.division===b.division?a.division:[a.division,b.division].filter(Boolean).join(' / '))||'Open'}
    function mRef(m){const a=teamById(m.teamAId),b=teamById(m.teamBId);return m.referee||(a.referee&&a.referee===b.referee?a.referee:[a.referee,b.referee].filter(Boolean).join(' / '))||'TBC'}
    function rows(){const map=new Map(teams().map(t=>[t.id,{...t,played:0,won:0,lost:0,draw:0,pts:0,diff:0,scored:0,against:0}]));matches().filter(m=>{const s=String(m.status||'').toLowerCase();return s==='completed'||s==='live'||scoreValue(m,'A')>0||scoreValue(m,'B')>0}).forEach(m=>{const a=map.get(m.teamAId),b=map.get(m.teamBId);if(!a||!b)return;const sa=scoreValue(m,'A'),sb=scoreValue(m,'B');a.played++;b.played++;a.scored+=sa;a.against+=sb;b.scored+=sb;b.against+=sa;a.diff=a.scored-a.against;b.diff=b.scored-b.against;if(sa>sb){a.won++;a.pts+=3;b.lost++}else if(sb>sa){b.won++;b.pts+=3;a.lost++}else{a.draw++;b.draw++;a.pts++;b.pts++}});return [...map.values()].sort((a,b)=>b.pts-a.pts||b.diff-a.diff||b.won-a.won||a.name.localeCompare(b.name))}
    function renderNav(){document.querySelectorAll('#nav button').forEach(btn=>btn.onclick=()=>switchPage(btn.dataset.page));$('mobileNav').onchange=e=>switchPage(e.target.value)}function switchPage(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(`page-${page}`).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('mobileNav').value=page}
    function renderFilters(){const divs=['All',...new Set(teams().map(t=>t.division))];const html=divs.map(d=>`<button class="btn ${activeDivision===d?'primary':''}" data-div="${clean(d)}">${clean(d)}</button>`).join('');$('divisionFilters').innerHTML=html;$('teamDivisionPageFilters').innerHTML=html;document.querySelectorAll('[data-div]').forEach(b=>b.onclick=()=>{activeDivision=b.dataset.div;render()})}
    function render(){findDefaultEvent();const t=teams(),m=matches(),r=rows(),s=settings();$('eventVenue').textContent=s.venue||'Infinity Sports Arena';$('eventTime').textContent=s.startTime?`${fmtTime(s.startTime)} onwards`:'3:00 PM onwards';$('teamCount').textContent=t.length;$('matchCount').textContent=m.length;$('doneCount').textContent=m.filter(x=>String(x.status||'').toLowerCase()==='completed').length;const live=m.find(x=>String(x.status||'').toLowerCase()==='live');const focus=live||m.find(x=>String(x.status||'').toLowerCase()!=='completed')||m[0];if(focus){$('liveStateText').textContent=live?'Live now':'Next match';$('mainMatchTitle').textContent=`${teamName(focus,'A')} vs ${teamName(focus,'B')}`;$('teamAName').textContent=teamName(focus,'A');$('teamBName').textContent=teamName(focus,'B');$('scoreA').textContent=scoreValue(focus,'A');$('scoreB').textContent=scoreValue(focus,'B')}else{$('mainMatchTitle').textContent='Waiting for the first pull.';$('teamAName').textContent='Team A';$('teamBName').textContent='Team B';$('scoreA').textContent='0';$('scoreB').textContent='0'}const next=m.filter(x=>x!==focus).slice(0,5);$('queueList').innerHTML=next.length?next.map(x=>`<div class="match-row"><span class="time">${fmtTime(x.time)}</span><div><h4>${clean(teamName(x,'A'))} vs ${clean(teamName(x,'B'))}</h4><p>${clean(x.label||'Match')} • ${clean(mDiv(x))} • Ref: ${clean(mRef(x))} • ${scoreValue(x,'A')}-${scoreValue(x,'B')}</p></div><span class="state ${stateClass(x.status)}">${clean(x.status||'Upcoming')}</span></div>`).join(''):'<div class="empty">No matches in the queue yet.</div>';renderFilters();const rf=r.filter(x=>activeDivision==='All'||x.division===activeDivision);$('standingsBody').innerHTML=rf.map((x,i)=>`<tr><td>${i+1}</td><td><span class="leader-name"><span class="color-dot" style="background:${x.color}"></span>${clean(x.name)}</span></td><td>${x.played}</td><td>${x.won}</td><td>${x.pts}</td><td>${x.diff}</td></tr>`).join('')||'<tr><td colspan="6">No standings yet.</td></tr>';const mf=m.filter(x=>activeDivision==='All'||mDiv(x)===activeDivision);$('scheduleList').innerHTML=mf.length?mf.map(x=>`<div class="match-row"><span class="time">${fmtTime(x.time)}</span><div><h4>${clean(teamName(x,'A'))} vs ${clean(teamName(x,'B'))}</h4><p>${clean(mDiv(x))} • Ref: ${clean(mRef(x))} • ${clean(x.court||'Court TBC')} • Score ${scoreValue(x,'A')}-${scoreValue(x,'B')}</p></div><span class="state ${stateClass(x.status)}">${clean(x.status||'Upcoming')}</span></div>`).join(''):'<div class="empty">Fixtures will appear here when added.</div>';const grouped=['Division 1','Division 2'].map(div=>{const list=t.filter(x=>x.division===div);return `<div class="division-band"><h3>${div}</h3><span>Ref: ${div==='Division 1'?'Shapthi':'Yohan'}</span></div><div class="teams-grid">${list.map(team=>`<div class="team-card" style="--teamColor:${team.color}"><h3>${clean(team.name)}</h3><p>${clean(team.division)} • Captain: ${clean(team.captain)}</p><div class="players">${team.players.map(p=>`<span>${clean(p)}</span>`).join('')}</div></div>`).join('')}</div>`}).join('');$('teamsPageList').innerHTML=grouped}
    const photos=[['assets/youth/youth_stair_big_13_web.jpg','Come for the game. Stay for the people.'],['assets/youth/youth_group_large_03_web.jpg','A youth family with room for one more.'],['assets/youth/youth_girls_group_09_web.jpg','Faith, friendship and good energy.'],['assets/youth/youth_fun_group_11_web.jpg','The kind of people who make Sundays better.'],['assets/youth/youth_stairs_01_web.jpg','Big room, good laughs, real community.'],['assets/youth/youth_girls_group_10_web.jpg','Pull up and find your people.'],['assets/youth/youth_fun_group_12_web.jpg','Joy is part of the culture.']];let pIndex=0;function setPhoto(i){if(!$('mainYouthPhoto'))return;pIndex=i%photos.length;const [src,cap]=photos[pIndex];$('mainYouthPhoto').src=src;if($('photoStage'))$('photoStage').style.setProperty('--blurImg',`url(${src})`);if($('photoText'))$('photoText').textContent=cap;document.querySelectorAll('#thumbRow button').forEach((b,k)=>b.classList.toggle('active',k===pIndex))}function initPhotos(){if(!$('mainYouthPhoto'))return;setPhoto(0);setInterval(()=>setPhoto(pIndex+1),4300)}
    function arr(snap){return snap.docs.map(d=>({id:d.id,...d.data()}))}
    async function fetchCollectionFresh(name){try{return await getDocsFromServer(collection(db,name));}catch(e){console.warn('Server fetch failed, using cache/listener for',name,e);return await getDocs(collection(db,name));}}
    async function refreshLiveSync(){
      try{
        const [eventSnap,teamSnap,matchSnap,settingsSnap]=await Promise.all([
          fetchCollectionFresh('events'),
          fetchCollectionFresh('tournamentTeams'),
          fetchCollectionFresh('tournamentMatches'),
          fetchCollectionFresh('tournamentSettings')
        ]);
        events=arr(eventSnap);teamsRaw=arr(teamSnap);matchesRaw=arr(matchSnap);settingsRaw=arr(settingsSnap);firebaseOk=true;
        if($('connectionPill'))$('connectionPill').textContent='Live updates on';
        render();
      }catch(err){
        console.error('5-second public live sync failed',err);firebaseOk=false;
        if($('connectionPill'))$('connectionPill').textContent='Trying to reconnect';
        render();
      }
    }
    function listen(name,assign,ordered=false){const ref=collection(db,name);const q=ordered?query(ref,orderBy('createdAt','desc')):ref;onSnapshot(q,snap=>{firebaseOk=true;assign(snap.docs.map(d=>({id:d.id,...d.data()})));if($('connectionPill'))$('connectionPill').textContent='Live updates on';render()},err=>{console.error(err);firebaseOk=false;if($('connectionPill'))$('connectionPill').textContent='Trying to reconnect';render()})}
    renderNav();initPhotos();setTimeout(()=>$('loader').classList.add('hide'),900);render();listen('events',d=>events=d,false);listen('tournamentTeams',d=>teamsRaw=d,false);listen('tournamentMatches',d=>matchesRaw=d,false);listen('tournamentSettings',d=>settingsRaw=d,false);refreshLiveSync();setInterval(refreshLiveSync,5000);
  