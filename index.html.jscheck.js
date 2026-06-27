
//     import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
//     import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
//     import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc, getDocs, getDocsFromServer, onSnapshot, serverTimestamp, query, orderBy, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCdMfitam8d7UwVfP2I3jbuDIYvW-lAB-c",
      authDomain: "youth-tasks.firebaseapp.com",
      projectId: "youth-tasks",
      storageBucket: "youth-tasks.firebasestorage.app",
      messagingSenderId: "824413713361",
      appId: "1:824413713361:web:6c84c4ce1efab73b3c66f0",
      measurementId: "G-PKMFQ4Z1PZ"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.info("Youth Central V12.2 loaded. Requested UX adjustments, analytics and FOMO intro enabled.");



    window.addEventListener("error", function(event){
      console.error("Youth Central error:", event.message, event.error);
      try{ notify("Something blocked loading. Open Console for details or refresh once."); }catch(e){}
    });
    window.addEventListener("unhandledrejection", function(event){
      console.error("Youth Central promise error:", event.reason);
      try{ notify("A sync/login issue happened. Check Firebase rules or refresh."); }catch(e){}
    });

    const ADMIN_CODE = "YC-ADMIN-2026";
    const ROLES = ["Admin","Core Moderator","Team Head","Team Lead","Member","Viewer"];
    let authMode = "login";
    let youthMembers=[], cellLeaders=[], cellGroups=[], attendance=[], followUps=[], tasks=[], userProfiles=[], notifications=[], events=[], tournamentTeams=[], tournamentMatches=[], tournamentSettingsList=[];
    let editingMemberId=null, editingEventId=null, listenersStarted=false, currentProfile=null, currentUser=null, taskInitialLoaded=false, selectedEventId='';
    const seenTaskIds = new Set();

    const $ = id => document.getElementById(id);
    const clean = v => String(v ?? "").replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]));
    const todayISO = () => new Date().toISOString().slice(0,10);
    const roleKey = s => String(s||"").replace(/\s|\-/g,"");


    const GOOGLE_SHEET_SYNC_URL = "https://script.google.com/macros/s/AKfycby3jUrgFnV97vU_Z_EUv1MmvNRbFjWuckByvsdOPPMpjRYOQZ7iBAyMW3fLrce29rc/exec";

    function toSheetDate(value){
      return value ? String(value) : "";
    }

    function memberToSheetRow(member){
      return {
        "id": member.id || "",
        "Name (Name & Surname)": member.name || "",
        "DOB": toSheetDate(member.dob),
        "Age": member.age || "",
        "Cell Leader": member.cellLeader || "",
        "Gender": member.gender || "",
        "Location (Town/ City)": member.location || "",
        "Divisional Secretariats": member.divisionalSecretariat || "",
        "Address": member.address || "",
        "Contact Numb": member.contactNumber || "",
        "Ministry": member.ministry || "",
        "Team": member.team || ""
      };
    }

    async function syncMemberToGoogleSheet(member, source="website"){
      if(!GOOGLE_SHEET_SYNC_URL || !member?.id) return;
      const payload = {
        ...memberToSheetRow(member),
        _source: source,
        _updatedAt: new Date().toISOString(),
        _updatedBy: currentProfile?.name || currentUser?.email || "Youth Central"
      };
      try{
        await fetch(GOOGLE_SHEET_SYNC_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
      }catch(error){
        console.warn("Google Sheet sync failed", error);
        notify("Saved in Youth Central. Sheet sync will need checking.");
      }
    }

    function initials(value){
      const text = String(value || "YC").trim();
      const parts = text.split(/\s+/).filter(Boolean);
      if(!parts.length) return "YC";
      if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }


    $("todayLine").textContent = new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    $("attendanceDate").value=todayISO();
    $("newFirstVisit").value=todayISO();

    window.switchAuth = function(mode){
      authMode = mode;
      $("loginTab").classList.toggle("active",mode==="login");
      $("signupTab").classList.toggle("active",mode==="signup");
      document.querySelectorAll(".signup-only").forEach(el=>el.classList.toggle("hidden",mode!=="signup"));
      $("authTitle").textContent = mode==="login" ? "Welcome back" : "Create access";
      $("authText").textContent = mode==="login" ? "Login to your Youth Central dashboard." : "Create an account. Admins can upgrade roles later.";
      $("authMainBtn").textContent = mode==="login" ? "Login" : "Create Account";
      $("authMainBtn").setAttribute("onclick", mode==="login" ? "login()" : "signup()");
    };

    function notify(message){
      const wrap=$("toast"), el=document.createElement("div");
      el.className="toast-msg"; el.textContent=message; wrap.appendChild(el);
      setTimeout(()=>{el.style.opacity="0";el.style.transform="translateX(20px)"},2600);
      setTimeout(()=>el.remove(),3100);
    }

    function canManage(){return ["Admin","Core Moderator"].includes(currentProfile?.role)}
    function canAdmin(){return currentProfile?.role==="Admin"}


    window.enableNotifications = async function(){
      if(!("Notification" in window)) return notify("Browser notifications are not supported here.");
      const result = await Notification.requestPermission();
      notify(result === "granted" ? "Task alerts enabled" : "Notification permission not enabled");
    };

    function browserAlert(title, body){
      if("Notification" in window && Notification.permission === "granted"){
        new Notification(title, { body });
      }
    }

    window.login = async function(){
      try{
        await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value.trim());
        notify("Logged in");
      }catch(e){
        console.error(e);
        notify(e.message || "Login failed");
      }
    };

    window.signup = async function(){
      try{
        const name = $("loginName").value.trim() || "Youth Central User";
        const email = $("loginEmail").value.trim();
        const password = $("loginPassword").value.trim();
        const code = $("adminCode").value.trim();
        if(!email || !password) return notify("Email and password are required.");

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        let role = "Member";

        if(code === ADMIN_CODE){
          const adminSnap = await getDocs(query(collection(db,"userProfiles"), where("role","==","Admin")));
          role = adminSnap.size < 3 ? "Admin" : "Member";
          if(role === "Member") notify("Admin limit reached. Account created as Member.");
        }

        await setDoc(doc(db,"userProfiles",cred.user.uid),{
          uid:cred.user.uid,
          name,
          email,
          role,
          team:"",
          status:"Active",
          photoData:"",
          photoURL:"",
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp()
        });

        notify("Account created");
      }catch(e){
        console.error(e);
        notify(e.message || "Could not create account");
      }
    };

    window.logout = async function(){
      try{ await signOut(auth); }
      catch(e){ console.error(e); notify(e.message || "Logout failed"); }
    };

    async function ensureProfile(user){
      const ref = doc(db,"userProfiles",user.uid);
      const snap = await getDoc(ref);
      if(snap.exists()) return { id:user.uid, ...snap.data() };

      const profile = {
        uid:user.uid,
        name:user.email?.split("@")[0] || "Youth Central User",
        email:user.email || "",
        role:"Member",
        team:"",
        status:"Active",
        photoData:"",
        photoURL:"",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      };
      await setDoc(ref, profile);
      return { id:user.uid, ...profile };
    }

    onAuthStateChanged(auth, async user=>{
      currentUser = user;

      if(!user){
        currentProfile = null;
        if($("loginScreen")){
          $("loginScreen").classList.remove("hidden");
          $("loginScreen").style.display = "grid";
        }
        if($("appScreen")){
          $("appScreen").classList.add("hidden");
          $("appScreen").style.display = "none";
        }
        if($("currentUserLabel")) $("currentUserLabel").textContent = "Not logged in";
        return;
      }

      // Show the app immediately after Firebase Auth confirms login.
      // Firestore profile loading happens after this, so the app won't get stuck on "Logged in".
      if($("loginScreen")) $("loginScreen").classList.add("hidden");
      if($("appScreen")) $("appScreen").classList.remove("hidden");

      currentProfile = {
        id:user.uid,
        uid:user.uid,
        name:user.email?.split("@")[0] || "Youth Central User",
        email:user.email || "",
        role:"Member",
        team:"",
        status:"Active"
      };

      if($("currentUserLabel")) $("currentUserLabel").textContent = `${currentProfile.name || user.email} • Loading`;
      updateProfileUI();
      render();

      try{
        currentProfile = await ensureProfile(user);
        if($("currentUserLabel")) $("currentUserLabel").textContent = `${currentProfile.name || user.email} • ${currentProfile.role}`;
        updateProfileUI();
      }catch(e){
        console.error("Profile load/create issue", e);
        notify("Logged in, but profile access has an issue. Check Firestore rules.");
      }

      startListeners();
      render();
      studioLoader("Opening leadership room");
      handleInitialRoute();
    });

    window.toggleSide = function(){
      const side = $("side");
      if(side) side.classList.toggle("open");
    };

    window.openPage = function(pageId, btn){
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      document.querySelectorAll(".nav-btn, .top-nav-btn, .bottom-nav button").forEach(b=>b.classList.remove("active"));

      const page = $(pageId);
      if(page) page.classList.add("active");

      const hero = $("homeHero");
      if(hero) hero.classList.toggle("hidden", pageId !== "home");

      document.querySelectorAll(`[data-page="${pageId}"]`).forEach(b=>b.classList.add("active"));
      if(btn) btn.classList.add("active");
      const side = $("side");
      if(side) side.classList.remove("open");
      window.scrollTo({top:0, behavior:"smooth"});
    };

    window.openPageMobile = function(pageId, btn){
      openPage(pageId, btn || null);
    };

    window.openPageByName = function(pageId){
      const btn = document.querySelector(`.top-nav-btn[data-page="${pageId}"]`) || document.querySelector(`.nav-btn[data-page="${pageId}"]`) || document.querySelector(`.bottom-nav button[data-page="${pageId}"]`);
      openPage(pageId, btn || null);
    };

    window.openAdminSettings = function(){
      if(!canAdmin()) return notify("Only Admins can open settings.");
      openPage("access", null);
    };

    function updateAdminToolsVisibility(){
      const btn = $("adminSettingsBtn");
      if(btn) btn.classList.toggle("hidden", !canAdmin());
    }

    window.openEventModal = function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can create events.");
      editingEventId = null;
      clearEventForm();
      if($("eventModalTitle")) $("eventModalTitle").textContent = "Add Event";
      if($("eventModal")) $("eventModal").classList.add("active");
    };

    window.closeEventModal = function(){
      if($("eventModal")) $("eventModal").classList.remove("active");
    };

    window.syncAttendanceEvent = function(){
      const id = $("attendanceEventSelect")?.value || "";
      const eventObj = events.find(e=>e.id===id);
      if(eventObj){
        if($("attendanceDate")) $("attendanceDate").value = eventObj.date || todayISO();
        if($("attendanceEvent")) $("attendanceEvent").value = eventObj.title || "";
      }else{
        if($("attendanceEvent")) $("attendanceEvent").value = "";
      }
      renderAttendance();
    };

    window.selectAndOpenGamePlan = function(id){
      selectedEventId = id;
      if($("eventReportSelect")) $("eventReportSelect").value = id;
      openGamePlanFullscreen();
    };

    window.exportEventReport = function(id){
      if($("eventReportSelect")) $("eventReportSelect").value = id;
      selectedEventId = id;
      exportSelectedEventReport();
    };

    let gameIntroActive = false;
    window.playGameIntro = function(force=false){
      const overlay = $("gameIntroOverlay"), video = $("fomoIntroVideo"), startBtn = $("introStartBtn");
      if(!overlay || !video) return;
      gameIntroActive = true;
      document.documentElement.classList.add("intro-playing");
      document.body.classList.add("intro-playing");
      overlay.classList.remove("hidden");
      if(startBtn) startBtn.classList.add("hidden");
      try{ video.currentTime = 0; }catch(e){}
      video.muted = false;
      const p = video.play();
      if(p && typeof p.catch === "function"){
        p.catch(()=>{
          if(startBtn) startBtn.classList.remove("hidden");
          notify("Tap Play Intro to start the video.");
        });
      }
      video.onended = () => finishGameIntro();
    };

    window.startGameIntroVideo = function(){
      const video = $("fomoIntroVideo"), startBtn = $("introStartBtn");
      if(startBtn) startBtn.classList.add("hidden");
      if(video) video.play().catch(()=>notify("Video could not start. Use Skip Intro."));
    };

    window.finishGameIntro = function(){
      const overlay = $("gameIntroOverlay"), video = $("fomoIntroVideo");
      if(video){ try{ video.pause(); }catch(e){} }
      if(overlay) overlay.classList.add("hidden");
      document.documentElement.classList.remove("intro-playing");
      document.body.classList.remove("intro-playing");
      gameIntroActive = false;
    };


    function clearMemberForm(){
      ["mSerial","mName","mDob","mAge","mPhone","mLocation","mDS","mAddress","mCellLeader","mCellGroup","mMinistry","mTeam","mFirstVisit","mLastAttended","mNotes"].forEach(id=>{ if($(id)) $(id).value=""; });
      if($("mGender")) $("mGender").value="";
      if($("mType")) $("mType").value="Regular";
      if($("mStatus")) $("mStatus").value="Active";
      if($("mFollowStatus")) $("mFollowStatus").value="Not Needed";
    }

    window.openMemberModal = function(type="Regular"){
      editingMemberId = null;
      clearMemberForm();
      if($("memberModalTitle")) $("memberModalTitle").textContent = type === "Newcomer" ? "Add Newcomer" : "Add Person";
      if($("mType")) $("mType").value = type;
      if($("mFirstVisit")) $("mFirstVisit").value = todayISO();
      if($("memberModal")) $("memberModal").classList.add("active");
    };

    window.closeMemberModal = function(){
      if($("memberModal")) $("memberModal").classList.remove("active");
    };

    window.editMember = function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can edit people.");
      const m = youthMembers.find(x=>x.id===id);
      if(!m) return notify("Person not found.");
      editingMemberId = id;
      if($("memberModalTitle")) $("memberModalTitle").textContent = "Edit Person";
      if($("mSerial")) $("mSerial").value=m.serialNo||"";
      if($("mName")) $("mName").value=m.name||"";
      if($("mDob")) $("mDob").value=m.dob||"";
      if($("mAge")) $("mAge").value=m.age||"";
      if($("mGender")) $("mGender").value=m.gender||"";
      if($("mPhone")) $("mPhone").value=m.contactNumber||"";
      if($("mLocation")) $("mLocation").value=m.location||"";
      if($("mDS")) $("mDS").value=m.divisionalSecretariat||"";
      if($("mAddress")) $("mAddress").value=m.address||"";
      if($("mCellLeader")) $("mCellLeader").value=m.cellLeader||"";
      if($("mCellGroup")) $("mCellGroup").value=m.cellGroup||"";
      if($("mMinistry")) $("mMinistry").value=m.ministry||"";
      if($("mTeam")) $("mTeam").value=m.team||"";
      if($("mType")) $("mType").value=m.memberType||"Regular";
      if($("mStatus")) $("mStatus").value=m.status||"Active";
      if($("mFirstVisit")) $("mFirstVisit").value=m.firstVisitDate||"";
      if($("mLastAttended")) $("mLastAttended").value=m.lastAttendedDate||"";
      if($("mFollowStatus")) $("mFollowStatus").value=m.followUpStatus||"Not Needed";
      if($("mNotes")) $("mNotes").value=m.notes||"";
      if($("memberModal")) $("memberModal").classList.add("active");
    };

    window.saveMember = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can save people.");
      const data={
        serialNo:$("mSerial").value.trim(),
        name:$("mName").value.trim(),
        dob:$("mDob").value,
        age:$("mAge").value.trim(),
        gender:$("mGender").value,
        contactNumber:$("mPhone").value.trim(),
        location:$("mLocation").value.trim(),
        divisionalSecretariat:$("mDS").value.trim(),
        address:$("mAddress").value.trim(),
        cellLeader:$("mCellLeader").value.trim(),
        cellGroup:$("mCellGroup").value.trim(),
        ministry:$("mMinistry").value.trim(),
        team:$("mTeam").value.trim(),
        memberType:$("mType").value,
        status:$("mStatus").value,
        firstVisitDate:$("mFirstVisit").value,
        lastAttendedDate:$("mLastAttended").value,
        followUpStatus:$("mFollowStatus").value,
        notes:$("mNotes").value.trim(),
        updatedAt:serverTimestamp()
      };
      if(!data.name) return notify("Name is required");
      if(editingMemberId){
        await updateDoc(doc(db,"youthMembers",editingMemberId), data);
        await syncMemberToGoogleSheet({ id: editingMemberId, ...data }, "member-update");
        notify("Person updated");
      }else{
        data.createdAt = serverTimestamp();
        const ref = await addDoc(collection(db,"youthMembers"), data);
        await syncMemberToGoogleSheet({ id: ref.id, ...data }, "member-add");
        notify("Person added");
      }
      closeMemberModal();
    };

    window.deleteMember = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete people.");
      if(confirm("Delete this person?")){
        await deleteDoc(doc(db,"youthMembers",id));
        notify("Deleted");
      }
    };

    window.addNewcomer = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can add newcomers.");
      const name = $("newName").value.trim();
      const contactNumber = $("newPhone").value.trim();
      if(!name) return notify("Name required");
      const data={
        name,
        contactNumber,
        gender:$("newGender").value,
        location:$("newLocation").value.trim(),
        invitedBy:$("newInvitedBy").value.trim(),
        firstVisitDate:$("newFirstVisit").value||todayISO(),
        cellLeader:$("newCellLeader").value.trim(),
        team:$("newTeam").value.trim(),
        ministry:$("newTeam").value.trim(),
        notes:$("newNotes").value.trim(),
        memberType:"Newcomer",
        status:"Active",
        followUpStatus:"Pending",
        lastAttendedDate:$("newFirstVisit").value||todayISO(),
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      };
      const ref = await addDoc(collection(db,"youthMembers"), data);
      await syncMemberToGoogleSheet({ id: ref.id, ...data }, "newcomer-add");
      await addDoc(collection(db,"followUps"),{
        memberId:ref.id,
        memberName:name,
        contactNumber,
        reason:"Newcomer follow-up",
        assignedTo:data.cellLeader||"Unassigned",
        status:"Pending",
        dueDate:"",
        notes:data.notes,
        createdAt:serverTimestamp()
      });
      ["newName","newPhone","newLocation","newInvitedBy","newCellLeader","newTeam","newNotes"].forEach(id=>{ if($(id)) $(id).value=""; });
      notify("Newcomer saved + follow-up created");
    };

    window.saveTournamentRules = async function(){
      // Legacy hidden section support. Rules are no longer shown in the Game Plan UI.
      if(!canManage()) return notify("Only Admin or Core Moderator can edit rules.");
      const id = typeof activeTournamentId === "function" ? activeTournamentId() : (selectedEventId || "fomo-v2");
      const rulesText = $("tournamentRulesText") ? $("tournamentRulesText").value : "";
      await setDoc(doc(db,"tournamentSettings",id), { rules:rulesText, updatedAt:serverTimestamp() }, { merge:true });
      notify("Rules saved");
    };


    let pendingProfilePhotoData = "";
    let pendingEventFlyerData = "";

    function safeImageUrl(value){
      const url = String(value || "").trim();
      if(!url) return "";
      if(url.startsWith("data:image/")) return url;
      if(url.startsWith("https://")) return url;
      return "";
    }

    function profileImage(profile){
      return safeImageUrl(profile?.photoData) || safeImageUrl(profile?.photoURL);
    }

    function avatarHTML(profile, fallbackName){
      const img = profileImage(profile);
      if(img) return `<img src="${img}" alt="Profile photo">`;
      return initials(fallbackName || profile?.name || "YC");
    }

    function updateProfileUI(){
      if(!currentProfile) return;

      const top = $("topAvatar");
      if(top) top.innerHTML = avatarHTML(currentProfile, currentProfile.name);

      const photo = $("profilePhoto");
      if(photo) photo.innerHTML = avatarHTML(currentProfile, currentProfile.name);

      if($("profileNameInput")) $("profileNameInput").value = currentProfile.name || "";
      if($("profileTeamInput")) $("profileTeamInput").value = currentProfile.team || "";
      if($("profilePhotoUrlInput")) $("profilePhotoUrlInput").value = currentProfile.photoURL || "";
      if($("profileRoleText")) $("profileRoleText").textContent = currentProfile.role || "Member";
      if($("profileEmailText")) $("profileEmailText").textContent = currentProfile.email || currentUser?.email || "-";
      updateAdminToolsVisibility();
    }

    window.previewProfileUpload = function(event){
      const file = event.target.files?.[0];
      if(!file) return;
      if(!file.type.startsWith("image/")) return notify("Please upload an image file.");

      const reader = new FileReader();
      reader.onload = function(e){
        const img = new Image();
        img.onload = function(){
          const max = 420;
          const scale = Math.min(max / img.width, max / img.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          pendingProfilePhotoData = canvas.toDataURL("image/jpeg", 0.78);
          if($("profilePhoto")) $("profilePhoto").innerHTML = `<img src="${pendingProfilePhotoData}" alt="Profile photo preview">`;
          notify("DP preview ready. Click Save Profile.");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    window.saveMyProfile = async function(){
      if(!currentUser) return notify("Login first.");

      const data = {
        name: $("profileNameInput").value.trim() || currentProfile?.name || currentUser.email,
        team: $("profileTeamInput").value.trim(),
        photoURL: $("profilePhotoUrlInput").value.trim(),
        updatedAt: serverTimestamp()
      };

      if(pendingProfilePhotoData){
        data.photoData = pendingProfilePhotoData;
      }

      await updateDoc(doc(db,"userProfiles",currentUser.uid), data);
      pendingProfilePhotoData = "";
      notify("Profile updated");
    };

    window.removeMyDP = async function(){
      if(!currentUser) return notify("Login first.");
      await updateDoc(doc(db,"userProfiles",currentUser.uid), {
        photoData: "",
        photoURL: "",
        updatedAt: serverTimestamp()
      });
      pendingProfilePhotoData = "";
      notify("DP removed");
    };

    window.previewEventFlyer = function(event){
      const file = event.target.files?.[0];
      if(!file) return;
      if(!file.type.startsWith("image/")) return notify("Please upload an image file.");

      const reader = new FileReader();
      reader.onload = function(e){
        const img = new Image();
        img.onload = function(){
          const max = 1000;
          const scale = Math.min(max / img.width, max / img.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          pendingEventFlyerData = canvas.toDataURL("image/jpeg", 0.78);
          $("eventFlyerPreview").classList.remove("hidden");
          $("eventFlyerPreview").innerHTML = `<img src="${pendingEventFlyerData}" alt="Event flyer preview">`;
          notify("Event flyer preview ready.");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    window.clearEventForm = function(){
      ["eventTitle","eventDate","eventTime","eventLocation","eventOwner","eventExpected","eventFlyerUrl","eventRegistrationLink","eventSheetLink","eventDescription"].forEach(id=>{ if($(id)) $(id).value=""; });
      if($("eventType")) $("eventType").value = "Special Youth Event";
      $("eventFlyerFile").value = "";
      pendingEventFlyerData = "";
      editingEventId = null;
      if($("eventSaveBtn")) $("eventSaveBtn").textContent = "Create Event";
      if($("eventModalTitle")) $("eventModalTitle").textContent = "Add Event";
      $("eventFlyerPreview").classList.add("hidden");
      $("eventFlyerPreview").innerHTML = "Flyer preview";
    };

    window.editEvent = function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can edit events.");
      const e = events.find(x=>x.id===id);
      if(!e) return notify("Event not found.");
      editingEventId = id;
      $("eventType").value = getEventType(e);
      $("eventTitle").value = e.title || "";
      $("eventDate").value = e.date || "";
      $("eventTime").value = e.time || "";
      $("eventLocation").value = e.location || "";
      $("eventOwner").value = e.owner || "";
      $("eventExpected").value = e.expectedCount || "";
      $("eventFlyerUrl").value = e.flyerURL || "";
      $("eventRegistrationLink").value = e.registrationLink || "";
      $("eventSheetLink").value = e.sheetLink || "";
      $("eventDescription").value = e.description || "";
      pendingEventFlyerData = e.flyerData || "";
      $("eventFlyerPreview").classList.toggle("hidden", !(safeImageUrl(e.flyerData) || safeImageUrl(e.flyerURL)));
      $("eventFlyerPreview").innerHTML = eventFlyerHTML(e);
      $("eventSaveBtn").textContent = "Update Event";
      if($("eventModalTitle")) $("eventModalTitle").textContent = "Edit Event";
      if($("eventModal")) $("eventModal").classList.add("active");
      openPageByName("events");
      notify("Event loaded for editing");
    };

        window.addEvent = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can create events.");
      const title = $("eventTitle").value.trim();
      const date = $("eventDate").value;
      if(!title || !date) return notify("Event title and date are required.");

      const data = {
        eventType: $("eventType").value || "Special Youth Event",
        title,
        date,
        time: $("eventTime").value,
        location: $("eventLocation").value.trim(),
        owner: $("eventOwner").value.trim(),
        expectedCount: Number($("eventExpected").value || 0),
        description: $("eventDescription").value.trim(),
        flyerURL: $("eventFlyerUrl").value.trim(),
        registrationLink: $("eventRegistrationLink").value.trim(),
        sheetLink: $("eventSheetLink").value.trim(),
        status: "Upcoming",
        updatedAt: serverTimestamp()
      };

      if(pendingEventFlyerData) data.flyerData = pendingEventFlyerData;

      if(editingEventId){
        await updateDoc(doc(db,"events",editingEventId), data);
        notify("Event updated");
      }else{
        data.createdBy = currentProfile?.name || currentUser?.email || "Team";
        data.createdAt = serverTimestamp();
        await addDoc(collection(db,"events"), data);
        notify("Event created");
      }

      clearEventForm();
      closeEventModal();
    };

        window.deleteEvent = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete events.");
      if(confirm("Delete this event? Attendance records will remain, but this event card will be removed.")){
        await deleteDoc(doc(db,"events",id));
        notify("Event deleted");
      }
    };

    window.addAttendance=async function(){
      const memberId=$("attendanceMember").value;
      const selectedEventId=$("attendanceEventSelect").value;
      const selectedEvent=events.find(e=>e.id===selectedEventId);
      const date=$("attendanceDate").value || selectedEvent?.date || todayISO();
      const eventName=selectedEvent ? selectedEvent.title : ($("attendanceEvent").value.trim()||"Church");
      const status=$("attendanceStatus").value;
      const m=youthMembers.find(x=>x.id===memberId);
      if(!m||!date) return notify("Select person and date");

      await addDoc(collection(db,"attendance"),{
        memberId,
        memberName:m.name,
        contactNumber:m.contactNumber||"",
        date,
        eventId:selectedEventId||"",
        eventName,
        status,
        cellLeader:m.cellLeader||"",
        team:m.team||"",
        createdAt:serverTimestamp()
      });

      if(["Present","Late","Newcomer"].includes(status)){
        await updateDoc(doc(db,"youthMembers",memberId),{lastAttendedDate:date,updatedAt:serverTimestamp()});
      }

      notify("Attendance marked");
    };
    window.deleteAttendance=async id=>{if(!canManage()) return notify("Only leaders can delete attendance."); if(confirm("Delete attendance record?")){await deleteDoc(doc(db,"attendance",id));notify("Attendance deleted")}};

    window.addCellLeader=async()=>{if(!canManage()) return notify("Only leaders can add cell leaders."); const name=$("leaderName").value.trim();if(!name)return notify("Leader name required");await addDoc(collection(db,"cellLeaders"),{name,contactNumber:"",role:"Cell Leader",status:"Active",createdAt:serverTimestamp()});$("leaderName").value="";notify("Leader added")};
    window.addCellGroup=async()=>{if(!canManage()) return notify("Only leaders can add cell groups."); const cellGroupName=$("cellName").value.trim();if(!cellGroupName)return notify("Cell name required");await addDoc(collection(db,"cellGroups"),{cellGroupName,leader:"",assistantLeader:"",area:"",members:[],status:"Active",createdAt:serverTimestamp()});$("cellName").value="";notify("Cell added")};

    window.deleteCellLeader = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete cell leaders.");
      if(confirm("Delete this cell leader?")){
        await deleteDoc(doc(db,"cellLeaders",id));
        notify("Cell leader deleted");
      }
    };

    window.deleteCellGroup = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete cell groups.");
      if(confirm("Delete this cell group?")){
        await deleteDoc(doc(db,"cellGroups",id));
        notify("Cell group deleted");
      }
    };

    window.renameTeam = async function(encodedTeam){
      if(!canAdmin()) return notify("Only Admin can rename teams.");
      const oldTeam = decodeURIComponent(encodedTeam);
      if(oldTeam === "No Team") return notify("No Team cannot be renamed.");
      const newTeam = prompt(`Rename team "${oldTeam}" to:`);
      if(!newTeam || !newTeam.trim()) return;
      const cleanTeam = newTeam.trim();

      const batch = writeBatch(db);
      let count = 0;

      youthMembers.forEach(m=>{
        const updates = {};
        if((m.team || "") === oldTeam) updates.team = cleanTeam;
        if((m.ministry || "") === oldTeam) updates.ministry = cleanTeam;
        if(Object.keys(updates).length){
          updates.updatedAt = serverTimestamp();
          batch.update(doc(db,"youthMembers",m.id), updates);
          count++;
        }
      });

      userProfiles.forEach(u=>{
        if((u.team || "") === oldTeam){
          batch.update(doc(db,"userProfiles",u.uid || u.id), { team: cleanTeam, updatedAt:serverTimestamp() });
          count++;
        }
      });

      await batch.commit();
      notify(`Renamed team for ${count} records`);
    };

    window.deleteTeam = async function(encodedTeam){
      if(!canAdmin()) return notify("Only Admin can delete teams.");
      const team = decodeURIComponent(encodedTeam);
      if(team === "No Team") return notify("No Team cannot be deleted.");
      if(!confirm(`Delete team "${team}"? This will not delete people. It will only clear this team/ministry label from people and user access profiles.`)) return;

      const batch = writeBatch(db);
      let count = 0;

      youthMembers.forEach(m=>{
        const updates = {};
        if((m.team || "") === team) updates.team = "";
        if((m.ministry || "") === team) updates.ministry = "";
        if(Object.keys(updates).length){
          updates.updatedAt = serverTimestamp();
          batch.update(doc(db,"youthMembers",m.id), updates);
          count++;
        }
      });

      userProfiles.forEach(u=>{
        if((u.team || "") === team){
          batch.update(doc(db,"userProfiles",u.uid || u.id), { team:"", updatedAt:serverTimestamp() });
          count++;
        }
      });

      await batch.commit();
      notify(`Deleted team label from ${count} records`);
    };


    window.addTask=async function(){
      const title=$("taskTitle").value.trim();
      if(!title) return notify("Task required");
      const task={title,owner:$("taskOwner").value,team:$("taskTeam").value.trim(),due:$("taskDue").value,priority:$("taskPriority").value,notes:$("taskNotes").value.trim(),status:"todo",createdBy:currentUser?.uid||"",createdByName:currentProfile?.name||currentUser?.email||"Unknown",createdAt:serverTimestamp()};
      const ref=await addDoc(collection(db,"tasks"),task);
      await addDoc(collection(db,"notifications"),{type:"task",title:"New task added",body:title,taskId:ref.id,team:task.team||"All",createdBy:task.createdByName,createdAt:serverTimestamp(),readBy:[]});
      ["taskTitle","taskTeam","taskDue","taskNotes"].forEach(id=>$(id).value="");
      notify("Task added + team notified");
    };
    window.moveTask=async(id,status)=>{await updateDoc(doc(db,"tasks",id),{status,updatedAt:serverTimestamp()});notify("Task moved")};
    window.deleteTask=async id=>{if(!canManage()) return notify("Only leaders can delete tasks."); if(confirm("Delete task?")){await deleteDoc(doc(db,"tasks",id));notify("Task deleted")}};

    window.completeFollowUp=async(id,memberId)=>{await updateDoc(doc(db,"followUps",id),{status:"Completed",completedAt:serverTimestamp()});if(memberId)await updateDoc(doc(db,"youthMembers",memberId),{followUpStatus:"Completed"});notify("Follow-up completed")};

    window.deleteFollowUp = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete follow-ups.");
      if(confirm("Delete this follow-up?")){
        await deleteDoc(doc(db,"followUps",id));
        notify("Follow-up deleted");
      }
    };


    window.createFollowUp=async id=>{
      const m=youthMembers.find(x=>x.id===id); if(!m)return;
      await addDoc(collection(db,"followUps"),{memberId:m.id,memberName:m.name,contactNumber:m.contactNumber||"",reason:isMissing(m)?"Missing 2+ weeks":"Needs follow-up",assignedTo:m.cellLeader||"Unassigned",status:"Pending",dueDate:"",notes:"",createdAt:serverTimestamp()});
      await updateDoc(doc(db,"youthMembers",id),{followUpStatus:"Pending"});
      notify("Follow-up created");
    };

    window.updateUserRole=async function(uid){
      if(!canAdmin()) return notify("Only Admin can change roles.");
      await updateDoc(doc(db,"userProfiles",uid),{role:$(`role-${uid}`).value,team:$(`team-${uid}`).value.trim(),status:$(`ustatus-${uid}`).value,updatedAt:serverTimestamp()});
      notify("Access updated");
    };

    window.importJsonData=async function(){
      if(!canAdmin()) return notify("Only Admin can import data.");
      const file=$("importFile").files[0]; if(!file)return notify("Choose firebase-import-data.json");
      const data=JSON.parse(await file.text()); let count=0;
      for(const [collectionName,items] of Object.entries(data)){
        if(!Array.isArray(items))continue;
        for(const item of items){await addDoc(collection(db,collectionName),{...item,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});count++}
      }
      notify(`Imported ${count} records`);
    };

    window.exportCSV=function(type){
      let rows=[],filename="export.csv";
      if(type==="youth"){rows=youthMembers;filename="youth-people.csv"}
      if(type==="attendance"){rows=attendance;filename="attendance.csv"}
      if(type==="followups"){rows=followUps;filename="follow-ups.csv"}
      if(type==="tasks"){rows=tasks;filename="tasks.csv"}
      if(!rows.length)return notify("No data to export");
      const keys=[...new Set(rows.flatMap(o=>Object.keys(o).filter(k=>typeof o[k]!=="object")))];
      const csv=[keys.join(","),...rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
      const blob=new Blob([csv],{type:"text/csv"}), a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
    };

    function isMissing(m){if(!m.lastAttendedDate)return true;const d=new Date(m.lastAttendedDate);return ((Date.now()-d.getTime())/(1000*60*60*24))>14}


    window.openGameSection = function(name, btn){
      if(name === "setup") name = "teams";
      document.querySelectorAll(".game-section").forEach(s=>s.classList.remove("active"));
      document.querySelectorAll(".ref-tab").forEach(b=>b.classList.remove("active"));
      const section = $(`game-${name}`);
      if(section) section.classList.add("active");
      const activeBtn = btn || document.querySelector(`.ref-tab[data-game-section="${name}"]`);
      if(activeBtn) activeBtn.classList.add("active");
      renderTournament();
      window.scrollTo({top:0,behavior:"smooth"});
    };


    let teamDivisionFilter = "";
    let teamSearchFilter = "";
    let fixtureDivisionFilter = "";
    let standingsDivisionFilter = "";
    let lastVisibleTournamentTeamIds = [];

    function divisionNamesFromTeams(teams){
      return [...new Set((teams || []).map(t=>String(t.division || "").trim()).filter(Boolean))]
        .sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
    }

    function escapeJs(value){
      return String(value ?? "").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n/g," ").replace(/\r/g," ");
    }

    function divisionMatch(value, selected){
      if(!selected) return true;
      const text = String(value || "").trim();
      if(text === selected) return true;
      return text.split("/").map(x=>x.trim()).includes(selected);
    }

    function teamMatchesSearch(team, query){
      const q = String(query || "").trim().toLowerCase();
      if(!q) return true;
      const haystack = [
        team.name,
        team.captain,
        team.division,
        team.referee,
        team.notes,
        ...(team.players || [])
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    }

    function filteredTeamsForEditor(teams){
      return (teams || []).filter(t=>divisionMatch(t.division, teamDivisionFilter)).filter(t=>teamMatchesSearch(t, teamSearchFilter));
    }

    function filteredMatchesForFixtures(matches){
      return (matches || []).filter(m=>divisionMatch(m.division, fixtureDivisionFilter));
    }

    function filteredRowsForStandings(rows){
      return (rows || []).filter(r=>divisionMatch(r.division, standingsDivisionFilter));
    }

    function renderDivisionSelect(id, selected, divisions, label, setterName){
      const el = $(id);
      if(!el) return;
      const current = selected || "";
      el.innerHTML = `<option value="">${label}</option>` + divisions.map(div=>`<option value="${clean(div)}" ${div===current?"selected":""}>${clean(div)}</option>`).join("");
      el.value = current;
      el.onchange = () => window[setterName](el.value);
    }

    function renderDivisionPills(id, selected, divisions, setterName){
      const target = $(id);
      if(!target) return;
      target.innerHTML = `
        <button class="team-filter-pill ${!selected ? "active" : ""}" onclick="${setterName}('')">All</button>
        ${divisions.map(div=>`<button class="team-filter-pill ${div===selected ? "active" : ""}" onclick="${setterName}('${escapeJs(div)}')">${clean(div)}</button>`).join("")}
      `;
    }

    function syncTournamentFilters(teams, matches, rows){
      const divisions = divisionNamesFromTeams(teams);
      if(teamDivisionFilter && !divisions.includes(teamDivisionFilter)) teamDivisionFilter = "";
      if(fixtureDivisionFilter && !divisions.includes(fixtureDivisionFilter)) fixtureDivisionFilter = "";
      if(standingsDivisionFilter && !divisions.includes(standingsDivisionFilter)) standingsDivisionFilter = "";

      renderDivisionSelect("teamDivisionFilter", teamDivisionFilter, divisions, "All Divisions", "setTeamDivisionFilter");
      renderDivisionSelect("fixtureDivisionFilter", fixtureDivisionFilter, divisions, "All Divisions", "setFixtureDivisionFilter");
      renderDivisionSelect("standingsDivisionFilter", standingsDivisionFilter, divisions, "All Divisions", "setStandingsDivisionFilter");
      renderDivisionPills("teamDivisionQuickFilters", teamDivisionFilter, divisions, "setTeamDivisionFilter");
      renderDivisionPills("fixtureDivisionQuickFilters", fixtureDivisionFilter, divisions, "setFixtureDivisionFilter");
      renderDivisionPills("standingsDivisionQuickFilters", standingsDivisionFilter, divisions, "setStandingsDivisionFilter");

      if($("teamSearchFilter") && $("teamSearchFilter").value !== teamSearchFilter) $("teamSearchFilter").value = teamSearchFilter;
      const visibleTeams = filteredTeamsForEditor(teams);
      const visibleMatches = filteredMatchesForFixtures(matches);
      const visibleRows = filteredRowsForStandings(rows);
      if($("teamFilterCount")) $("teamFilterCount").textContent = `${visibleTeams.length}/${teams.length} teams`;
      if($("fixtureFilterCount")) $("fixtureFilterCount").textContent = `${visibleMatches.length}/${matches.length} matches`;
      if($("standingsFilterCount")) $("standingsFilterCount").textContent = `${visibleRows.length}/${rows.length} teams`;
    }

    window.setTeamDivisionFilter = function(value){
      teamDivisionFilter = value || "";
      renderTournament();
    };

    window.setTeamSearchFilter = function(value){
      teamSearchFilter = value || "";
      renderTournament();
    };

    window.clearTeamFilters = function(){
      teamDivisionFilter = "";
      teamSearchFilter = "";
      renderTournament();
    };

    window.setFixtureDivisionFilter = function(value){
      fixtureDivisionFilter = value || "";
      renderTournament();
    };

    window.setStandingsDivisionFilter = function(value){
      standingsDivisionFilter = value || "";
      renderTournament();
    };

    const FOMO_DEFAULT_TEAMS = [
      {slot:1,name:"Dishan",captain:"Dishan",division:"Division 1",referee:"Shapthi",color:"#9be15d",players:["Lakeesha","Deanna","Andy","Shaven","Navindu","Joshua"]},
      {slot:2,name:"Mishael",captain:"Mishael",division:"Division 1",referee:"Shapthi",color:"#45d6ff",players:["Nishmi","Ashcharya","Anuk W","Dilhan C","Lukesh","Dwane"]},
      {slot:3,name:"Bhagya",captain:"Bhagya",division:"Division 1",referee:"Shapthi",color:"#b893ff",players:["Abigail","Leon","Yohan","Sithanga","Anuk Het","Dilhan"]},
      {slot:4,name:"Ciara",captain:"Ciara",division:"Division 2",referee:"Yohan",color:"#ff7bd8",players:["Tayara","Shem","Mario Silva","Yashen","Dulain","Shapthi"]},
      {slot:5,name:"Samuel",captain:"Samuel",division:"Division 2",referee:"Yohan",color:"#f7bd57",players:["Bianca","Onesh","Nuran","Andrew","Sahas"]},
      {slot:6,name:"Oshara",captain:"Oshara",division:"Division 2",referee:"Yohan",color:"#f5f0e6",players:["Dyleena","Shannal","Dan","Migara","Vinuja","Vishal"]}
    ];

    function activeTournamentId(){
      return selectedEventId || "fomo-v2";
    }

    function activeTournamentSettings(){
      return tournamentSettingsList.find(s=>s.id===activeTournamentId()) || {};
    }

    async function bumpTournamentLiveSync(){
      const id = activeTournamentId();
      try{
        await setDoc(doc(db,"tournamentSettings",id), {
          eventId:id,
          lastLiveSyncAt:serverTimestamp(),
          liveSyncVersion:Date.now()
        }, { merge:true });
      }catch(e){
        console.warn("Live sync bump failed", e);
      }
    }

    function scoreValue(m, side){
      const keys = side === "A"
        ? ["scoreA","teamAScore","aScore","pointsA","teamAPoints"]
        : ["scoreB","teamBScore","bScore","pointsB","teamBPoints"];
      for(const key of keys){
        if(m && m[key] !== undefined && m[key] !== null && m[key] !== "") return Number(m[key]) || 0;
      }
      return 0;
    }

    function isMatchCountedForStandings(m){
      const status = String(m?.status || "").toLowerCase();
      return status === "completed" || status === "live" || scoreValue(m,"A") > 0 || scoreValue(m,"B") > 0;
    }

    function activeTournamentTeams(){
      const id = activeTournamentId();
      return tournamentTeams.filter(t => (t.tournamentId || "fomo-v2") === id);
    }

    function timeToMinutes(value){
      const text = String(value || "").trim();
      const match = text.match(/^(\d{1,2}):(\d{2})/);
      if(!match) return 99999;
      return Number(match[1]) * 60 + Number(match[2]);
    }

    function formatMatchTime(value){
      if(!value) return "TBC";
      const [h,m] = String(value).split(":").map(Number);
      if(Number.isNaN(h) || Number.isNaN(m)) return clean(value);
      const suffix = h >= 12 ? "PM" : "AM";
      const hour = ((h + 11) % 12) + 1;
      return `${hour}:${String(m).padStart(2,"0")} ${suffix}`;
    }

    function sortedMatches(list){
      return [...(list || [])].sort((a,b)=> timeToMinutes(a.time) - timeToMinutes(b.time) || String(a.label||"").localeCompare(String(b.label||"")));
    }

    function activeTournamentMatches(){
      const id = activeTournamentId();
      return sortedMatches(tournamentMatches.filter(m => (m.tournamentId || "fomo-v2") === id));
    }

    function matchDivision(a,b){
      if(a?.division && a?.division === b?.division) return a.division;
      return [a?.division,b?.division].filter(Boolean).join(" / ") || "Open";
    }

    function matchReferee(a,b){
      if(a?.referee && a?.referee === b?.referee) return a.referee;
      return [a?.referee,b?.referee].filter(Boolean).join(" / ") || "TBC";
    }

    window.saveTournamentSettings = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can edit the game plan.");
      const id = activeTournamentId();
      const selectedEvent = events.find(e=>e.id===id);
      const data = {
        eventId:id,
        title: $("tournamentTitle")?.value.trim() || selectedEvent?.title || "FOMO v2",
        subtitle: $("tournamentSubtitle")?.value.trim() || "The Ultimate Room",
        date: $("tournamentDate")?.value || selectedEvent?.date || "2026-06-27",
        startTime: $("tournamentStartTime")?.value || selectedEvent?.time || "15:00",
        venue: $("tournamentVenue")?.value.trim() || selectedEvent?.location || "Infinity Sports Arena",
        message: $("tournamentMessage")?.value.trim() || selectedEvent?.description || "",
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db,"tournamentSettings",id), data, { merge:true });
      notify("Game plan setup saved");
    };

    window.seedFomoTeams = async function(force=false){
      if(!canManage()) return notify("Only Admin or Core Moderator can create team slots.");
      const id = activeTournamentId();
      const currentTeams = activeTournamentTeams();
      if(!force && currentTeams.length >= 6) return;
      const bySlot = new Map(currentTeams.map(t=>[Number(t.slot||0),t]));
      for(const team of FOMO_DEFAULT_TEAMS){
        const data = {
          tournamentId:id,
          slot:team.slot,
          name:team.name,
          color:team.color,
          captain:team.captain,
          division:team.division,
          referee:team.referee,
          players:team.players,
          notes:`${team.division} • Ref: ${team.referee}`,
          updatedAt:serverTimestamp()
        };
        const existing = bySlot.get(team.slot);
        if(existing){
          const merged = force ? data : {
            tournamentId:id,
            slot:existing.slot || team.slot,
            name:existing.name && !String(existing.name).startsWith("Team ") ? existing.name : team.name,
            color:existing.color || team.color,
            captain:existing.captain || team.captain,
            division:existing.division || team.division,
            referee:existing.referee || team.referee,
            players:Array.isArray(existing.players) && existing.players.length ? existing.players : team.players,
            notes:existing.notes || `${team.division} • Ref: ${team.referee}`,
            updatedAt:serverTimestamp()
          };
          await updateDoc(doc(db,"tournamentTeams",existing.id), merged);
        }else{
          await addDoc(collection(db,"tournamentTeams"), {...data, createdAt:serverTimestamp()});
        }
      }
      notify(force ? "FOMO teams updated with the final roster." : "FOMO teams inserted. Existing edits were kept.");
    };

    async function ensureFomoTeamsSeeded(){
      if(!canManage()) return;
      const id = activeTournamentId();
      const teams = activeTournamentTeams();
      const defaultNames = new Set(FOMO_DEFAULT_TEAMS.map(t=>t.name));
      const hasDefaultSet = FOMO_DEFAULT_TEAMS.every(t=>teams.some(x=>(x.name||"")===t.name));
      const seedKey = `yc-fomo-teams-seeded-${id}`;
      if(!teams.length){
        await seedFomoTeams(false);
        try{ localStorage.setItem(seedKey,"1"); }catch(e){}
        return;
      }
      if(!hasDefaultSet && !localStorage.getItem(seedKey)){
        await seedFomoTeams(true);
        try{ localStorage.setItem(seedKey,"1"); }catch(e){}
      }
    }

    window.createSixTeamSlots = async function(){
      await seedFomoTeams(true);
    };

    window.addTournamentTeam = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can add teams.");
      const id = activeTournamentId();
      const currentTeams = activeTournamentTeams();
      await addDoc(collection(db,"tournamentTeams"), {
        tournamentId:id,
        slot:currentTeams.length + 1,
        name:`Team ${currentTeams.length + 1}`,
        color:"#c6f900",
        captain:"",
        division:"",
        referee:"",
        players:[],
        notes:"",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      notify("Team added");
    };

    async function saveTournamentTeamById(id, silent=false){
      if(!canManage()){
        if(!silent) notify("Only Admin or Core Moderator can edit teams.");
        return false;
      }
      const playersText = $(`players-${id}`)?.value || "";
      const players = playersText.split("\n").map(x=>x.trim()).filter(Boolean);
      await updateDoc(doc(db,"tournamentTeams",id), {
        name:$(`team-name-${id}`)?.value.trim() || "Unnamed Team",
        color:$(`team-color-${id}`)?.value || "#c6f900",
        captain:$(`team-captain-${id}`)?.value.trim() || "",
        division:$(`team-division-${id}`)?.value.trim() || "",
        referee:$(`team-referee-${id}`)?.value.trim() || "",
        players,
        notes:$(`team-notes-${id}`)?.value.trim() || "",
        updatedAt:serverTimestamp()
      });
      if(!silent) notify("Team saved");
      return true;
    }

    window.saveTournamentTeam = async function(id){
      await saveTournamentTeamById(id, false);
    };

    window.saveVisibleTournamentTeams = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can edit teams.");
      const ids = lastVisibleTournamentTeamIds.length ? lastVisibleTournamentTeamIds : filteredTeamsForEditor(activeTournamentTeams()).map(t=>t.id);
      if(!ids.length) return notify("No visible teams to save.");
      for(const id of ids){
        if($(`team-name-${id}`)) await saveTournamentTeamById(id, true);
      }
      notify(`${ids.length} visible team${ids.length===1?"":"s"} saved`);
    };

    window.deleteTournamentTeam = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete teams.");
      if(confirm("Delete this tournament team?")){
        await deleteDoc(doc(db,"tournamentTeams",id));
        notify("Tournament team deleted");
      }
    };

    let editingTournamentTeamId = "";

    window.toggleFixtureForm = function(force){
      const panel = $("fixtureFormPanel");
      if(!panel) return;
      const open = force === true || (force !== false && !panel.classList.contains("open"));
      panel.classList.toggle("open", open);
      if(open) panel.scrollIntoView({behavior:"smooth", block:"nearest"});
    };

    window.openTournamentTeamModal = function(id){
      const t = activeTournamentTeams().find(team=>team.id===id) || tournamentTeams.find(team=>team.id===id);
      if(!t) return notify("Team not found. Click Update Final Teams first.");
      editingTournamentTeamId = id;
      const body = $("teamModalBody");
      if($("teamModalTitle")) $("teamModalTitle").textContent = t.name || "Team";
      body.innerHTML = `
        <div class="yc-modal-grid">
          <input id="team-name-${id}" value="${clean(t.name||"")}" placeholder="Team name">
          <input id="team-captain-${id}" value="${clean(t.captain||"")}" placeholder="Captain">
          <input id="team-division-${id}" value="${clean(t.division||"")}" placeholder="Division">
          <input id="team-referee-${id}" value="${clean(t.referee||"")}" placeholder="Referee">
          <input id="team-color-${id}" type="color" value="${clean(t.color||"#b9ff66")}">
          <input id="team-notes-${id}" value="${clean(t.notes||"")}" placeholder="Notes">
          <textarea class="span2" id="players-${id}" placeholder="Players - one name per line">${clean((t.players||[]).join("\n"))}</textarea>
        </div>
      `;
      $("teamEditModal").classList.remove("hidden");
    };

    window.closeTournamentTeamModal = function(){
      editingTournamentTeamId = "";
      const modal = $("teamEditModal");
      if(modal) modal.classList.add("hidden");
    };

    window.saveTournamentTeamModal = async function(){
      if(!editingTournamentTeamId) return;
      await saveTournamentTeamById(editingTournamentTeamId, false);
      closeTournamentTeamModal();
      renderTournament();
    };

    window.addTournamentMatch = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can add matches.");
      const teamA = $("matchTeamA").value;
      const teamB = $("matchTeamB").value;
      if(!teamA || !teamB || teamA === teamB) return notify("Select two different teams.");
      const teams = activeTournamentTeams();
      const matches = activeTournamentMatches();
      const a = teams.find(t=>t.id===teamA);
      const b = teams.find(t=>t.id===teamB);
      const division = matchDivision(a,b);
      const referee = matchReferee(a,b);
      const sameDivisionCount = matches.filter(m=>(m.division||"")===division).length + 1;
      await addDoc(collection(db,"tournamentMatches"), {
        tournamentId:activeTournamentId(),
        label:$("matchLabel").value.trim() || `${division.replace("Division ","Div ")} - M${sameDivisionCount}`,
        time:$("matchTime").value,
        court:$("matchCourt").value.trim(),
        division,
        referee,
        teamAId:teamA,
        teamBId:teamB,
        teamAName:a?.name || "Team A",
        teamBName:b?.name || "Team B",
        scoreA:Number($("matchScoreA").value || 0),
        scoreB:Number($("matchScoreB").value || 0),
        teamAScore:Number($("matchScoreA").value || 0),
        teamBScore:Number($("matchScoreB").value || 0),
        liveSyncVersion:Date.now(),
        status:$("matchStatus").value,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      await bumpTournamentLiveSync();
      await refreshTournamentLiveSync(true);
      ["matchLabel","matchTime","matchCourt","matchScoreA","matchScoreB"].forEach(id=>$(id).value="");
      notify("Match added");
    };

    function flashScore(text="+1"){
      const el = document.createElement("div");
      el.className = "score-pop";
      el.textContent = text;
      el.style.left = `${Math.min(window.innerWidth - 80, Math.max(80, window.innerWidth/2))}px`;
      el.style.top = `${Math.min(window.innerHeight - 120, Math.max(160, window.innerHeight/2))}px`;
      document.body.appendChild(el);
      setTimeout(()=>el.remove(), 760);
    }

    window.quickScore = async function(id, side, amount=1){
      if(!canManage()) return notify("Only Admin or Core Moderator can update scores.");
      const match = tournamentMatches.find(m=>m.id===id);
      if(!match) return notify("Match not found.");
      const updates = { updatedAt: serverTimestamp(), liveSyncVersion:Date.now() };
      const delta = Number(amount || 0);
      if(side === "A") { updates.scoreA = Math.max(0, scoreValue(match,"A") + delta); updates.teamAScore = updates.scoreA; }
      if(side === "B") { updates.scoreB = Math.max(0, scoreValue(match,"B") + delta); updates.teamBScore = updates.scoreB; }
      await updateDoc(doc(db,"tournamentMatches",id), updates);
      const idx = tournamentMatches.findIndex(m=>m.id===id);
      if(idx > -1){
        tournamentMatches[idx] = { ...tournamentMatches[idx], ...updates, updatedAt:new Date().toISOString() };
        renderTournament();
      }
      await bumpTournamentLiveSync();
      refreshTournamentLiveSync(true);
      flashScore(`${delta > 0 ? "+" : ""}${delta}`);
    };

    window.saveTournamentMatch = async function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can edit matches.");
      const scoreAValue = Number($(`scoreA-${id}`).value || 0);
      const scoreBValue = Number($(`scoreB-${id}`).value || 0);
      const updates = {
        scoreA:scoreAValue,
        scoreB:scoreBValue,
        teamAScore:scoreAValue,
        teamBScore:scoreBValue,
        status:$(`status-${id}`).value,
        court:$(`court-${id}`).value.trim(),
        time:$(`time-${id}`).value,
        updatedAt:serverTimestamp(),
        liveSyncVersion:Date.now()
      };
      await updateDoc(doc(db,"tournamentMatches",id), updates);
      const idx = tournamentMatches.findIndex(m=>m.id===id);
      if(idx > -1){
        tournamentMatches[idx] = { ...tournamentMatches[idx], ...updates, updatedAt:new Date().toISOString() };
        renderTournament();
      }
      await bumpTournamentLiveSync();
      refreshTournamentLiveSync(true);
      notify("Match updated");
    };


    window.setTournamentMatchLive = async function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can start matches.");
      const matches = activeTournamentMatches();
      for(const m of matches){
        if(m.id !== id && m.status === "Live"){
          await updateDoc(doc(db,"tournamentMatches",m.id), { status:"Upcoming", updatedAt:serverTimestamp(), liveSyncVersion:Date.now() });
        }
      }
      await updateDoc(doc(db,"tournamentMatches",id), { status:"Live", updatedAt:serverTimestamp(), liveSyncVersion:Date.now() });
      await bumpTournamentLiveSync();
      refreshTournamentLiveSync(true);
      notify("Match is now live");
    };

    window.pauseTournamentMatch = async function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can pause matches.");
      await updateDoc(doc(db,"tournamentMatches",id), { status:"Upcoming", updatedAt:serverTimestamp(), liveSyncVersion:Date.now() });
      await bumpTournamentLiveSync();
      refreshTournamentLiveSync(true);
      notify("Match moved back to upcoming");
    };

    window.completeTournamentMatch = async function(id){
      if(!canManage()) return notify("Only Admin or Core Moderator can complete matches.");
      await updateDoc(doc(db,"tournamentMatches",id), { status:"Completed", updatedAt:serverTimestamp(), liveSyncVersion:Date.now() });
      await bumpTournamentLiveSync();
      refreshTournamentLiveSync(true);
      notify("Match completed");
    };

    window.startNextTournamentMatch = async function(){
      if(!canManage()) return notify("Only Admin or Core Moderator can start matches.");
      const next = activeTournamentMatches().find(m=>m.status==="Upcoming");
      if(!next) return notify("No upcoming match found.");
      await window.setTournamentMatchLive(next.id);
    };

    window.deleteTournamentMatch = async function(id){
      if(!canAdmin()) return notify("Only Admin can delete matches.");
      if(confirm("Delete this match?")){
        await deleteDoc(doc(db,"tournamentMatches",id));
        await bumpTournamentLiveSync();
        refreshTournamentLiveSync(true);
        notify("Match deleted");
      }
    };

    function teamById(id){
      return activeTournamentTeams().find(t=>t.id===id) || tournamentTeams.find(t=>t.id===id) || {};
    }

    function standings(){
      const table = {};
      const teams = activeTournamentTeams();
      const matches = activeTournamentMatches();

      teams.forEach(t=>{
        table[t.id] = { id:t.id, name:t.name || `Team ${t.slot||""}`, color:t.color || "#c6f900", division:t.division||"", referee:t.referee||"", played:0, won:0, lost:0, draw:0, pts:0, diff:0 };
      });

      matches.filter(isMatchCountedForStandings).forEach(m=>{
        if(!table[m.teamAId] || !table[m.teamBId]) return;
        const a = table[m.teamAId], b = table[m.teamBId];
        const scoreA = scoreValue(m,"A"), scoreB = scoreValue(m,"B");
        a.played++; b.played++;
        a.diff += scoreA - scoreB;
        b.diff += scoreB - scoreA;
        if(scoreA > scoreB){ a.won++; b.lost++; a.pts += 3; }
        else if(scoreB > scoreA){ b.won++; a.lost++; b.pts += 3; }
        else { a.draw++; b.draw++; a.pts += 1; b.pts += 1; }
      });

      return Object.values(table).sort((a,b)=> b.pts - a.pts || b.diff - a.diff || a.name.localeCompare(b.name));
    }

    function liveMatchFrom(matches){
      return matches.find(m=>m.status==="Live") || matches.find(m=>m.status==="Upcoming") || matches[0];
    }

    function nextUpcomingMatch(matches){
      return matches.filter(m=>m.status!=="Completed").sort((a,b)=>timeToMinutes(a.time)-timeToMinutes(b.time))[0] || null;
    }

    function renderPodium(rows, targetId){
      const target = $(targetId);
      if(!target) return;
      const top = [rows[1], rows[0], rows[2]];
      const labels = ["02", "01", "03"];
      target.innerHTML = rows.length ? top.map((r,i)=> r ? `
        <div class="podium-card ${i===1?"first":""}" data-rank="${labels[i]}" style="border-color:${clean(r.color)}">
          <h4>${clean(r.name)}</h4>
          <p>${r.pts} pts • Diff ${r.diff}</p>
        </div>
      ` : `<div class="podium-card" data-rank="${labels[i]}"><h4>-</h4><p>Waiting</p></div>`).join("") : `<div class="empty" style="grid-column:1/-1">No teams yet.</div>`;
    }

    function renderDivisionProgress(matches){
      const target = $("divisionProgressBoard");
      if(!target) return;
      const divisions = [...new Set(activeTournamentTeams().map(t=>t.division).filter(Boolean))];
      target.innerHTML = divisions.length ? divisions.map(div=>{
        const total = matches.filter(m=>(m.division||"")===div).length;
        const done = matches.filter(m=>(m.division||"")===div && m.status==="Completed").length;
        const pct = total ? Math.round(done / total * 100) : 0;
        const referee = (activeTournamentTeams().find(t=>t.division===div)||{}).referee || "TBC";
        return `<div class="chart-list-row"><div><b>${clean(div)}</b><div class="mini-progress"><i style="--w:${pct}%"></i></div><p style="color:#aeb9ce;font-size:12px;margin-top:8px;">${done}/${total} matches • Ref: ${clean(referee)}</p></div><strong>${pct}%</strong></div>`;
      }).join("") : `<div class="empty">Division progress will appear once teams are inserted.</div>`;
    }

    function renderControlCenter(matches, rows, tournamentSettings, selectedEvent){
      const live = matches.find(m=>m.status==="Live");
      const current = live || matches.find(m=>m.status==="Upcoming") || matches[0];
      const next = nextUpcomingMatch(matches);
      if($("controlCurrentMatch")){
        $("controlCurrentMatch").textContent = current ? `${teamById(current.teamAId).name || current.teamAName || "Team A"} ${scoreValue(current,"A")} — ${scoreValue(current,"B")} ${teamById(current.teamBId).name || current.teamBName || "Team B"}` : "No live match yet";
      }
      if($("controlCurrentMeta")){
        $("controlCurrentMeta").textContent = current ? `${current.label || "Match"} • ${formatMatchTime(current.time)} • ${current.court || "Ground TBC"} • ${current.status || "Upcoming"}` : "Set a match to Live and it appears here.";
      }
      if($("controlNextMatch")){
        $("controlNextMatch").textContent = next ? `${teamById(next.teamAId).name || next.teamAName || "Team A"} vs ${teamById(next.teamBId).name || next.teamBName || "Team B"}` : "No upcoming match";
      }
      updateCountdown(next, tournamentSettings, selectedEvent);
      const courts = [...new Set(matches.map(m=>m.court || "Court / Ground").filter(Boolean))].slice(0,4);
      if($("controlCourtStatus")){
        $("controlCourtStatus").innerHTML = courts.length ? courts.map(c=>{
          const onCourt = matches.find(m=>(m.court||"Court / Ground")===c && m.status==="Live") || matches.find(m=>(m.court||"Court / Ground")===c && m.status==="Upcoming");
          return `<div class="court-status-pill"><span>${clean(c)}</span><b>${clean(onCourt?.status || "Ready")}</b></div>`;
        }).join("") : `<div class="court-status-pill"><span>Court status</span><b>Ready</b></div>`;
      }
    }

    let countdownMatchKey = "";
    let countdownTimer = null;
    function updateCountdown(match, tournamentSettings, selectedEvent){
      const box = $("controlCountdown");
      if(!box) return;
      if(!match || !match.time){ box.textContent = "TBC"; return; }
      const date = tournamentSettings.date || selectedEvent?.date || "2026-06-27";
      countdownMatchKey = `${date}T${match.time}`;
      const tick = ()=>{
        const target = new Date(`${date}T${match.time}:00`);
        const diff = target.getTime() - Date.now();
        if(Number.isNaN(target.getTime())) return box.textContent = formatMatchTime(match.time);
        if(diff <= 0) return box.textContent = match.status === "Live" ? "LIVE" : "NOW";
        const totalM = Math.floor(diff/60000);
        const h = Math.floor(totalM/60);
        const m = totalM % 60;
        box.textContent = h ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`;
      };
      tick();
      if(!countdownTimer){ countdownTimer = setInterval(()=>{ const m = nextUpcomingMatch(activeTournamentMatches()); updateCountdown(m, activeTournamentSettings(), events.find(e=>e.id===activeTournamentId())); }, 30000); }
    }

    function renderLiveBoard(match, targetId){
      const target = $(targetId);
      if(!target) return;
      if(match){
        target.innerHTML = `
          <div class="live-team">
            <h3>${clean(teamById(match.teamAId).name || match.teamAName || "Team A")}</h3>
            <div class="score">${scoreValue(match,"A")}</div>
          </div>
          <div class="vs-pill">VS</div>
          <div class="live-team">
            <h3>${clean(teamById(match.teamBId).name || match.teamBName || "Team B")}</h3>
            <div class="score">${scoreValue(match,"B")}</div>
          </div>
        `;
      }else{
        target.innerHTML = `<div class="empty">No matches yet. Create your first match in Schedule + Scores.</div>`;
      }
    }

    function renderTournament(){
      if(!$("tournamentTeamsList")) return;

      const selectedEvent = events.find(e=>e.id===activeTournamentId());
      const tournamentSettings = activeTournamentSettings();
      const teams = activeTournamentTeams().sort((a,b)=>(a.slot||0)-(b.slot||0));
      const matches = activeTournamentMatches();
      const rows = standings();
      syncTournamentFilters(teams, matches, rows);
      const visibleTeams = filteredTeamsForEditor(teams);
      const visibleFixtureMatches = filteredMatchesForFixtures(matches);
      const visibleStandingRows = filteredRowsForStandings(rows);
      const live = matches.find(m=>m.status==="Live");
      const next = matches.find(m=>m.status==="Upcoming");
      const current = live || next || matches.find(m=>m.status!=="Completed") || matches[0] || null;
      const upcomingQueue = matches.filter(m=>m.status!=="Completed").filter(m=>!live || m.id!==live.id).slice(0,5);
      const liveOrNext = current;

      const title = tournamentSettings.title || selectedEvent?.title || "FOMO 2.0";
      const subtitle = tournamentSettings.subtitle || "The Ultimate Room";
      const date = tournamentSettings.date || selectedEvent?.date || "2026-06-27";
      const venue = tournamentSettings.venue || selectedEvent?.location || "Infinity Sports Arena";

      if($("tournamentTitle")) $("tournamentTitle").value = title;
      if($("tournamentSubtitle")) $("tournamentSubtitle").value = subtitle;
      if($("tournamentDate")) $("tournamentDate").value = date;
      if($("tournamentStartTime")) $("tournamentStartTime").value = tournamentSettings.startTime || selectedEvent?.time || "15:00";
      if($("tournamentVenue")) $("tournamentVenue").value = venue;
      if($("tournamentMessage")) $("tournamentMessage").value = tournamentSettings.message || selectedEvent?.description || "";

      if($("refTournamentTitle")) $("refTournamentTitle").textContent = `${title} Game Plan`;
      if($("refTeamCount")) $("refTeamCount").textContent = teams.length;
      if($("refMatchCount")) $("refMatchCount").textContent = matches.length;
      if($("refLiveCount")) $("refLiveCount").textContent = matches.filter(m=>m.status==="Live").length;
      if($("refDoneCount")) $("refDoneCount").textContent = matches.filter(m=>m.status==="Completed").length;

      if($("publicTournamentTitle")) $("publicTournamentTitle").textContent = title;
      if($("publicTournamentSubtitle")) $("publicTournamentSubtitle").textContent = subtitle;
      if($("publicTournamentMeta")) $("publicTournamentMeta").innerHTML = `
        <div class="list-item"><div><h4>Date & Time</h4><p>${clean(date)} • ${clean(tournamentSettings.startTime||selectedEvent?.time||"03:00 PM")}</p></div></div>
        <div class="list-item"><div><h4>Venue</h4><p>${clean(venue)}</p></div></div>
        <div class="list-item"><div><h4>Note</h4><p>${clean(tournamentSettings.message||"Game plan will be updated live.")}</p></div></div>
      `;

      if($("divisionRefGrid")){
        const groups = ["Division 1","Division 2"].map(div=>{
          const groupTeams = teams.filter(t=>t.division===div);
          const ref = groupTeams[0]?.referee || (div==="Division 1" ? "Shapthi" : "Yohan");
          return `<div class="division-ref-card"><h4>${div}</h4><p>Ref: ${clean(ref)} • ${groupTeams.map(t=>clean(t.name)).join(" / ") || "Teams loading"}</p></div>`;
        }).join("");
        $("divisionRefGrid").innerHTML = groups;
      }

      const matchSelectTeams = fixtureDivisionFilter ? teams.filter(t=>divisionMatch(t.division, fixtureDivisionFilter)) : teams;
      if($("matchTeamA")) $("matchTeamA").innerHTML = `<option value="">Team A</option>` + matchSelectTeams.map(t=>`<option value="${t.id}">${clean(t.name)}${t.division ? ` • ${clean(t.division)}` : ""}</option>`).join("");
      if($("matchTeamB")) $("matchTeamB").innerHTML = `<option value="">Team B</option>` + matchSelectTeams.map(t=>`<option value="${t.id}">${clean(t.name)}${t.division ? ` • ${clean(t.division)}` : ""}</option>`).join("");

      if($("liveControlBoard")){
        if(current){
          const aName = teamById(current.teamAId).name || current.teamAName || "Team A";
          const bName = teamById(current.teamBId).name || current.teamBName || "Team B";
          $("liveControlBoard").innerHTML = `
            <div class="live-score-layout">
              <div class="score-team-panel" style="border-color:${clean(teamById(current.teamAId).color||"rgba(255,255,255,.10)")}">
                <h3>${clean(aName)}</h3>
                <div class="score-number">${scoreValue(current,"A")}</div>
              </div>
              <div class="score-versus">VS</div>
              <div class="score-team-panel" style="border-color:${clean(teamById(current.teamBId).color||"rgba(255,255,255,.10)")}">
                <h3>${clean(bName)}</h3>
                <div class="score-number">${scoreValue(current,"B")}</div>
              </div>
            </div>
            <div class="live-match-meta-bar">
              <span class="pill status-${roleKey(current.status)}">${clean(current.status||"Upcoming")}</span>
              <span class="pill">${clean(current.label||"Match")}</span>
              <span class="pill">${formatMatchTime(current.time)}</span>
              <span class="pill">${clean(current.court||"Ground TBC")}</span>
              <span class="pill">Ref: ${clean(current.referee||"TBC")}</span>
            </div>
          `;
          $("liveControlActions").innerHTML = `
            <div class="score-action-grid">
              <button class="score-main-action" onclick="quickScore('${current.id}','A',1)">+1 ${clean(aName)}</button>
              <button class="btn-ghost" onclick="quickScore('${current.id}','A',-1)">-1 ${clean(aName)}</button>
              <button class="btn-yellow" onclick="current.status==='Live'?pauseTournamentMatch('${current.id}'):setTournamentMatchLive('${current.id}')">${current.status==="Live" ? "Pause" : "Start Live"}</button>
              <button class="btn-purple" onclick="completeTournamentMatch('${current.id}')">Complete</button>
              <button class="btn-ghost" onclick="quickScore('${current.id}','B',-1)">-1 ${clean(bName)}</button>
              <button class="score-main-action" onclick="quickScore('${current.id}','B',1)">+1 ${clean(bName)}</button>
            </div>
            <div class="match-flow-actions">
              <button class="btn-ghost" onclick="openGameSection('fixtures')">Open Fixtures</button>
              <button class="btn-ghost" onclick="startNextTournamentMatch()">Start Next Match</button>
              <button class="btn-danger" onclick="completeTournamentMatch('${current.id}')">Finish Current Match</button>
            </div>
          `;
        }else{
          $("liveControlBoard").innerHTML = `
            <div class="live-empty-state">
              <div>
                <h3>No match is live yet.</h3>
                <p>Add fixtures or start the next upcoming match to begin the tournament.</p>
              </div>
            </div>
          `;
          $("liveControlActions").innerHTML = `
            <div class="match-flow-actions">
              <button onclick="openGameSection('fixtures')">Add Fixtures</button>
              <button class="btn-ghost" onclick="seedFomoTeams(true)">Insert FOMO Teams</button>
              <button class="btn-purple" onclick="startNextTournamentMatch()">Start Next Match</button>
            </div>
          `;
        }
      }

      if($("nextMatchQueue")){
        const queue = upcomingQueue.length ? upcomingQueue : (next ? [next] : []);
        $("nextMatchQueue").innerHTML = queue.length ? queue.map((m,i)=>{
          const aName = teamById(m.teamAId).name || m.teamAName || "Team A";
          const bName = teamById(m.teamBId).name || m.teamBName || "Team B";
          if(i===0){
            return `<div class="next-main-card"><h3>${clean(aName)} vs ${clean(bName)}</h3><p>${clean(m.label||"Match")} • ${formatMatchTime(m.time)} • ${clean(m.court||"Ground TBC")} • Ref: ${clean(m.referee||"TBC")}</p><div style="height:10px"></div><button class="mini-btn" onclick="setTournamentMatchLive('${m.id}')">Set Live</button></div>`;
          }
          return `<div class="next-small-card"><b>${formatMatchTime(m.time)}</b><p>${clean(aName)} vs ${clean(bName)}<br>${clean(m.court||"Ground TBC")}</p></div>`;
        }).join("") : `<div class="empty">No upcoming matches.</div>`;
      }

      if($("miniLeaderboard")){
        $("miniLeaderboard").innerHTML = rows.length ? rows.slice(0,5).map((r,i)=>`
          <div class="leader-row">
            <span class="leader-rank">${i+1}</span>
            <div><h4>${clean(r.name)}</h4><p>${r.played} played • Diff ${r.diff}</p></div>
            <strong class="leader-points">${r.pts}</strong>
          </div>
        `).join("") : `<div class="empty">Standings will appear after teams are added.</div>`;
      }

      if($("gameMatchQueue")){
        $("gameMatchQueue").innerHTML = matches.length ? matches.slice(0,8).map(m=>{
          const aName = teamById(m.teamAId).name || m.teamAName || "Team A";
          const bName = teamById(m.teamBId).name || m.teamBName || "Team B";
          return `<div class="queue-card ${m.status==="Live"?"live":""}">
            <div class="queue-time">${formatMatchTime(m.time)}</div>
            <div><h4>${clean(aName)} vs ${clean(bName)}</h4><p>${clean(m.label||"Match")} • ${clean(m.court||"Ground TBC")} • ${clean(m.status||"Upcoming")} • ${scoreValue(m,"A")} - ${scoreValue(m,"B")}</p></div>
            <button class="mini-btn ${m.status==="Live"?"btn-yellow":""}" onclick="${m.status==="Live" ? `completeTournamentMatch('${m.id}')` : `setTournamentMatchLive('${m.id}')`}">${m.status==="Live" ? "Complete" : "Set Live"}</button>
          </div>`;
        }).join("") : `<div class="empty">Match queue is empty.</div>`;
      }

      if($("tournamentTeamsList")) {
        lastVisibleTournamentTeamIds = visibleTeams.map(t=>t.id);
        $("tournamentTeamsList").innerHTML = teams.length ? (visibleTeams.length ? visibleTeams.map(t=>{
          const chips = (t.players || []).map(p=>`<span class="player-chip">${clean(p)}</span>`).join("");
          return `
            <div class="team-card team-summary-card" style="--team-color:${clean(t.color||"#b9ff66")}">
              <h4>${clean(t.name||"Unnamed Team")}</h4>
              <p class="team-summary-meta">Captain: ${clean(t.captain||"TBC")} • ${clean(t.division||"Division TBC")} • Ref: ${clean(t.referee||"TBC")}</p>
              <div class="player-chips">${chips || `<span class="player-chip">Players coming soon</span>`}</div>
              <div class="team-card-actions">
                <div class="team-save-group">
                  <button class="mini-btn" onclick="openTournamentTeamModal('${t.id}')">Edit Team</button>
                  <button class="mini-btn btn-ghost" onclick="openGameSection('fixtures')">Fixtures</button>
                </div>
                <div class="team-delete-group">
                  <button class="mini-btn btn-danger" onclick="deleteTournamentTeam('${t.id}')">Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join("") : `<div class="empty">No teams match this division/search filter. Clear filters to see all teams.</div>`) : `<div class="empty">No teams yet. Click Update Final Teams.</div>`;
      }

      if($("tournamentMatchesList")) $("tournamentMatchesList").innerHTML = visibleFixtureMatches.length ? visibleFixtureMatches.map(m=>{
        const aName = teamById(m.teamAId).name || m.teamAName || "Team A";
        const bName = teamById(m.teamBId).name || m.teamBName || "Team B";
        const accent = teamById(m.teamAId).color || "#c6f900";
        return `
        <div class="match-card ${m.status==="Live"?"match-live":""}" style="--match-accent:${clean(accent)}">
          <div class="match-shell">
            <div class="match-time-chip">${formatMatchTime(m.time)}</div>
            <div>
              <div class="match-title-row">
                <div><h4>${clean(m.label||"Match")}</h4><p class="control-match-meta">${clean(m.division||"Open")} • Ref: ${clean(m.referee||"TBC")} • ${clean(m.court||"Ground TBC")}</p></div>
                <span class="pill status-${roleKey(m.status)}">${clean(m.status||"Upcoming")}</span>
              </div>
              <div class="match-versus">
                <span class="match-team-name">${clean(aName)}</span>
                <span class="match-score-pill">${scoreValue(m,"A")} - ${scoreValue(m,"B")}</span>
                <span class="match-team-name">${clean(bName)}</span>
              </div>
              <div class="match-edit-grid">
                <input id="time-${m.id}" type="time" value="${clean(m.time||"")}" onchange="saveTournamentMatch('${m.id}')">
                <input id="scoreA-${m.id}" type="number" value="${scoreValue(m,"A")}" onchange="saveTournamentMatch('${m.id}')">
                <input id="scoreB-${m.id}" type="number" value="${scoreValue(m,"B")}" onchange="saveTournamentMatch('${m.id}')">
                <select id="status-${m.id}" onchange="saveTournamentMatch('${m.id}')">
                  <option ${m.status==="Upcoming"?"selected":""}>Upcoming</option>
                  <option ${m.status==="Live"?"selected":""}>Live</option>
                  <option ${m.status==="Completed"?"selected":""}>Completed</option>
                </select>
              </div>
              <input id="court-${m.id}" value="${clean(m.court||"")}" placeholder="Court / Ground" style="margin-top:8px;" onchange="saveTournamentMatch('${m.id}')">
              <div class="big-touch-actions">
                <button class="mini-btn" onclick="setTournamentMatchLive('${m.id}')">Set Live</button>
                <button class="mini-btn" onclick="quickScore('${m.id}','A',1)">+1 ${clean(aName)}</button>
                <button class="mini-btn" onclick="quickScore('${m.id}','B',1)">+1 ${clean(bName)}</button>
                <button class="mini-btn btn-yellow" onclick="saveTournamentMatch('${m.id}')">Save</button>
                <button class="mini-btn btn-purple" onclick="completeTournamentMatch('${m.id}')">Complete</button>
                <button class="mini-btn btn-danger" onclick="deleteTournamentMatch('${m.id}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `}).join("") : `<div class="empty">No matches found for this division. Clear the filter or create matches when the teams are ready.</div>`;

      const fullRows = visibleStandingRows.map(r=>`
        <tr><td><span class="pill" style="border-color:${clean(r.color)}">${clean(r.name)}</span></td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td>${r.draw}</td><td>${r.pts}</td><td>${r.diff}</td></tr>
      `).join("") || `<tr><td colspan="7">No teams found for this division.</td></tr>`;

      if($("tournamentStandings")) $("tournamentStandings").innerHTML = fullRows;
      if($("tournamentStandingsMain")) $("tournamentStandingsMain").innerHTML = fullRows;

      if($("publicStandings")) $("publicStandings").innerHTML = rows.map(r=>`
        <tr><td><span class="pill" style="border-color:${clean(r.color)}">${clean(r.name)}</span></td><td>${r.played}</td><td>${r.won}</td><td>${r.pts}</td><td>${r.diff}</td></tr>
      `).join("") || `<tr><td colspan="5">No teams yet.</td></tr>`;

      renderPodium(visibleStandingRows, "podiumBoard");
      renderPodium(rows, "publicPodium");
      renderDivisionProgress(matches);
      renderControlCenter(matches, rows, tournamentSettings, selectedEvent);
      renderLiveBoard(liveOrNext, "refLiveMatchBoard");
      renderLiveBoard(liveOrNext, "publicLiveBoard");

      if($("publicTeams")) $("publicTeams").innerHTML = teams.length ? teams.map(t=>`
        <div class="list-item">
          <div><h4><span class="pill" style="border-color:${clean(t.color||"#c6f900")}">${clean(t.name)}</span></h4><p>Captain: ${clean(t.captain||"TBC")} • ${clean(t.division||"Division TBC")} • Ref: ${clean(t.referee||"TBC")} • ${(t.players||[]).length} players</p></div>
        </div>
      `).join("") : `<div class="empty">Teams will appear here.</div>`;

      if($("publicMatches")) $("publicMatches").innerHTML = matches.length ? matches.map(m=>`
        <div class="timeline-card">
          <div class="timeline-time">${formatMatchTime(m.time)}</div>
          <div><h4>${clean(m.label||"Match")}: ${clean(teamById(m.teamAId).name||m.teamAName||"Team A")} vs ${clean(teamById(m.teamBId).name||m.teamBName||"Team B")}</h4><p>${clean(m.division||"Open")} • Ref: ${clean(m.referee||"TBC")} • ${clean(m.court||"Ground TBC")} • ${clean(m.status||"Upcoming")} • Score ${scoreValue(m,"A")} - ${scoreValue(m,"B")}</p></div>
        </div>
      `).join("") : `<div class="empty">Match schedule will appear here.</div>`;
    }

    let frisbeeAnimationId = null;
    let frisbeeState = [];
    function initFrisbeeEngine(){
      const field = $("frisbeeField");
      if(!field || frisbeeAnimationId) return;
      const discs = [...field.querySelectorAll(".bouncing-disc")];
      frisbeeState = discs.map((el,i)=>({
        el,
        x: 40 + i * 120,
        y: 70 + i * 80,
        vx: (i % 2 ? -1 : 1) * (1.4 + i * .42),
        vy: (i % 2 ? 1 : -1) * (1.1 + i * .36),
        rot: i * 40,
        hit: 0,
        size: i===2 ? 70 : (i===1 ? 42 : (i===3 ? 48 : 54))
      }));
      const step = ()=>{
        const rect = field.getBoundingClientRect();
        const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
        frisbeeState.forEach((d,idx)=>{
          d.x += d.vx; d.y += d.vy; d.rot += (idx+1) * 3.8;
          let bounced = false;
          if(d.x <= 0){ d.x = 0; d.vx = Math.abs(d.vx) * (1 + Math.random()*.03); bounced = true; }
          if(d.x + d.size >= w){ d.x = w - d.size; d.vx = -Math.abs(d.vx) * (1 + Math.random()*.03); bounced = true; }
          if(d.y <= 0){ d.y = 0; d.vy = Math.abs(d.vy) * (1 + Math.random()*.03); bounced = true; }
          if(d.y + d.size >= h){ d.y = h - d.size; d.vy = -Math.abs(d.vy) * (1 + Math.random()*.03); bounced = true; }
          if(bounced) d.hit = 1;
          d.hit = Math.max(0, d.hit - .045);
          const scale = 1 + d.hit * .55;
          d.el.style.transform = `translate3d(${d.x}px,${d.y}px,0) rotate(${d.rot}deg) scale(${scale})`;
        });
        frisbeeAnimationId = requestAnimationFrame(step);
      };
      step();
    }

    function showAppLoader(label="Opening command interface"){
      const loader = $("appLoader");
      if(!loader) return;
      const p = loader.querySelector("p");
      if(p) p.textContent = label;
      loader.classList.remove("hidden");
      setTimeout(()=>loader.classList.add("hidden"), 950);
    }

    window.addEventListener("pointermove", (event)=>{
      const x = Math.round((event.clientX / window.innerWidth) * 100);
      const y = Math.round((event.clientY / window.innerHeight) * 100);
      document.documentElement.style.setProperty("--mx", `${x}%`);
      document.documentElement.style.setProperty("--my", `${y}%`);
    }, {passive:true});


    function studioLoader(label="Opening Youth Central"){
      const loader = $("appLoader");
      if(!loader) return;
      const p = loader.querySelector("p");
      const h = loader.querySelector("h2");
      if(p) p.textContent = "YOUTH CENTRAL";
      if(h) h.textContent = label;
      loader.classList.remove("hidden");
      setTimeout(()=>loader.classList.add("hidden"), 950);
    }

    window.addEventListener("pointermove", event=>{
      const x = Math.round((event.clientX / window.innerWidth) * 100);
      const y = Math.round((event.clientY / window.innerHeight) * 100);
      document.documentElement.style.setProperty("--mx", `${x}%`);
      document.documentElement.style.setProperty("--my", `${y}%`);
    }, {passive:true});

    function byNewest(list){
      return [...(list || [])].sort((a,b)=>{
        const av = a.createdAt?.seconds || 0;
        const bv = b.createdAt?.seconds || 0;
        return bv - av;
      });
    }

    function safeRenderBlock(name, fn){
      try{ fn(); }
      catch(error){
        console.error(`Youth Central render failed: ${name}`, error);
      }
    }

        function render(){
      safeRenderBlock("selectors", renderSelectors);
      safeRenderBlock("dashboard", renderDashboard);
      safeRenderBlock("people", renderYouthTable);
      safeRenderBlock("events", renderEvents);
      safeRenderBlock("sundays", renderSundayEvents);
      safeRenderBlock("event detail", renderEventDetail);
      safeRenderBlock("tournament", renderTournament);
      safeRenderBlock("attendance", renderAttendance);
      safeRenderBlock("teams", renderTeams);
      safeRenderBlock("follow-ups", renderFollowUps);
      safeRenderBlock("reports", renderReports);
      safeRenderBlock("tasks", renderTasks);
      safeRenderBlock("users", renderUsers);
      safeRenderBlock("notifications", renderNotifications);
      safeRenderBlock("profile", updateProfileUI);
    }

    function renderSelectors(){
      const leaders=[...new Set(youthMembers.map(m=>m.cellLeader).filter(Boolean))].sort();
      const teams=[...new Set(youthMembers.map(m=>m.team||m.ministry).filter(Boolean))].sort();
      $("filterLeader").innerHTML=`<option value="">All Cell Leaders</option>`+leaders.map(l=>`<option>${clean(l)}</option>`).join("");
      $("filterTeam").innerHTML=`<option value="">All Teams</option>`+teams.map(t=>`<option>${clean(t)}</option>`).join("");
      $("attendanceMember").innerHTML=`<option value="">Select Person</option>`+youthMembers.sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(m=>`<option value="${m.id}">${clean(m.name)} - ${clean(m.team||m.ministry||"No Team")}</option>`).join("");
      $("taskOwner").innerHTML=`<option value="">Unassigned</option>`+youthMembers.map(m=>`<option>${clean(m.name)}</option>`).join("");

      if($("attendanceEventSelect")){
        const current = $("attendanceEventSelect").value;
        $("attendanceEventSelect").innerHTML=`<option value="">Custom / No event</option>`+events.map(e=>`<option value="${e.id}">${clean(e.title)} • ${clean(e.date||"")}</option>`).join("");
        $("attendanceEventSelect").value = current;
      }
      if($("eventReportSelect")){
        const currentReport = $("eventReportSelect").value;
        $("eventReportSelect").innerHTML = events.length
          ? events.map(e=>`<option value="${e.id}">${clean(e.title)} • ${clean(e.date||"")}</option>`).join("")
          : `<option value="">No events yet</option>`;
        if(currentReport && events.some(e=>e.id===currentReport)) $("eventReportSelect").value = currentReport;
      }
    }

    function renderDashboard(){
      const thisMonth = new Date().toISOString().slice(0,7);
      const presentMonth = attendance.filter(a=>String(a.date||"").startsWith(thisMonth)&&["Present","Late","Newcomer"].includes(a.status));
      const attendedUnique = new Set(presentMonth.map(a=>a.memberId)).size;
      const newcomers = youthMembers.filter(m=>m.memberType==="Newcomer").length;
      const missing = youthMembers.filter(isMissing).length;
      const openTasks = tasks.filter(t=>t.status!=="completed").length;
      $("totalYouth").textContent = youthMembers.length;
      $("newcomersCount").textContent = newcomers;
      $("attendedMonth").textContent = attendedUnique;
      $("missingCount").textContent = missing;
      $("openTaskCount").textContent = openTasks;

      const maxBase = Math.max(1, youthMembers.length, attendance.length, tasks.length);
      const attendanceRows = [
        ["This Month", attendedUnique, Math.round(attendedUnique / Math.max(1,youthMembers.length) * 100)],
        ["Newcomers", newcomers, Math.round(newcomers / Math.max(1,youthMembers.length) * 100)],
        ["Care Needed", missing, Math.round(missing / Math.max(1,youthMembers.length) * 100)],
        ["Open Tasks", openTasks, Math.round(openTasks / Math.max(1,tasks.length || openTasks || 1) * 100)]
      ];
      $("followupAlerts").innerHTML = `<div class="dashboard-chart-grid">${attendanceRows.map(([label,value,pct])=>`
        <div class="chart-stat-row"><b>${clean(label)}</b><div class="mini-bar"><i style="--w:${Math.min(100,Math.max(4,pct))}%"></i></div><span>${value}</span></div>
      `).join("")}</div>`;

      const teamCounts = {};
      youthMembers.forEach(m=>{ const k=m.team||m.ministry||"No Team"; teamCounts[k]=(teamCounts[k]||0)+1; });
      const teamEntries = Object.entries(teamCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
      const maxTeam = Math.max(1, ...teamEntries.map(x=>x[1]));
      $("teamPulse").innerHTML = teamEntries.length ? `<div class="dashboard-chart-grid">${teamEntries.map(([name,count])=>`
        <div class="chart-stat-row"><b>${clean(name)}</b><div class="mini-bar"><i style="--w:${Math.max(6,Math.round(count/maxTeam*100))}%"></i></div><span>${count}</span></div>
      `).join("")}</div>` : `<div class="empty">Team analytics will appear once people are classified.</div>`;

      const fomoEvent = events.find(e=>/fomo|frisbee|ultimate/i.test(String(e.title||""))) || events[0];
      $("latestTasks").innerHTML = `
        <div class="dash-actions-grid">
          <div class="dash-action-card"><h4>FOMO Game Plan</h4><p>Open the live referee control center.</p><button class="mini-btn btn-green" onclick="openGamePlanFromEvent()">Open Game Plan</button></div>
          <div class="dash-action-card"><h4>Public Live Link</h4><p>Share the read-only tournament page.</p><button class="mini-btn btn-ghost" onclick="openPublicGamePlan()">Open Public Page</button></div>
          <div class="dash-action-card"><h4>Attendance</h4><p>Mark attendance for Sundays and events.</p><button class="mini-btn btn-purple" onclick="openPageByName('attendance')">Mark Attendance</button></div>
          <div class="dash-action-card"><h4>Tasks</h4><p>${openTasks} tasks currently open.</p><button class="mini-btn btn-ghost" onclick="openPageByName('tasks')">Open Tasks</button></div>
        </div>`;
    }

    window.renderYouthTable=function(){
      const q=($("searchYouth").value||"").toLowerCase(),type=$("filterType").value,leader=$("filterLeader").value,team=$("filterTeam").value;
      const data=youthMembers.filter(m=>(!q||[m.name,m.contactNumber,m.location,m.cellLeader,m.ministry,m.team].join(" ").toLowerCase().includes(q))&&(!type||m.memberType===type)&&(!leader||m.cellLeader===leader)&&(!team||(m.team||m.ministry)===team));
      $("youthTable").innerHTML=data.length?data.map(m=>{
        const phone = String(m.contactNumber||"").replace(/[^0-9+]/g,"");
        return `<tr><td><div class="person"><div class="avatar">${initials(m.name)}</div><b>${clean(m.name)}</b></div></td><td>${clean(m.contactNumber)}</td><td>${clean(m.gender)}</td><td>${clean(m.location)}</td><td>${clean(m.team||m.ministry)}</td><td>${clean(m.cellLeader)}</td><td><span class="pill status-${roleKey(m.memberType)}">${clean(m.memberType||"Regular")}</span></td><td>${clean(m.lastAttendedDate||"Never")}</td><td><div class="quick-action-row"><button class="mini-btn" onclick="editMember('${m.id}')">Edit</button><button class="mini-btn btn-green" onclick="quickPresent('${m.id}')">Present</button><button class="mini-btn follow-link" onclick="createFollowUp('${m.id}')">Follow Up</button>${phone ? `<a class="btn mini-btn call-link" href="tel:${clean(phone)}">Call</a>` : `<button class="mini-btn btn-ghost" disabled>No Call</button>`}<button class="mini-btn btn-danger" onclick="deleteMember('${m.id}')">Delete</button></div></td></tr>`;
      }).join(""):`<tr><td colspan="9">No matching records.</td></tr>`;
    };

    window.quickPresent=async id=>{const m=youthMembers.find(x=>x.id===id);if(!m)return;const date=todayISO();await addDoc(collection(db,"attendance"),{memberId:id,memberName:m.name,contactNumber:m.contactNumber||"",date,eventName:"Quick Present",status:"Present",cellLeader:m.cellLeader||"",team:m.team||"",createdAt:serverTimestamp()});await updateDoc(doc(db,"youthMembers",id),{lastAttendedDate:date,updatedAt:serverTimestamp()});notify("Marked present")};




    function getEventType(e){
      const raw = String(e?.eventType || "").trim();
      const title = String(e?.title || "").toLowerCase().trim();

      // Older saved events may have been misclassified. Keep obvious youth events in Special Events.
      const looksSpecial = title.includes("fomo") || title.includes("frisbee") || title.includes("tournament") || title.includes("ultimate") || title.includes("youth event");
      const looksSunday = title === "sunday service" || title.includes("sunday service");

      if(looksSpecial) return "Special Youth Event";
      if(looksSunday) return "Sunday Service";
      if(raw) return raw;
      return "Special Youth Event";
    }

    function isSundayEvent(e){
      return getEventType(e) === "Sunday Service";
    }

    function isSpecialEvent(e){
      return getEventType(e) !== "Sunday Service";
    }

    function validUrl(url){
      return String(url || "").trim().startsWith("http");
    }


    window.openEventDetail = function(id){
      selectedEventId = id;
      const eventObj = events.find(e=>e.id===id);
      if(!eventObj) return notify("Event not found.");
      if($("eventReportSelect")) $("eventReportSelect").value = id;
      renderEventDetail();
      openPage("eventdetail", null);
    };

    window.openSelectedEventDetail = function(){
      if(selectedEventId && events.some(e=>e.id===selectedEventId)){
        renderEventDetail();
        openPage("eventdetail", null);
      }else{
        openPageByName("events");
      }
    };


    function gamePlanUrl(eventId){
      const url = new URL(window.location.href);
      url.searchParams.set("view","gameplan");
      if(eventId) url.searchParams.set("event", eventId);
      return url.toString();
    }

    function publicGamePlanUrl(eventId){
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/[^\/]*$/, "fomo-live.html");
      const liveEventId = eventId || (typeof activeTournamentId === "function" ? activeTournamentId() : selectedEventId) || "fomo-v2";
      url.searchParams.set("event", liveEventId);
      return url.toString();
    }

    window.openGamePlanFullscreen = function(){
      if(!selectedEventId && $("eventReportSelect")) selectedEventId = $("eventReportSelect").value;
      const eventObj = events.find(e=>e.id===selectedEventId);
      if(eventObj && typeof isSundayEvent === "function" && isSundayEvent(eventObj)){
        return notify("Game plan is only for special youth events.");
      }
      if(!selectedEventId) return notify("Open an event first.");
      showAppLoader("Opening Game Plan");
      window.open(gamePlanUrl(selectedEventId), "_blank");
    };

    window.enterGamePlanMode = function(eventId){
      if(eventId) selectedEventId = eventId;
      document.body.classList.add("game-mode");
      openPage("gameplan", null);
      openGameSection("teams");
      initFrisbeeEngine();
      renderTournament();
      setTimeout(()=>ensureFomoTeamsSeeded(), 250);
      setTimeout(()=>renderTournament(), 450);
      setTimeout(()=>playGameIntro(), 650);
    };

    window.exitGamePlanMode = function(){
      document.body.classList.remove("game-mode");
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("event");
      window.history.replaceState({}, "", url.toString());
      if(selectedEventId && typeof openEventDetail === "function"){
        openEventDetail(selectedEventId);
      }else{
        openPageByName("events");
      }
    };

    window.requestFullscreenGame = async function(){
      const target = document.querySelector(".referee-shell") || document.documentElement;
      try{
        if(target.requestFullscreen) await target.requestFullscreen();
        else if(target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      }catch(e){
        notify("Fullscreen blocked by browser. Use the browser menu if needed.");
      }
    };

    window.copyGamePlanLink = async function(){
      const link = gamePlanUrl(selectedEventId);
      try{
        await navigator.clipboard.writeText(link);
        notify("Game Plan link copied");
      }catch(e){
        prompt("Copy this Game Plan link:", link);
      }
    };


    window.openPublicGamePlan = function(){
      const liveEventId = (typeof activeTournamentId === "function" ? activeTournamentId() : selectedEventId) || "fomo-v2";
      window.open(publicGamePlanUrl(liveEventId), "_blank");
    };

    window.copyPublicGamePlanLink = async function(){
      const liveEventId = (typeof activeTournamentId === "function" ? activeTournamentId() : selectedEventId) || "fomo-v2";
      const link = publicGamePlanUrl(liveEventId);
      try{
        await navigator.clipboard.writeText(link);
        notify("Public live link copied");
      }catch(e){
        prompt("Copy this public live link:", link);
      }
    };

    function handleInitialRoute(){
      const params = new URLSearchParams(window.location.search);
      if(params.get("view") === "gameplan"){
        const eventId = params.get("event") || selectedEventId;
        setTimeout(()=>enterGamePlanMode(eventId), 700);
      }
    }

    window.openGamePlanFromEvent = function(){
      openGamePlanFullscreen();
    };

    function renderEventDetail(){
      if(!$("detailEventTitle")) return;
      const eventObj = events.find(e=>e.id===selectedEventId) || events.filter(isSpecialEvent)[0] || events[0];

      if(!eventObj){
        $("detailEventTitle").textContent = "No event selected";
        $("detailEventDescription").textContent = "Create an event first.";
        $("detailEventFlyer").innerHTML = "Event Flyer";
        $("detailEventMeta").innerHTML = "";
        $("detailEventStats").innerHTML = "";
        $("detailEventAbsentList").innerHTML = "";
        $("detailEventAttendanceList").innerHTML = "";
        return;
      }

      selectedEventId = eventObj.id;
      if($("eventReportSelect")) $("eventReportSelect").value = eventObj.id;

      $("detailEventTitle").textContent = eventObj.title || "Untitled Event";
      $("detailEventDescription").textContent = eventObj.description || "No event details added yet.";
      $("detailEventFlyer").innerHTML = eventFlyerHTML(eventObj);

      $("detailEventMeta").innerHTML = `
        <div class="event-type-pill">${clean(getEventType(eventObj))}</div>
        <div class="list-item"><div><h4>Date & Time</h4><p>${clean(eventObj.date||"TBC")} • ${clean(eventObj.time||"TBC")}</p></div></div>
        <div class="list-item"><div><h4>Venue</h4><p>${clean(eventObj.location||"TBC")}</p></div></div>
        <div class="list-item"><div><h4>Owner / Expected</h4><p>${clean(eventObj.owner||"Not assigned")} • Expected: ${clean(eventObj.expectedCount||"Not set")}</p></div></div>
      `;

      const regBtn = $("detailRegistrationBtn");
      if(regBtn){
        regBtn.classList.toggle("hidden", !validUrl(eventObj.registrationLink));
        regBtn.href = validUrl(eventObj.registrationLink) ? eventObj.registrationLink : "#";
      }

      const sheetBtn = $("detailSheetBtn");
      if(sheetBtn){
        sheetBtn.classList.toggle("hidden", !validUrl(eventObj.sheetLink));
        sheetBtn.href = validUrl(eventObj.sheetLink) ? eventObj.sheetLink : "#";
      }

      const gameBtn = $("detailGamePlanBtn");
      if(gameBtn){
        gameBtn.classList.toggle("hidden", isSundayEvent(eventObj));
      }

      const stats = eventStats(eventObj);
      $("detailEventStats").innerHTML = `
        <div class="event-detail-stat"><p>Total People</p><h3>${stats.total}</h3></div>
        <div class="event-detail-stat"><p>Came</p><h3>${stats.came}</h3></div>
        <div class="event-detail-stat"><p>Did Not Come</p><h3>${stats.didntCome}</h3></div>
        <div class="event-detail-stat"><p>Not Marked</p><h3>${stats.notMarked}</h3></div>
      `;

      const didnt = youthMembers.filter(m=>{
        const s = stats.map.get(m.id);
        return s === "Absent" || !s;
      });

      $("detailEventAbsentList").innerHTML = didnt.length ? didnt.map(m=>{
        const s = stats.map.get(m.id) || "Not Marked";
        return `
          <div class="list-item">
            <div class="person">
              <div class="avatar">${initials(m.name)}</div>
              <div><h4>${clean(m.name)}</h4><p>${clean(m.contactNumber||"No phone")} • ${clean(m.team||m.ministry||"No team")} • ${clean(m.cellLeader||"No leader")}</p></div>
            </div>
            <span class="pill status-${roleKey(s)}">${clean(s)}</span>
          </div>
        `;
      }).join("") : `<div class="empty">Everyone is marked as came for this event.</div>`;

      const records = attendance.filter(a =>
        (a.eventId && a.eventId === eventObj.id) ||
        (!a.eventId && a.eventName === eventObj.title && a.date === eventObj.date)
      );

      $("detailEventAttendanceList").innerHTML = records.length ? records.slice(0,50).map(a=>`
        <div class="list-item">
          <div><h4>${clean(a.memberName)}</h4><p>${clean(a.date)} • ${clean(a.team||"No team")} • <span class="pill status-${roleKey(a.status)}">${clean(a.status)}</span></p></div>
        </div>
      `).join("") : `<div class="empty">No attendance marked for this event yet.</div>`;
    }

        function eventFlyerHTML(e){
      const img = safeImageUrl(e.flyerData) || safeImageUrl(e.flyerURL);
      if(img) return `<img src="${img}" alt="${clean(e.title)} flyer">`;
      return `Event<br>Flyer`;
    }

    function eventStatusMap(eventObj){
      const records = attendance.filter(a =>
        (a.eventId && a.eventId === eventObj.id) ||
        (!a.eventId && a.eventName === eventObj.title && a.date === eventObj.date)
      );

      const map = new Map();
      records.forEach(a=>{
        if(!map.has(a.memberId)) map.set(a.memberId, a.status || "Not Marked");
      });
      return map;
    }

    function eventStats(eventObj){
      const map = eventStatusMap(eventObj);
      let came = 0, absent = 0, notMarked = 0;
      youthMembers.forEach(m=>{
        const s = map.get(m.id);
        if(["Present","Late","Newcomer"].includes(s)) came++;
        else if(s === "Absent") absent++;
        else notMarked++;
      });
      return { came, absent, notMarked, didntCome: absent + notMarked, total:youthMembers.length, map };
    }

    function renderEvents(){
      if(!$("eventList")) return;

      const specialEvents = events.filter(isSpecialEvent).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
      if($("eventReportSelect") && !$("eventReportSelect").value && specialEvents[0]) $("eventReportSelect").value = specialEvents[0].id;

      $("eventList").innerHTML = specialEvents.length ? specialEvents.map(e=>{
        const stats = eventStats(e);
        return `
          <div class="list-item event-card">
            <div class="event-flyer">${eventFlyerHTML(e)}</div>
            <div>
              <span class="event-type-pill">${clean(getEventType(e))}</span>
              <h4>${clean(e.title)}</h4>
              <p>${clean(e.date||"No date")} ${clean(e.time||"")} • ${clean(e.location||"No location")}</p>
              <p>${clean(e.description||"No event details added")}</p>
              <p><span class="pill status-Present">${stats.came} came</span> <span class="pill status-Absent">${stats.didntCome} did not come</span> <span class="pill">${stats.notMarked} not marked</span></p>
              <div class="event-link-row">
                ${validUrl(e.registrationLink) ? `<a class="btn mini-btn" href="${clean(e.registrationLink)}" target="_blank" rel="noopener">Register</a>` : ""}
                ${validUrl(e.sheetLink) ? `<a class="btn btn-ghost mini-btn" href="${clean(e.sheetLink)}" target="_blank" rel="noopener">Sheet</a>` : ""}
              </div>
              <div class="event-actions">
                <button class="mini-btn btn-purple" onclick="openEventDetail('${e.id}')">View Details</button>
                <button class="mini-btn btn-green" onclick="selectAndOpenGamePlan('${e.id}')">Game Plan</button>
                <button class="mini-btn" onclick="exportEventReport('${e.id}')">Export Report</button>
                <button class="mini-btn" onclick="editEvent('${e.id}')">Edit</button>
                <button class="mini-btn btn-danger" onclick="deleteEvent('${e.id}')">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join("") : `<div class="empty">No special events yet. Click + Add Event to create your next youth event.</div>`;

      renderEventReport();
    }

    window.selectEventReport = function(id){
      $("eventReportSelect").value = id;
      renderEventReport();
      openPageByName("events");
    };

    window.renderEventReport = function(){
      if(!$("eventReportStats")) return;

      const id = $("eventReportSelect").value || events[0]?.id || "";
      const eventObj = events.find(e=>e.id===id);

      if(!eventObj){
        $("eventReportStats").innerHTML = `<div class="empty">Create an event to see reports.</div>`;
        $("eventAbsentList").innerHTML = "";
        return;
      }

      const stats = eventStats(eventObj);

      $("eventReportStats").innerHTML = `
        <div class="event-report-box"><p>Total People</p><h3>${stats.total}</h3></div>
        <div class="event-report-box"><p>Came</p><h3>${stats.came}</h3></div>
        <div class="event-report-box"><p>Did Not Come</p><h3>${stats.didntCome}</h3></div>
        <div class="event-report-box"><p>Not Marked</p><h3>${stats.notMarked}</h3></div>
      `;

      const didnt = youthMembers.filter(m=>{
        const s = stats.map.get(m.id);
        return s === "Absent" || !s;
      });

      $("eventAbsentList").innerHTML = didnt.length ? didnt.map(m=>{
        const s = stats.map.get(m.id) || "Not Marked";
        return `
          <div class="list-item">
            <div class="person">
              <div class="avatar">${initials(m.name)}</div>
              <div><h4>${clean(m.name)}</h4><p>${clean(m.contactNumber||"No phone")} • ${clean(m.team||m.ministry||"No team")} • ${clean(m.cellLeader||"No leader")}</p></div>
            </div>
            <span class="pill status-${roleKey(s)}">${clean(s)}</span>
          </div>
        `;
      }).join("") : `<div class="empty">Everyone is marked as came for this event.</div>`;
    };

    window.exportSelectedEventReport = function(){
      const id = $("eventReportSelect")?.value || selectedEventId || events.filter(isSpecialEvent)[0]?.id || events[0]?.id || "";
      const eventObj = events.find(e=>e.id===id);
      if(!eventObj) return notify("Select an event first.");

      const stats = eventStats(eventObj);
      const rows = youthMembers.map(m=>({
        eventTitle:eventObj.title,
        eventDate:eventObj.date || "",
        name:m.name || "",
        contactNumber:m.contactNumber || "",
        team:m.team || m.ministry || "",
        cellLeader:m.cellLeader || "",
        status:stats.map.get(m.id) || "Not Marked"
      }));

      const keys = Object.keys(rows[0] || {});
      const csv = [keys.join(","), ...rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], {type:"text/csv"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(eventObj.title||"event").replace(/[^a-z0-9]/gi,"-").toLowerCase()}-attendance-report.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    };



    function nextSunday(fromDate){
      const d = new Date(fromDate);
      d.setHours(0,0,0,0);
      const day = d.getDay();
      const diff = (7 - day) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d;
    }

    function isoDate(d){
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }

    window.generateSundayServices = async function(count=12){
      if(!canManage()) return notify("Only Admin or Core Moderator can generate Sunday services.");
      const venue = $("sundayVenue")?.value?.trim() || "Church";
      const time = $("sundayTime")?.value || "17:30";
      let d = nextSunday(new Date());
      let created = 0;

      for(let i=0;i<count;i++){
        const date = isoDate(d);
        const exists = events.some(e=>isSundayEvent(e) && e.date === date);
        if(!exists){
          await addDoc(collection(db,"events"), {
            eventType:"Sunday Service",
            title:"Sunday Service",
            date,
            time,
            location:venue,
            owner:"Youth Central",
            expectedCount:0,
            description:"Weekly Sunday service attendance tracking.",
            flyerURL:"",
            flyerData:"",
            registrationLink:"",
            sheetLink:"",
            status:"Upcoming",
            createdBy:currentProfile?.name || currentUser?.email || "Team",
            createdAt:serverTimestamp(),
            updatedAt:serverTimestamp()
          });
          created++;
        }
        d.setDate(d.getDate()+7);
      }

      notify(`Generated ${created} Sunday service events`);
    };

    function renderSundayEvents(){
      if(!$("sundayEventsList")) return;
      const sundayEvents = events.filter(isSundayEvent).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
      $("sundayEventsList").innerHTML = sundayEvents.length ? sundayEvents.map(e=>{
        const stats = eventStats(e);
        return `
          <div class="sunday-card">
            <div>
              <h4>${clean(e.title)} • ${clean(e.date||"No date")}</h4>
              <p>${clean(e.time||"")} • ${clean(e.location||"No venue")} • ${stats.came} came • ${stats.didntCome} did not come</p>
            </div>
            <div class="task-actions">
              <button class="mini-btn btn-purple" onclick="openEventDetail('${e.id}')">View Details</button>
              <button class="mini-btn" onclick="editEvent('${e.id}')">Edit</button>
              <button class="mini-btn btn-danger" onclick="deleteEvent('${e.id}')">Delete</button>
            </div>
          </div>
        `;
      }).join("") : `<div class="empty">No Sunday events yet. Click Generate Sundays to create them automatically.</div>`;
    }


    function renderAttendance(){
      const selected = $("attendanceEventSelect")?.value || "";
      let records = attendance.slice();
      if(selected){
        const eventObj = events.find(e=>e.id===selected);
        records = records.filter(a =>
          (a.eventId && a.eventId === selected) ||
          (eventObj && !a.eventId && a.eventName === eventObj.title && a.date === eventObj.date)
        );
      }
      $("attendanceList").innerHTML=records.slice(0,80).map(a=>`
        <div class="list-item">
          <div><h4>${clean(a.memberName)}</h4><p>${clean(a.eventName)} • ${clean(a.date)} • ${clean(a.team||"No team")} • <span class="pill status-${roleKey(a.status)}">${clean(a.status)}</span></p></div>
          <button class="mini-btn btn-danger" onclick="deleteAttendance('${a.id}')">Delete</button>
        </div>
      `).join("")||`<div class="empty">No attendance yet${selected ? " for this selected event" : ""}.</div>`;
    }

    function renderTeams(){
      const teams={};
      youthMembers.forEach(m=>{
        const k=m.team||m.ministry||"No Team";
        if(!teams[k]) teams[k]=[];
        teams[k].push(m);
      });

      $("teamsList").innerHTML=Object.entries(teams).sort((a,b)=>b[1].length-a[1].length).map(([team,items])=>`
        <div class="list-item">
          <div>
            <h4>${clean(team)}</h4>
            <p>${items.length} people • Heads: ${clean(userProfiles.filter(u=>u.team===team&&["Team Head","Team Lead"].includes(u.role)).map(u=>u.name).join(", ")||"Not assigned")}</p>
          </div>
          <div class="task-actions">
            <button class="mini-btn" onclick="renameTeam('${encodeURIComponent(team)}')">Rename</button>
            <button class="mini-btn btn-danger" onclick="deleteTeam('${encodeURIComponent(team)}')">Delete</button>
          </div>
        </div>
      `).join("")||`<div class="empty">No teams yet. Add team names inside a person profile.</div>`;

      $("cellLeadersList").innerHTML=cellLeaders.map(l=>`
        <div class="list-item">
          <div><h4>${clean(l.name)}</h4><p>${clean(l.contactNumber||"No phone")}</p></div>
          <button class="mini-btn btn-danger" onclick="deleteCellLeader('${l.id}')">Delete</button>
        </div>
      `).join("")||`<div class="empty">No leaders yet.</div>`;

      $("cellGroupsList").innerHTML=cellGroups.map(c=>`
        <div class="list-item">
          <div><h4>${clean(c.cellGroupName)}</h4><p>Lead: ${clean(c.leader||"")} • ${Array.isArray(c.members)?c.members.length:0} imported members</p></div>
          <button class="mini-btn btn-danger" onclick="deleteCellGroup('${c.id}')">Delete</button>
        </div>
      `).join("")||`<div class="empty">No cell groups yet.</div>`;
    }

    function renderFollowUps(){
      $("followupList").innerHTML=followUps.map(f=>`
        <div class="list-item">
          <div><h4>${clean(f.memberName)}</h4><p>${clean(f.reason)} • Assigned: ${clean(f.assignedTo)} • <span class="pill status-${roleKey(f.status)}">${clean(f.status)}</span></p><p>${clean(f.contactNumber)}</p></div>
          <div class="task-actions">
            <button class="mini-btn btn-green" onclick="completeFollowUp('${f.id}','${f.memberId||""}')">Complete</button>
            <button class="mini-btn btn-danger" onclick="deleteFollowUp('${f.id}')">Delete</button>
          </div>
        </div>
      `).join("")||`<div class="empty">No follow-ups yet.</div>`;
    }

    function renderReports(){
      const missing=youthMembers.filter(isMissing);
      const newcomers=youthMembers.filter(m=>m.memberType==="Newcomer");
      const presentRecords=attendance.filter(a=>["Present","Late","Newcomer"].includes(a.status));
      const uniqueThisMonth=new Set(presentRecords.filter(a=>String(a.date||"").startsWith(new Date().toISOString().slice(0,7))).map(a=>a.memberId)).size;
      const completedFollowups=followUps.filter(f=>f.status==="Completed").length;
      const pendingFollowups=followUps.filter(f=>f.status!=="Completed").length;

      if($("analyticsStats")) $("analyticsStats").innerHTML = `
        <div class="analytics-kpi"><p>Total People</p><h3>${youthMembers.length}</h3></div>
        <div class="analytics-kpi"><p>This Month Active</p><h3>${uniqueThisMonth}</h3></div>
        <div class="analytics-kpi"><p>Newcomers</p><h3>${newcomers.length}</h3></div>
        <div class="analytics-kpi"><p>Care List</p><h3>${missing.length}</h3></div>
      `;

      const weeks=[];
      const now=new Date();
      for(let i=7;i>=0;i--){
        const start=new Date(now); start.setDate(now.getDate() - (i*7)); start.setHours(0,0,0,0);
        const end=new Date(start); end.setDate(start.getDate()+7);
        const count=presentRecords.filter(a=>{const d=new Date(a.date);return d>=start && d<end;}).length;
        weeks.push({label:`W${8-i}`,count});
      }
      const maxWeek=Math.max(1,...weeks.map(w=>w.count));
      if($("attendanceTrendChart")) $("attendanceTrendChart").innerHTML=weeks.map(w=>`<div class="chart-bar-wrap"><div class="chart-bar" style="--h:${Math.max(4,Math.round((w.count/maxWeek)*100))}%"></div><span>${w.label}<br>${w.count}</span></div>`).join("");

      const teamCounts={};
      youthMembers.forEach(m=>{const k=m.team||m.ministry||"No Team";teamCounts[k]=(teamCounts[k]||0)+1;});
      const teamRows=Object.entries(teamCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
      const maxTeam=Math.max(1,...teamRows.map(x=>x[1]));
      if($("teamAnalyticsChart")) $("teamAnalyticsChart").innerHTML=teamRows.map(([name,count])=>`<div class="chart-list-row"><div><b>${clean(name)}</b><div class="mini-progress"><i style="--w:${Math.round((count/maxTeam)*100)}%"></i></div></div><strong>${count}</strong></div>`).join("")||`<div class="empty">No team data yet.</div>`;

      const eventRows=events.filter(isSpecialEvent).map(e=>({event:e,stats:eventStats(e)})).sort((a,b)=>String(b.event.date||"").localeCompare(String(a.event.date||""))).slice(0,6);
      const maxEvent=Math.max(1,...eventRows.map(x=>x.stats.came));
      if($("eventAnalyticsChart")) $("eventAnalyticsChart").innerHTML=eventRows.map(x=>`<div class="chart-list-row"><div><b>${clean(x.event.title)}</b><p>${clean(x.event.date||"")} • ${x.stats.came} came / ${x.stats.total} total</p><div class="mini-progress"><i style="--w:${Math.round((x.stats.came/maxEvent)*100)}%"></i></div></div><strong>${x.stats.came}</strong></div>`).join("")||`<div class="empty">No event analytics yet.</div>`;

      const totalFollow=Math.max(1,completedFollowups+pendingFollowups);
      if($("followupAnalyticsChart")) $("followupAnalyticsChart").innerHTML=`
        <div class="chart-list-row"><div><b>Pending Follow-ups</b><div class="mini-progress"><i style="--w:${Math.round((pendingFollowups/totalFollow)*100)}%"></i></div></div><strong>${pendingFollowups}</strong></div>
        <div class="chart-list-row"><div><b>Completed Follow-ups</b><div class="mini-progress"><i style="--w:${Math.round((completedFollowups/totalFollow)*100)}%"></i></div></div><strong>${completedFollowups}</strong></div>
        <div class="chart-list-row"><div><b>Open Tasks</b><div class="mini-progress"><i style="--w:${Math.min(100,tasks.filter(t=>t.status!=="completed").length*10)}%"></i></div></div><strong>${tasks.filter(t=>t.status!=="completed").length}</strong></div>
      `;

      $("missingReport").innerHTML=missing.map(m=>`<div class="list-item"><div><h4>${clean(m.name)}</h4><p>${clean(m.contactNumber)} • Last: ${clean(m.lastAttendedDate||"Never")} • ${clean(m.cellLeader||"No leader")}</p></div><div class="quick-action-row"><button class="mini-btn follow-link" onclick="createFollowUp('${m.id}')">Follow Up</button>${m.contactNumber?`<a class="btn mini-btn call-link" href="tel:${clean(String(m.contactNumber).replace(/[^0-9+]/g,""))}">Call</a>`:""}</div></div>`).join("")||`<div class="empty">No one missing.</div>`;
      $("newcomerReport").innerHTML=newcomers.map(m=>`<div class="list-item"><div><h4>${clean(m.name)}</h4><p>${clean(m.contactNumber)} • First visit: ${clean(m.firstVisitDate||"")}</p></div></div>`).join("")||`<div class="empty">No newcomers.</div>`;
    }

    function taskCard(t){return `<div class="task"><h4>${clean(t.title)}</h4><p>${clean(t.team||"General")} • ${clean(t.owner||"Unassigned")} • ${clean(t.priority||"Normal")} • Due ${clean(t.due||"")}</p><p>${clean(t.notes||"")}</p><div class="task-actions"><button class="mini-btn" onclick="moveTask('${t.id}','todo')">To Do</button><button class="mini-btn btn-yellow" onclick="moveTask('${t.id}','progress')">Progress</button><button class="mini-btn btn-green" onclick="moveTask('${t.id}','completed')">Done</button><button class="mini-btn btn-danger" onclick="deleteTask('${t.id}')">Delete</button></div></div>`}
    function renderTasks(){$("todoTasks").innerHTML=tasks.filter(t=>t.status==="todo").map(taskCard).join("")||`<div class="empty">No tasks</div>`;$("progressTasks").innerHTML=tasks.filter(t=>t.status==="progress").map(taskCard).join("")||`<div class="empty">No tasks</div>`;$("completedTasks").innerHTML=tasks.filter(t=>t.status==="completed").map(taskCard).join("")||`<div class="empty">No tasks</div>`}

    function renderUsers(){
      updateAdminToolsVisibility();
      if(!$("accessWarning") || !$("usersTable")) return;
      $("accessWarning").classList.toggle("hidden",canAdmin());
      $("usersTable").innerHTML=userProfiles.map(u=>`<tr><td><div class="person"><div class="profile-mini-photo">${avatarHTML(u,u.name||u.email)}</div><b>${clean(u.name||"User")}</b></div></td><td>${clean(u.email)}</td><td><select id="role-${u.uid||u.id}" ${canAdmin()?"":"disabled"}>${ROLES.map(r=>`<option ${u.role===r?"selected":""}>${r}</option>`).join("")}</select></td><td><input id="team-${u.uid||u.id}" value="${clean(u.team||"")}" placeholder="Team" ${canAdmin()?"":"disabled"}></td><td><select id="ustatus-${u.uid||u.id}" ${canAdmin()?"":"disabled"}><option ${u.status==="Active"?"selected":""}>Active</option><option ${u.status==="Disabled"?"selected":""}>Disabled</option></select></td><td><button class="mini-btn" onclick="updateUserRole('${u.uid||u.id}')">Save</button></td></tr>`).join("")||`<tr><td colspan="6">No users yet.</td></tr>`;
    }

    function renderNotifications(){$("notificationList").innerHTML=notifications.slice(0,8).map(n=>`<div class="list-item"><div><h4>${clean(n.title)}</h4><p>${clean(n.body)} • ${clean(n.team||"All")} • By ${clean(n.createdBy||"Team")}</p></div></div>`).join("")||`<div class="empty">No notifications yet.</div>`}

    function toDocArray(snap){
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    }

    async function fetchCollectionFresh(name){
      try{ return await getDocsFromServer(collection(db,name)); }
      catch(err){ console.warn("Server tournament fetch failed, using normal Firestore fetch for", name, err); return await getDocs(collection(db,name)); }
    }

    async function refreshTournamentLiveSync(silent=false){
      try{
        const [teamSnap, matchSnap, settingsSnap] = await Promise.all([
          fetchCollectionFresh("tournamentTeams"),
          fetchCollectionFresh("tournamentMatches"),
          fetchCollectionFresh("tournamentSettings")
        ]);
        tournamentTeams = toDocArray(teamSnap);
        tournamentMatches = toDocArray(matchSnap);
        tournamentSettingsList = toDocArray(settingsSnap);
        renderTournament();
        render();
      }catch(err){
        console.error("5-second tournament sync failed", err);
        if(!silent) notify("Live sync issue. Check Firebase rules for tournament collections.");
      }
    }

    let tournamentPollTimer = null;
    function startTournamentLivePolling(){
      if(tournamentPollTimer) return;
      refreshTournamentLiveSync(true);
      tournamentPollTimer = setInterval(()=>refreshTournamentLiveSync(true), 5000);
    }

    function listen(name,assign,sort=false){
      const col=collection(db,name), q=sort?query(col,orderBy("createdAt","desc")):col;
      onSnapshot(q,snap=>{
        assign(snap.docs.map(d=>({id:d.id,...d.data()})));
        if(["tournamentTeams","tournamentMatches","tournamentSettings","events"].includes(name)) renderTournament();
        render();
      },err=>{console.error(err);notify("Firestore issue. Check Authentication and Rules.")});
    }

    function startListeners(){
      if(listenersStarted)return; listenersStarted=true;
      listen("youthMembers",d=>youthMembers=d);listen("cellLeaders",d=>cellLeaders=d);listen("cellGroups",d=>cellGroups=d);listen("attendance",d=>attendance=d);listen("followUps",d=>followUps=d);listen("userProfiles",d=>{userProfiles=d; if(currentUser){const me=d.find(u=>(u.uid||u.id)===currentUser.uid); if(me){currentProfile=me; $("currentUserLabel").textContent=`${currentProfile.name || currentUser.email} • ${currentProfile.role}`; updateProfileUI();}}});listen("notifications",d=>notifications=d);listen("events",d=>events=d);listen("tournamentTeams",d=>tournamentTeams=d);listen("tournamentMatches",d=>tournamentMatches=d);listen("tournamentSettings",d=>tournamentSettingsList=d,false);startTournamentLivePolling();
      const qTasks=query(collection(db,"tasks"),orderBy("createdAt","desc"));
      onSnapshot(qTasks,snap=>{
        const newTasks=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(taskInitialLoaded){newTasks.forEach(t=>{if(!seenTaskIds.has(t.id)){notify(`New task: ${t.title}`);browserAlert("Youth Central Task",t.title||"New task added")}})}
        newTasks.forEach(t=>seenTaskIds.add(t.id)); taskInitialLoaded=true; tasks=newTasks; render();
      },err=>{console.error(err);notify("Task listener issue.")});
    }
  