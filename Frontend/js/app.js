const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let currentRole="atc", zoom=100, aircraftTimer, toastTimer;
const activities=[
  ["AI-101 entered Sector B","10:42:18"],
  ["Route calculated: DEL → W1 → W3 → BOM","10:41:54"],
  ["Weather data refreshed","10:41:20"],
  ["AI-999 marked emergency priority","10:40:52"],
  ["Conflict prediction generated for AI-101 / AI-205","10:40:11"],
  ["AI-450 reached waypoint W2","10:39:46"]
];
const flights=[
  ["AI-101","Delhi → Mumbai","Airbus A320","30,000 ft","450 km/h","ON ROUTE","Normal"],
  ["AI-205","Bengaluru → Delhi","Boeing 737","29,000 ft","430 km/h","CONFLICT","Normal"],
  ["AI-999","Delhi → Jaipur","Airbus A320","31,000 ft","470 km/h","EMERGENCY","Emergency"],
  ["AI-450","Mumbai → Delhi","A320neo","32,000 ft","455 km/h","ON ROUTE","Medical"],
  ["AI-310","Kolkata → Delhi","B737 MAX","28,000 ft","420 km/h","ON ROUTE","Normal"],
  ["AI-411","Hyderabad → Mumbai","A321","27,000 ft","440 km/h","ON ROUTE","Normal"]
];

function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}
function clock(){
  const d=new Date(); $("#clock").textContent=d.toLocaleTimeString("en-IN",{hour12:false});
}
setInterval(clock,1000);clock();

function login(){
  currentRole=$("#roleSelect").value;
  $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");
  $("#atcNav").classList.toggle("hidden",currentRole!=="atc");
  $("#userNav").classList.toggle("hidden",currentRole==="atc");
  $("#roleName").textContent=currentRole==="atc"?"ATC Controller":"Flight User";
  $("#roleSub").textContent=currentRole==="atc"?"Control Room":"AI-102 · Passenger View";
  if(currentRole==="atc") showPage("dashboard"); else showPage("user-dashboard");
  renderActivity(); renderFlights(); renderConflicts(); renderBars();
  startAircraft();
  toast(`Welcome to AeroGuard · ${currentRole==="atc"?"ATC Control":"User Dashboard"}`);
}
$("#loginBtn").onclick=login;
$("#loginPassword").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
$("#logoutBtn").onclick=()=>{stopAircraft();$("#app").classList.add("hidden");$("#loginScreen").classList.remove("hidden")};

$$(".nav-btn").forEach(btn=>btn.onclick=()=>showPage(btn.dataset.page));
function showPage(page){
  $$(".page").forEach(p=>p.classList.remove("active-page"));
  const target=$("#page-"+page); if(!target)return;
  target.classList.add("active-page");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const names={
    dashboard:["ATC Dashboard","Airspace Control Center"],flights:["Flights","Flight Management"],routes:["Route Planner","Route Optimization"],
    conflicts:["Conflicts","Conflict Management"],weather:["Weather","Weather Intelligence"],priority:["Priority Queue","Priority Management"],
    analytics:["Analytics","System Analytics"],"user-dashboard":["My Flight","Flight Dashboard"],"user-route":["My Route","Route Information"],"user-weather":["Weather","Weather Along Route"]
  };
  $("#pageTitle").textContent=names[page][0];$("#headerTitle").textContent=names[page][1];
}

function renderActivity(){
  $("#activityList").innerHTML=activities.slice(0,6).map((a,i)=>`<div class="activity"><b>${i===0?"✈":"•"} ${a[0]}</b><time>${a[1]}</time></div>`).join("");
}
$("#clearActivity").onclick=()=>{$("#activityList").innerHTML=`<div class="activity">Activity log cleared.<time>now</time></div>`};

function renderFlights(){
  $("#flightTable").innerHTML=flights.map((f,i)=>`<tr>
    <td><b>${f[0]}</b></td><td>${f[1]}</td><td>${f[2]}</td><td>${f[3]}</td><td>${f[4]}</td>
    <td><span class="table-status" style="${f[5]==="CONFLICT"?"background:#4a2029;color:#ff7f89":f[5]==="EMERGENCY"?"background:#49351c;color:#ffd76b":""}">${f[5]}</span></td>
    <td>${f[6]}</td><td><button class="secondary-btn flight-view" data-i="${i}">View</button></td>
  </tr>`).join("");
  $$(".flight-view").forEach(b=>b.onclick=()=>toast(`Selected ${flights[b.dataset.i][0]} · ${flights[b.dataset.i][1]}`));
}
function renderConflicts(){
  $("#conflictCards").innerHTML=`<div class="conflict-card" id="mainConflict">
    <span class="risk">● HIGH RISK · ACTIVE</span><h3>AI-101 ↔ AI-205</h3>
    <p>Predicted separation is below the configured safe threshold in Sector B.</p>
    <div class="conflict-meta"><span>Separation: <b>2.1 NM</b></span><span>Time: <b>38 sec</b></span><span>Altitude: <b>1,000 ft</b></span></div>
    <button class="warning-btn" data-resolution="altitude">Resolve: Change Altitude</button>
    <button class="secondary-btn" data-resolution="speed">Change Speed</button>
    <button class="secondary-btn" data-resolution="route">Change Route</button>
  </div>
  <div class="conflict-card" style="border-color:#204839"><span style="color:var(--green)">● RESOLVED</span><h3>AI-450 ↔ AI-310</h3><p>Route adjustment successfully increased separation.</p><div class="conflict-meta"><span>Resolution: <b>Route change</b></span><span>Saved: <b>4 min</b></span></div></div>`;
  $$("[data-resolution]").forEach(b=>b.onclick=()=>resolveConflict(b.dataset.resolution));
}
function resolveConflict(type){
  const labels={altitude:"Altitude changed to 31,000 ft",speed:"Speed reduced to 410 km/h",route:"Alternative route assigned via W4"};
  $("#conflictRing").classList.add("resolved"); $("#conflictRing").innerHTML="<span>✓</span>";
  $("#conflictCount").textContent="0"; $("#navConflictBadge").textContent="0";
  $(".alert-panel .alert-box").innerHTML=`<div class="alert-icon" style="background:#164638;color:#61e6b5">✓</div><div><strong>Conflict Resolved</strong><p>${labels[type]}.</p><small>Safe separation restored.</small></div>`;
  activities.unshift([`Conflict resolved · ${labels[type]}`,new Date().toLocaleTimeString("en-IN",{hour12:false})]);renderActivity();
  toast("Conflict resolved successfully");
  setTimeout(()=>{ $("#conflictRing").classList.remove("resolved");$("#conflictRing").innerHTML="<span>⚠</span>"; },5000);
}
function startAircraft(){
  stopAircraft();
  const planes=[[".ac1",[[25,49],[32,44],[39,47],[47,38],[57,32]]],[".ac2",[[47,57],[43,53],[39,49],[34,44],[30,39]]],[".ac3",[[66,35],[70,31],[75,27],[81,23]]],[".ac4",[[77,63],[72,58],[67,53],[61,49]]]];
  let step=0;
  aircraftTimer=setInterval(()=>{
    step=(step+1)%8;
    planes.forEach(([sel,pts])=>{const el=$(sel),p=pts[step%pts.length];el.style.left=p[0]+"%";el.style.top=p[1]+"%";});
  },2200);
}
function stopAircraft(){clearInterval(aircraftTimer)}
$("#zoomIn").onclick=()=>{zoom=Math.min(140,zoom+10);$("#zoomLabel").textContent=zoom+"%";$("#airspaceMap").style.transform=`scale(${zoom/100})`;};
$("#zoomOut").onclick=()=>{zoom=Math.max(80,zoom-10);$("#zoomLabel").textContent=zoom+"%";$("#airspaceMap").style.transform=`scale(${zoom/100})`;};
$("#resetMap").onclick=()=>{zoom=100;$("#zoomLabel").textContent="100%";$("#airspaceMap").style.transform="scale(1)"};

$("#calculateRoute").onclick=()=>{
  const src=$("#routeSource").value.split(" ")[0],dst=$("#routeDestination").value.split(" ")[0];
  const emergency=$("#routePriority").value!=="Normal";
  const path=src==="Delhi"&&dst==="Mumbai"?["DEL","W1","W3","BOM"]:src==="Mumbai"&&dst==="Delhi"?["BOM","W3","W1","DEL"]:["SRC","W2","W4","DST"];
  $("#routePath").innerHTML=path.map((x,i)=>`<span>${x}</span>${i<path.length-1?"<i></i>":""}`).join("");
  $("#routeScore").textContent=emergency?"91/100":"94/100";$("#routeStatus").textContent="Dijkstra completed · minimum-cost route selected";
  $("#routeDistance").textContent=emergency?"1,102 km":"1,145 km";$("#routeTime").textContent=emergency?"2h 21m":"2h 32m";$("#routeFuel").textContent=emergency?"4,050 L":"4,200 L";$("#routeRisk").textContent="Low";
  activities.unshift([`Dijkstra route calculated · ${src} → ${dst}`,new Date().toLocaleTimeString("en-IN",{hour12:false})]);renderActivity();toast("Minimum-cost route calculated");
};
$("#refreshWeather").onclick=()=>{toast("Weather data refreshed");};
function renderBars(){
  const vals=[42,58,47,76,62,84,68,91,73,82,55,70];
  $("#barChart").innerHTML=vals.map((v,i)=>`<div class="bar" style="height:${v}%"><span>${i+1}h</span></div>`).join("");
}
$("#addFlightBtn").onclick=()=>$("#flightModal").classList.remove("hidden");
$("#closeModal").onclick=()=>$("#flightModal").classList.add("hidden");
$("#saveFlight").onclick=()=>{
  const id=$("#newFlightId").value.trim()||"AI-"+Math.floor(100+Math.random()*899);
  const src=$("#newSource").value||"Delhi",dst=$("#newDestination").value||"Mumbai",pri=$("#newPriority").value;
  flights.push([id,`${src} → ${dst}`,"A320","30,000 ft","440 km/h",pri==="Emergency"?"EMERGENCY":"ON ROUTE",pri]);
  renderFlights();$("#flightModal").classList.add("hidden");$("#activeFlights").textContent=String(12+flights.length-6);
  activities.unshift([`${id} added to airspace`,new Date().toLocaleTimeString("en-IN",{hour12:false})]);renderActivity();toast(`${id} added successfully`);
};
