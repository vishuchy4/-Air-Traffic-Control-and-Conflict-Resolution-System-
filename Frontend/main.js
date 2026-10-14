// main.js : screens, tabs, flying planes.
// Step 1: the form.  Step 2: route options appear.  Step 3: the flight starts.

let flights = [];             // planes that have started
let nextId = 1;               // AG001, AG002, ...
let chosenType = 'Passenger';
let plan = null;              // route found but not started yet
let selectedId = null;        // plane shown in the Flight tab
let tab = 'flights';          // which tab is open: 'flights' or 'safety'
let screen = 'plan';          // the page on screen: plan, details, radar, weather or log
let paused = false;
let speedX = 1;               // 1x, 2x, 4x
let controlledId = null;      // plane the controller changes in a conflict
let logLines = [];
let mouseDown = false;

const SECONDS_PER_FLIGHT_HOUR = 120;   // 1 hour of flying = 120 seconds on screen (at 1x)

// ---------- small helpers ----------
const $ = id => document.getElementById(id);
const name = i => cities[i].name;
const kmText = n => Math.round(n).toLocaleString('en-IN') + ' km';
const rupees = n => '₹' + Math.round(n).toLocaleString('en-IN');
function timeText(hours) {
  const m = Math.round(hours * 60);
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
function routeKm(route) {
  let km = 0;
  for (let i = 0; i < route.length - 1; i++) km += edgeBetween(route[i], route[i + 1]).distance;
  return km;
}
function kmLeft(plane) {
  if (plane.status !== 'flying') return 0;
  let km = 0;
  for (let i = plane.leg; i < plane.route.length - 1; i++) {
    const road = edgeBetween(plane.route[i], plane.route[i + 1]).distance;
    km += (i === plane.leg) ? road * (1 - plane.progress) : road;
  }
  return km;
}
function viaText(route) {
  return route.length > 2 ? 'via ' + route.slice(1, -1).map(name).join(', ') : 'direct';
}
// Puts HTML into an element only if it changed (so buttons are not rebuilt for nothing, and clicks never get lost).
function setHTML(id, html) {
  const el = $(id);
  const typing = document.activeElement && el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
  if (typing) return;                                  // never rebuild a box while the user is typing or choosing in it
  if (el.lastHTML !== html) { el.innerHTML = html; el.lastHTML = html; }
}
// ---------- FORMATTING HELPERS ----------
// Flight IDs (AG001) in bold inside a sentence.
function highlight(text) {
  return text.replace(/\b(AG\d{3})\b/g, '<b>$1</b>');
}
// A weather line with the city name in bold: "⛅ <b>Delhi</b>: Partly cloudy, 31°C ..."
function weatherLineHTML(i) {
  return weatherLine(i).replace(cities[i].name + ':', '<b>' + cities[i].name + '</b>:');
}

function addLog(text) {
  // the time on the flight clock (the same clock as in the header)
  let time;
  try { time = clockText(simMinutes); }
  catch (error) { const d = new Date(); time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }   // at the very start
  logLines.unshift(time + '  ' + text);
  if (logLines.length > 30) logLines.pop();
}

// ---------- STEP 1: the form ----------
function fillForm() {
  const options = CITIES.map(c => c[0]).sort().map(n => '<option value="' + n + '">' + n + '</option>').join('');
  $('fromSel').innerHTML = '<option value="">Choose city</option>' + options;
  $('cityNames').innerHTML = CITIES.map(c => '<option value="' + c[0] + '">').join('');
   // suggestions for the weather search
  $('toSel').innerHTML = '<option value="">Choose city</option>' + options;
  makeTypeButtons();
  fillOperators();
  $('airlineSel').onchange = fillPlanes;
  $('planeSel').onchange = updateLoadBox;      // capacity and load depend on the aircraft
  $('fromSel').onchange = () => { fillPlanes(); showPanels(); };   // the aircraft list depends on the two cities
  $('toSel').onchange = () => { fillPlanes(); showPanels(); };
  $('reasonSel').innerHTML = '<option value="">Choose reason</option>' + MEDICAL_REASONS.map(r => '<option>' + r + '</option>').join('');
  $('fuelPrice').textContent = 'ATF ₹' + ATF_PRICE_PER_LITRE + '/L (' + ATF_PRICE_DATE + ')';
}
function makeTypeButtons() {
  $('typeButtons').innerHTML = Object.keys(TYPES).map(t =>
    '<button class="type' + (t === chosenType ? ' on' : '') + '" style="--c:' + TYPES[t].color + '" title="Priority ' + TYPES[t].priority +
    ', flies near ' + TYPES[t].altitude + ' ft" onclick="chooseType(\'' + t + '\')">' + t + '</button>').join('');
}
function chooseType(t) { chosenType = t; makeTypeButtons(); fillOperators(); }

// Airline list for the chosen flight type, plane list for the chosen airline, reason only for Medical.
function fillOperators() {
  $('airlineSel').innerHTML = Object.keys(OPERATORS[chosenType]).map(n => '<option>' + n + '</option>').join('');
  fillPlanes();
  $('reasonBox').classList.toggle('hidden', chosenType !== 'Medical');
}
function fillPlanes() {
  const from = $('fromSel').value, to = $('toSel').value;
  const bothMacro = from && to && cities[cityIndex(from)].macro && cities[cityIndex(to)].macro;
  const all = OPERATORS[chosenType][$('airlineSel').value];
  const usable = all.filter(p => bothMacro || !BIG_JETS.includes(p));     // big jets only between two hub airports
  const old = $('planeSel').value;
  $('planeSel').innerHTML = usable.map(n => '<option>' + n + '</option>').join('');
  if (usable.includes(old)) $('planeSel').value = old;
  const hidden = all.filter(p => !usable.includes(p));
  $('bigJetNote').innerHTML = hidden.length ? hidden.map(h => '<b>' + h + '</b>').join(' and ') +
    (hidden.length > 1 ? ' are big jets and need' : ' is a big jet and needs') + ' <b>two hub airports</b>.' : '';
  updateLoadBox();
}

// Passenger flight: how many people. Cargo flight: how many tonnes. Others: only the capacity is shown.
function updateLoadBox() {
  const aircraft = $('planeSel').value, info = AIRCRAFT_INFO[aircraft];
  $('capacityNote').innerHTML = info ? '<b>' + aircraft + '</b>: <b>' + capacityText(aircraft) + '</b>. ' + info.note + '.' : '';
  const kind = chosenType === 'Passenger' ? 'people' : chosenType === 'Cargo' ? 'cargo' : '';
  $('loadBox').classList.toggle('hidden', !kind || !info);
  if (!kind || !info) return;
  const max = kind === 'people' ? info.seats : info.cargo;
  $('loadLabel').textContent = kind === 'people' ? 'Passengers on board (max ' + max + ')' : 'Cargo in tonnes (max ' + max + ')';
  $('loadInput').max = max;
  $('loadInput').step = kind === 'people' ? 1 : 0.5;
  if ($('loadInput').dataset.kind !== kind + max) {                 // a new aircraft: suggest a normal load
    $('loadInput').value = kind === 'people' ? Math.round(max * 0.85) : Math.round(max * 0.8);
    $('loadInput').dataset.kind = kind + max;
  }
}
// "IndiGo · Airbus A320neo" (and the reason for a Medical flight)
function whoText(x) {
  return x.airline + ' · ' + x.plane + (x.reason ? ' · Reason: ' + x.reason : '');
}
// ---------- PAGES ----------
// Each page has its own address (#/plan, #/details, #/radar, #/weather, #/log), so the browser's Back button works.
// The planes keep flying whatever page is open.
const PAGES = { plan: 'pagePlan', details: 'pageDetails', radar: 'mapScreen', board: 'pageBoard', weather: 'pageWeather', log: 'pageLog' };

function showPage() {
  let page = location.hash.replace('#/', '') || 'plan';
  if (!PAGES[page]) page = 'plan';
  if (page === 'details' && !citiesChosen()) page = 'plan';     // flight details need From and To first
  screen = page;
  Object.keys(PAGES).forEach(p => $(PAGES[p]).classList.toggle('hidden', p !== page));
  document.querySelectorAll('.mainNav a').forEach(a => a.classList.toggle('on', a.id === 'nav-' + (page === 'details' ? 'plan' : page)));
  window.scrollTo(0, 0);
  showPanels();
}
function go(page) {
  location.hash = '#/' + page;
  showPage();
}
window.addEventListener('hashchange', showPage);

// old names, still used in many places
function goHome() { go('plan'); }
function openRadar() { go('radar'); }
function openWeather() { go('weather'); }
function openDrawer(what) { go(what); }

// ---------- STEP 1 -> STEP 2 ----------
function citiesChosen() {
  return $('fromSel').value && $('toSel').value && $('fromSel').value !== $('toSel').value;
}
function nextStep() {
  if (!$('fromSel').value || !$('toSel').value) { alert('Please choose From and To.'); return; }
  if ($('fromSel').value === $('toSel').value) { alert('From and To must be different cities.'); return; }
  fillPlanes();
  go('details');
}

// What the plan page and the details page show about the two chosen cities.
function showPlanPages() {
  const from = $('fromSel').value, to = $('toSel').value;
  const line = n => '<div class="note"><b>' + n + '</b> · ' + cityType(cityIndex(n)) + ' · ' +
    weatherLine(cityIndex(n)).replace(' ' + n + ':', '').replace(n + ':', '').trim() + '</div>';
  $('cityInfo').innerHTML = (from ? line(from) : '') + (to && to !== from ? line(to) : '');
  if (from && to) {
    $('detailsSub').innerHTML = '<b>' + from + '</b>: ' + cityType(cityIndex(from)) + ' &nbsp;→&nbsp; <b>' + to + '</b>: ' + cityType(cityIndex(to));
  }
}

// One log line: the time, then the text with flight IDs in bold, coloured by what happened.
function logLineHTML(line) {
  const cut = line.indexOf('  ');
  const time = line.slice(0, cut), text = line.slice(cut + 2);
  const kind = /^(Conflict|Crash)/.test(text) ? 'bad' : /landed|fixed|prevented/i.test(text) ? 'ok' :
               /holding|severe|ignored/i.test(text) ? 'warn' : /took off/.test(text) ? 'info' : '';
  return '<div class="logline ' + kind + '"><span class="ltime">' + time + '</span><span>' + highlight(text) + '</span></div>';
}

// The Weather page and the Log page.
function showDrawer() {
  if (screen === 'board') setHTML('boardPage', boardHTML());
  if (screen === 'weather') setHTML('weatherPage', weatherTabHTML());
  if (screen === 'log') setHTML('logPage', logLines.length ? logLines.map(logLineHTML).join('') : '<p class="muted">Nothing yet.</p>');
}

// CRASH WINDOW (drawn only when the crash message changes, so the pop-up animation plays once)
let crashShown = null;
function showCrash() {
  if (crashNotice === crashShown) return;
  crashShown = crashNotice;
  const box = $('crashBox');
  box.classList.toggle('hidden', !crashNotice);
  if (!crashNotice) return;
  const c = crashNotice;
  box.innerHTML = '<div class="crashCard"><div class="boom"></div><h2>Mid-air collision</h2>' +
    '<p><b>' + c.a.id + '</b> (' + c.a.airline + ', ' + c.a.plane + ') and <b>' + c.b.id + '</b> (' + c.b.airline + ', ' + c.b.plane + ') crashed near <b>' + c.near + '</b>.</p>' +
    '<p class="small muted">' + c.reason + ' Changing altitude works at once. Speed and route need time.</p>' +
    '<button class="go" onclick="crashNotice=null;showPanels()">OK</button></div>';
}

// ---------- STEP 2: route options ----------
function findRoute() {
  const fromName = $('fromSel').value, toName = $('toSel').value;
  if (!fromName || !toName) { alert('Please choose From and To.'); return; }
  if (fromName === toName) { alert('From and To must be different cities.'); return; }
  const reason = chosenType === 'Medical' ? $('reasonSel').value : '';
  if (chosenType === 'Medical' && !reason) { alert('Please choose the reason for the medical flight.'); return; }
  if (BIG_JETS.includes($('planeSel').value) && !(cities[cityIndex(fromName)].macro && cities[cityIndex(toName)].macro)) {
    alert('Big jets can only fly between two hub airports.'); return;
  }
  const planeName = $('planeSel').value;
  const load = Number($('loadInput').value);
  const loadProblem = checkLoad(chosenType, planeName, load);
  if (loadProblem) { alert(loadProblem); return; }
  plan = {
    passengers: chosenType === 'Passenger' ? load : 0,
    cargo: chosenType === 'Cargo' ? load : 0,
    from: cityIndex(fromName), to: cityIndex(toName), type: chosenType,
    airline: $('airlineSel').value, plane: planeName, reason: reason,
    speed: PLANE_SPEED[planeName],                                  // the plane's usual cruising speed
    altitude: TYPES[chosenType].altitude + (Math.random() < 0.5 ? 0 : 500),
  };
  refreshPlanRoutes();
  selectedId = null;
  tab = 'flights';
  openRadar();
}
// (Re)calculate the route options of the plan. Option 0 = cheapest = Dijkstra's choice.
function refreshPlanRoutes() {
  setPlanOptions(routeOptions(plan.from, plan.to), 'JavaScript');           // at once
  if (BACKEND) {                                                             // then the C++ answer (dijkstra.c)
    const asked = plan;
    backendRoutes(asked.from, asked.to).then(options => {
      if (plan !== asked || !options.length) return;
      setPlanOptions(options, 'C++ backend (routes.cpp)');
      showPanels();
    }).catch(() => {});
  }
}
function setPlanOptions(options, source) {
  const old = plan.route ? plan.route.join() : null;
  plan.options = options;
  plan.source = source;
  const same = plan.options.findIndex(o => o.path.join() === old);   // keep the user's choice if it is still there
  plan.choice = same >= 0 ? same : 0;
  plan.route = plan.options[plan.choice].path;
}
function chooseRoute(k) {
  plan.choice = k;
  plan.route = plan.options[k].path;
  showPanels();
}
function changePlan() { plan = null; go('details'); }

// ---------- STEP 3: start ----------
let departIn = 0;              // 0 = start now, otherwise minutes from now (scheduled flight)
function startFlight() {
  const later = departIn > 0;
  const plane = {
    id: 'AG' + String(nextId++).padStart(3, '0'),
    type: plan.type, priority: TYPES[plan.type].priority,
    route: plan.route, leg: 0, progress: 0,
    altitude: plan.altitude, speed: plan.speed,
    airline: plan.airline, plane: plan.plane, reason: plan.reason,
    passengers: plan.passengers || 0, cargo: plan.cargo || 0,
    departMinute: simMinutes + departIn,                                   // flight clock at take-off
    plannedArrival: simMinutes + departIn + routeKm(plan.route) / plan.speed * 60,   // if nothing changes
    arriveMinute: null,                                                    // filled in when it lands
    status: later ? 'scheduled' : 'flying', trail: [],
  };
  flights.push(plane);
  departIn = 0;
  addLog(plane.id + ' (' + plane.type + ', ' + whoText(plane) + ')' + (later ? ' scheduled for ' + clockText(plane.departMinute) + ': ' : ' took off: ') +  + plane.route.map(name).join(' › ') + ', ' + kmText(routeKm(plane.route)) + '.');
  selectedId = plane.id;
  plan = null;
  tab = 'flights';
  checkConflicts();
  showPanels();
}

// ---------- moving ----------
function movePlanes(seconds) {
  flights.forEach(plane => {                       // scheduled flights take off at their time
    if (plane.status === 'scheduled' && simMinutes >= plane.departMinute) {
      plane.status = 'flying';
      addLog(plane.id + ' took off as scheduled: ' + plane.route.map(name).join(' › ') + '.');
    }
  });
  flights.forEach(plane => {
    if (plane.status !== 'flying') return;
    const road = edgeBetween(plane.route[plane.leg], plane.route[plane.leg + 1]);
    const km = plane.speed * (seconds * speedX / SECONDS_PER_FLIGHT_HOUR);   // speed x time
    plane.progress += km / road.distance;
    if (plane.progress >= 1) {
      plane.progress = 0;
      plane.leg++;
      if (plane.leg >= plane.route.length - 1) {
        plane.status = 'holding';                  // at the destination: wait for the runway
        plane.wait = 0;
      }
    }
  });
  updateAirports(seconds * speedX / SECONDS_PER_FLIGHT_HOUR * 60);   // flight minutes that passed
}

// ---------- FLIGHT CLOCK ----------
// Starts at this computer's time and runs with the simulation (1 flight hour = 120 s at 1x).
// It stops when the planes stop (paused, or waiting for the controller).
const CLOCK_START = new Date().getHours() * 60 + new Date().getMinutes();
function clockText(minutes) {                       // flight minutes -> "14:35"
  const t = Math.round(CLOCK_START + minutes), m = t % 1440, day = Math.floor(t / 1440);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + (day > 0 ? ' (+' + day + ' day)' : '');
}
function expectedArrival(p) {                       // minutes, or null while it waits to land
  if (p.status === 'scheduled') return p.plannedArrival;
  if (p.status === 'landed') return p.arriveMinute;
  if (p.status === 'flying') return simMinutes + kmLeft(p) / p.speed * 60;
  return null;
}
function delayText(p) {
  if (p.status === 'crashed') return '-';
  if (p.status === 'scheduled') return 'on time';
  if (p.status === 'holding') return 'waiting to land (' + Math.round(p.wait) + ' min so far)';
  const late = Math.round(expectedArrival(p) - p.plannedArrival);
  if (late <= 1) return 'on time';
  return '<b class="late">' + (p.status === 'landed' ? '' : 'about ') + late + ' min late</b>';
}
function statusText(p) {
  if (p.status === 'scheduled') return 'Scheduled, departs ' + clockText(p.departMinute);
  if (p.status === 'crashed') return 'Crashed near ' + p.crashNear;
  if (p.status === 'landed') return 'Landed';
  if (p.status === 'holding') { const q = holdingQueue(p.route[p.route.length - 1]); return 'Holding, number ' + (q.indexOf(p) + 1) + ' in the landing queue'; }
  return activeConflicts.some(k => k.split('+').includes(p.id)) ? 'Flying (in conflict)' : 'Flying';
}
function loadText(p) {                              // what is on board
  const a = AIRCRAFT_INFO[p.plane] || { seats: 0, cargo: 0 };
  if (p.type === 'Passenger' && p.passengers) return p.passengers + ' of ' + a.seats + ' seats (' + Math.round(p.passengers / a.seats * 100) + '% full)';
  if (p.type === 'Cargo' && p.cargo) return p.cargo + ' t of ' + a.cargo + ' t (' + Math.round(p.cargo / a.cargo * 100) + '% full)';
  if (p.type === 'Medical') return '1 patient (' + p.reason + ')';
  return capacityText(p.plane);
}

// All the details of one flight, as a table.
function flightTableHTML(p) {
  const info = AIRCRAFT_INFO[p.plane] || { note: '' };
  const total = routeKm(p.route), litres = total * LITRES_PER_KM, arrive = expectedArrival(p);
  const rows = [
    ['Flight', p.id + ' · ' + p.type + ' (priority ' + p.priority + ')'],
    ['Airline / operator', p.airline],
    ['Aircraft', p.plane + ' · ' + info.note],
    ['Capacity', capacityText(p.plane)],
    ['On board', loadText(p)],
    ['From → To', name(p.route[0]) + ' → ' + name(p.route[p.route.length - 1])],
    ['Route', p.route.map(name).join(' › ') + ' (' + kmText(total) + ')'],
    ['Speed and altitude', p.speed + ' km/h · ' + p.altitude.toLocaleString('en-IN') + ' ft'],
    ['Departure', clockText(p.departMinute)],
    [p.status === 'landed' ? 'Arrival' : 'Expected arrival', p.status === 'crashed' ? '-' : arrive === null ? 'waiting to land' : (p.status === 'landed' ? '' : 'about ') + clockText(arrive)],
    ['Delay', delayText(p)],
    ['Fuel for the trip', Math.round(litres).toLocaleString('en-IN') + ' L · ' + rupees(litres * ATF_PRICE_PER_LITRE)],
    ['Status', statusText(p)],
  ];
  return '<h3>Flight details</h3><table class="ptable details">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
}

// The Board page: every flight in one table (click a row to see it on the radar).
function boardHTML() {
  if (!flights.length) return '<p class="muted">No flights yet.</p><button class="go" onclick="go(\'plan\')">Plan a flight</button>';
  const count = s => flights.filter(f => f.status === s).length;
  let html = '<p class="small">Flight clock: <b>' + clockText(simMinutes) + '</b> · In the air: <b>' + (count('flying') + count('holding')) +
             '</b> · Holding: <b>' + count('holding') + '</b> · Landed: <b>' + count('landed') + '</b> · Crashed: <b>' + count('crashed') + '</b></p>' +
             '<div class="tableWrap"><table class="ptable board"><tr><th>Flight</th><th>Type</th><th>Airline / operator</th><th>Aircraft</th><th>From</th><th>To</th>' +
             '<th>Departure</th><th>Arrival</th><th>Delay</th><th>On board</th><th>Status</th></tr>';
  flights.forEach(p => {
    const arrive = expectedArrival(p);
    html += '<tr onclick="selectFlight(\'' + p.id + '\'); openRadar()" title="Show on the radar">' +
      '<td><b>' + p.id + '</b></td><td><span class="tag" style="background:' + TYPES[p.type].color + '">' + p.type + '</span></td>' +
      '<td>' + p.airline + '</td><td>' + p.plane + '</td><td>' + name(p.route[0]) + '</td><td>' + name(p.route[p.route.length - 1]) + '</td>' +
      '<td>' + clockText(p.departMinute) + '</td>' +
      '<td>' + (p.status === 'crashed' ? '-' : arrive === null ? 'waiting' : (p.status === 'landed' ? '' : '~') + clockText(arrive)) + '</td>' +
      '<td>' + delayText(p) + '</td><td>' + loadText(p) + '</td>' +
      '<td><span class="st ' + p.status + '">' + statusText(p) + '</span></td></tr>';
  });
  return html + '</table></div><p class="small muted">~ = expected. Capacities are typical numbers (airline layouts differ). Click a flight to see it on the radar.</p>';
}

// ---------- AIRPORTS: capacity and holding ----------
// A runway takes one landing every LANDING_GAP minutes (data.js). A plane that arrives while it is busy HOLDS.
// Next to land: highest priority first, then the one waiting longest (like the priority queue).
let simMinutes = 0;           // flight minutes since the start
let lastLanding = {};         // city -> minute of its last landing
function holdingQueue(city) {
  return flights.filter(f => f.status === 'holding' && f.route[f.route.length - 1] === city)
    .sort((a, b) => b.priority - a.priority || b.wait - a.wait);
}
function updateAirports(minutes) {
  simMinutes += minutes;
  const holding = flights.filter(f => f.status === 'holding');
  holding.forEach(f => { f.wait += minutes; });
  [...new Set(holding.map(f => f.route[f.route.length - 1]))].forEach(city => {
    if (lastLanding[city] !== undefined && simMinutes - lastLanding[city] < landingGap(city)) return;   // runway busy
    const next = holdingQueue(city)[0];
    next.status = 'landed';
    next.arriveMinute = simMinutes;
    lastLanding[city] = simMinutes;
    addLog(next.id + ' landed at ' + name(city) + (next.wait > 0.05 ? ' after holding ' + Math.round(next.wait) + ' min.' : '.'));
  });
  holding.forEach(f => {                                               // tell once when a plane starts holding
    if (f.status === 'holding' && !f.holdLogged) {
      f.holdLogged = true;
      const city = f.route[f.route.length - 1];
      addLog(f.id + ' is holding at ' + name(city) + ': runway busy, number ' + (holdingQueue(city).indexOf(f) + 1) + ' in the landing queue.');
    }
  });
}

// ---------- the loop (about 60 times a second) ----------
let lastTime = performance.now(), panelTimer = 0, trailTimer = 0;
function loop(now) {
  const seconds = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const moving = !paused && !waiting;
  if (moving) movePlanes(seconds);
  checkConflicts();
  if (!paused || waiting) tickTimers(seconds);            // conflict countdown (crash at zero); stops when you pause
  trailTimer += seconds;
  if (moving && trailTimer > 0.15) {                     // remember the last few positions for the trail
    trailTimer = 0;
    flights.forEach(f => { if (f.status === 'flying') { f.trail.push(planePosition(f)); if (f.trail.length > 14) f.trail.shift(); } });
  }
  drawMap();
  panelTimer += seconds;
  if (panelTimer > 0.5 && !mouseDown) { panelTimer = 0; showPanels(); }   // never redraw while a button is pressed
  requestAnimationFrame(loop);
}

// ---------- buttons ----------
function togglePause() {
  if (waiting) { alert('First fix the conflict: change altitude, speed or route.'); return; }
  paused = !paused;
  showPanels();
}
function setSpeed(x) { speedX = x; showPanels(); }
function selectFlight(id) { selectedId = id; tab = 'flights'; showPanels(); }
function chooseControlled(id) { controlledId = id; showPanels(); }
function openTab(name) { tab = name; showPanels(); }

// ---------- the right side ----------
function showPanels() {
  $('clockPill').textContent = 'Clock ' + clockText(simMinutes);
  showBackendBadge();
  predictions = predictAll();                       // look 60 minutes ahead
  showConflict();
  // outside the Safety tab: only a one-line banner (keeps the screen clean)
  const wxList = weatherAlerts();
  let banners = '';
  if (tab !== 'safety' && predictions.length) {
    banners += '<div class="banner"><span>Conflict predicted in <b>' + predictions[0].start + ' min</b>: ' + predictions[0].a.id + ' and ' + predictions[0].b.id + '</span>' +
               ' <button class="mini go" onclick="openTab(\'safety\')">Review</button></div>';
  }
  if (tab !== 'safety' && wxList.length) {
    banners += '<div class="banner wx"><span>Severe weather on the route of <b>' + wxList.map(a => a.plane.id).join(', ') + '</b></span>' +
               ' <button class="mini go" onclick="openTab(\'safety\')">Review</button></div>';
  }
  setHTML('predictBox', banners);                   // both banners in one go (never added twice)
  const air = $('airStatus');
  if (activeConflicts.length) { air.textContent = 'Conflict now'; air.className = 'pill red'; }
  else if (predictions.length) { air.textContent = 'Conflict in ' + predictions[0].start + ' min'; air.className = 'pill orange'; }
  else { air.textContent = 'Airspace safe'; air.className = 'pill green'; }

  // only 2 tabs: Flights and Safety
  const flying = flights.filter(f => f.status === 'flying' || f.status === 'holding').length;   // holding planes are in the air too
  const alerts = activeConflicts.length + predictions.length + wxList.length;
  $('tabs').innerHTML =
    tabButton('flights', 'Flights' + (flights.length ? ' <i class="badge blue">' + flying + '</i>' : '')) +
    tabButton('safety', 'Safety' + (alerts ? ' <i class="badge' + (activeConflicts.length ? ' red' : '') + '">' + alerts + '</i>' : ''));
  setHTML('panel', tab === 'safety' ? safetyHTML(wxList) : chipsHTML() + ((plan && selectedId === null) ? planHTML() : liveHTML()));

  const bad = badWeatherCount();
  $('formWeather').innerHTML = weatherStatus() + weatherButtons() +
    (weather.some(w => w.src !== 'none') ? '<br>' + (bad ? '<b>' + bad + (bad === 1 ? ' city' : ' cities') + ' with bad weather.</b> ' : 'No bad weather. ') +
      '<a onclick="openWeather()">See weather</a>' : '');
  showWeatherStrip();
  showDrawer();
  showCrash();
  showPlanPages();
  // red bar on every page except the radar while a conflict is running
  setHTML('globalAlert', (screen !== 'radar' && activeConflicts.length) ? '<div class="globalAlert">Conflict now: ' +
    activeConflicts[0].replace('+', ' and ') + ', ' + Math.max(0, Math.ceil(timers[activeConflicts[0]])) +
    ' s left to act. <button class="mini go" onclick="openRadar()">Go to radar ›</button></div>' : '');
  // on the home page: what is flying right now
  $('homeStatus').innerHTML = ((flights.length || plan) ? '<div class="homeBox"><b>' + flying + '</b> flight' + (flying === 1 ? '' : 's') +
    ' in the air · ' + air.textContent + (plan ? ' · 1 route waiting to start' : '') +
    ' <button class="mini go" onclick="openRadar()">Open radar ›</button></div>' : '');
}
function tabButton(id, label) {
  return '<button class="' + (tab === id ? 'on' : '') + '" onclick="openTab(\'' + id + '\')">' + label + '</button>';
}

// A row of small chips: one per flight (highest priority first), the waiting route, and "+ New flight".
function chipsHTML() {
  // status by colour: red = conflict, grey = landed, crossed out = crashed
  const state = f => f.status === 'crashed' ? ' crashedChip' : f.status === 'landed' ? ' landedChip' : f.status === 'holding' ? ' holdChip' :
    f.status === 'scheduled' ? ' schedChip' :
    activeConflicts.some(k => k.includes(f.id)) ? ' warnChip' : '';
  let html = '<div class="chips">';
  if (plan) html += '<button class="chip' + (selectedId === null ? ' on' : '') + '" onclick="selectFlight(null)">New route</button>';
  flights.slice().sort((a, b) => b.priority - a.priority).forEach(f => {
    html += '<button class="chip' + state(f) + (f.id === selectedId ? ' on' : '') + '" onclick="selectFlight(\'' + f.id + '\')" title="' + whoText(f) + ' (' + f.status + ')">' +
            '<i style="background:' + TYPES[f.type].color + '"></i>' + f.id + '</button>';
  });
  return html + '<button class="chip add" onclick="goHome()">+ New flight</button></div>';
}

// Flights tab, before take-off: route options with distance, time, fuel cost
function planHTML() {
  const total = routeKm(plan.route), litres = total * LITRES_PER_KM;
  const options = plan.options.map((opt, k) => {
    const km = routeKm(opt.path);
    return '<div class="opt' + (k === plan.choice ? ' on' : '') + '" onclick="chooseRoute(' + k + ')">' +
      '<b>' + opt.path.map(name).join(' › ') + '</b>' + (k === 0 ? ' <span class="best">Best</span>' : '') +
      '<span>' + kmText(km) + ' · ' + timeText(km / plan.speed) + ' · arrives about <b>' + clockText(simMinutes + km / plan.speed * 60) + '</b> · ' +
      rupees(km * LITRES_PER_KM * ATF_PRICE_PER_LITRE) + ' fuel</span></div>';
  }).join('');
  const badOnRoute = plan.route.slice(1, -1).filter(c => weatherPenalty(c) > 0).map(c => weatherLineHTML(c)).join('<br>');
  return '<div class="steps left"><span class="done">1. Route</span><span class="done">2. Flight details</span><span class="on">3. Choose route and start</span></div>' +
    '<h2>' + name(plan.from) + ' → ' + name(plan.to) + '</h2>' +
    '<span class="tag" style="background:' + TYPES[plan.type].color + '">' + plan.type + ' · P' + TYPES[plan.type].priority + '</span> ' +
    '<span class="who2">' + whoText(plan) + '</span>' +
    '<div class="stats">' +
      '<div><b>' + kmText(straightKm(plan.from, plan.to)) + '</b><span>Straight line</span></div>' +
      '<div><b>' + kmText(total) + '</b><span>Flight path</span></div>' +
      '<div><b>' + timeText(total / plan.speed) + '</b><span>At ' + plan.speed + ' km/h</span></div>' +
      '<div><b>' + rupees(litres * ATF_PRICE_PER_LITRE) + '</b><span>Fuel, ' + Math.round(litres).toLocaleString('en-IN') + ' L</span></div>' +
    '</div>' +
    '<p class="small">Departs <b>now (' + clockText(simMinutes) + ')</b>, arrives about <b>' + clockText(simMinutes + total / plan.speed * 60) + '</b> · ' +
      plan.plane + ': ' + capacityText(plan.plane) + (plan.type === 'Passenger' ? ' · ' + plan.passengers + ' passengers' : '') +
      (plan.type === 'Cargo' ? ' · ' + plan.cargo + ' t cargo' : '') + '</p>' +
    '<h3>Choose a route</h3>' + options +
    '<div class="note">' + weatherLineHTML(plan.from) + '<br>' + weatherLineHTML(plan.to) + (badOnRoute ? '<br>' + badOnRoute : '') + '</div>' +
    ([plan.from, plan.to].some(c => weatherPenalty(c) >= SEVERE) ? '<div class="note danger"><b>Severe weather at the ' +
      (weatherPenalty(plan.from) >= SEVERE ? 'departure' : 'arrival') + ' city.</b> Dijkstra cannot avoid it. Real ATC would delay this flight.</div>' : '') +
    '<div class="btns"><label class="departSel">Departure <select id="departSel" onchange="departIn = Number(this.value); showPanels()">' +
      [0, 15, 30, 60, 120].map(m => '<option value="' + m + '"' + (m === departIn ? ' selected' : '') + '>' +
        (m ? 'in ' + m + ' min (' + clockText(simMinutes + m) + ')' : 'now (' + clockText(simMinutes) + ')') + '</option>').join('') + '</select></label>' +
      '<button class="go" onclick="startFlight()">' + (departIn ? 'Schedule flight' : 'Start flight') + '</button><button onclick="changePlan()">Change</button></div>';
}

// Flights tab, after take-off: the selected plane
function liveHTML() {
  const plane = findFlight(selectedId) || flights[flights.length - 1];
  if (!plane) return '<p class="muted">No flight yet.</p><button class="go" onclick="goHome()">Plan a flight</button>';
  const total = routeKm(plane.route), left = kmLeft(plane), used = total - left;
  const head = '<h2>' + plane.id + ': ' + name(plane.route[0]) + ' → ' + name(plane.route[plane.route.length - 1]) + '</h2>' +
    '<span class="tag" style="background:' + TYPES[plane.type].color + '">' + plane.type + '</span> <span class="who2">' + whoText(plane) + '</span>' +
    '<div class="small muted">' + viaText(plane.route) + '</div>';
  if (plane.status === 'crashed') return head + '<p class="crashed">Crashed near ' + plane.crashNear + '. ' + plane.crashWhy + '</p>' + flightTableHTML(plane);
  if (plane.status === 'holding') {
    const dest = plane.route[plane.route.length - 1], queue = holdingQueue(dest);
    const extraLitres = plane.speed * plane.wait / 60 * LITRES_PER_KM;
    return head + '<div class="note warn"><b>Holding at ' + name(dest) + '</b>: number <b>' + (queue.indexOf(plane) + 1) + '</b> of ' + queue.length + ' in the landing queue.</div>' +
      '<p class="small muted">' + (cities[dest].macro ? 'Hub' : 'Regional') + ' airport: one landing every <b>' + landingGap(dest) + ' min</b>. Waiting <b>' +
      Math.round(plane.wait) + ' min</b>, extra fuel about <b>' + Math.round(extraLitres).toLocaleString('en-IN') + ' L</b> (<b>' + rupees(extraLitres * ATF_PRICE_PER_LITRE) + '</b>).</p>' + flightTableHTML(plane);
  }
  if (plane.status === 'landed') {
    return head + '<div class="note ok"><b>Landed safely at ' + clockText(plane.arriveMinute) + '</b> after <b>' + kmText(total) + '</b>.</div>' + flightTableHTML(plane);
  }
  return head +
    '<div class="bar"><i style="width:' + Math.round(used / total * 100) + '%"></i></div>' +
    '<div class="stats">' +
      '<div><b>' + plane.altitude.toLocaleString('en-IN') + ' ft</b><span>Altitude</span></div>' +
      '<div><b>' + plane.speed + ' km/h</b><span>Speed</span></div>' +
      '<div><b>' + kmText(left) + '</b><span>Left of ' + kmText(total) + '</span></div>' +
      '<div><b>' + timeText(left / plane.speed) + '</b><span>Time left</span></div>' +
    '</div>' +
    (wxListFor(plane) ? '<p class="wxalert">' + wxListFor(plane) + ' Open the Safety tab.</p>' : '') +
    '<p class="small muted">Fuel used so far: <b>' + Math.round(used * LITRES_PER_KM).toLocaleString('en-IN') + ' L</b> (<b>' + rupees(used * LITRES_PER_KM * ATF_PRICE_PER_LITRE) + '</b>)</p>' +
    '<div class="btns"><button onclick="togglePause()">' + (waiting ? 'Paused (conflict)' : paused ? '▶ Resume' : '⏸ Pause') + '</button>' +
    '<span class="speed">' + [1, 2, 4].map(x => '<button class="' + (x === speedX ? 'on' : '') + '" onclick="setSpeed(' + x + ')">' + x + 'x</button>').join('') + '</span></div>' +
    flightTableHTML(plane);
}

// one line about severe weather on this plane's route (or '')
function wxListFor(plane) {
  const a = weatherAlerts().find(x => x.plane.id === plane.id);
  return a ? 'Severe weather ' + (a.kind === 'dest' ? 'at its destination' : 'on its route') + ': ' + a.cities.map(c => cities[c].name).join(', ') + '.' : '';
}

// Safety tab: scoreboard + weather alerts + the prediction engine
function safetyHTML(wxList) {
  return '<div class="score">' +
      '<div><b>' + resolved + '</b><span>Fixed by you</span></div>' +
      '<div><b>' + prevented + '</b><span>Prevented early</span></div>' +
      '<div class="' + (incidents ? 'bad' : '') + '"><b>' + incidents + '</b><span>Crashes</span></div>' +
    '</div>' +
    '<h3 class="ptitle">Airports</h3>' + airportsHTML() +
    '<h3 class="ptitle">Weather on routes</h3>' + weatherAlertsHTML(wxList) +
    '<p class="small muted">Flights flown around bad weather: <b>' + weatherReroutes + '</b></p>' +
    predictionTabHTML();
}

// Airports with planes waiting to land
function airportsHTML() {
  const busy = cities.map((c, i) => i).filter(i => holdingQueue(i).length);
  if (!busy.length) return '<div class="okbox"><b>No planes holding.</b> Hub airports land <b>30 planes an hour</b>, regional airports <b>6</b>.</div>';
  return busy.map(i => '<div class="note warn"><b>' + name(i) + '</b> (' + (cities[i].macro ? 'hub' : 'regional') + ', 1 landing every ' + landingGap(i) + ' min): ' +
    holdingQueue(i).map((f, k) => (k + 1) + '. <b>' + f.id + '</b> (P' + f.priority + ', ' + Math.round(f.wait) + ' min)').join(', ') + '</div>').join('');
}

// Conflict card with the controller's 3 tools and the countdown
function showConflict() {
  if (activeConflicts.length === 0) { setHTML('conflictBox', ''); return; }
  const key = activeConflicts[0], [idA, idB] = key.split('+');
  const a = findFlight(idA), b = findFlight(idB);
  if (controlledId !== idA && controlledId !== idB) controlledId = (a.priority < b.priority) ? idA : idB;   // lower priority first
  const p = findFlight(controlledId), gap = gapBetween(a, b);
  const left = Math.max(0, Math.ceil(timers[key]));
  const btn = (text, call) => '<button onclick="' + call + '">' + text + '</button>';
  setHTML('conflictBox', '<div class="card alert">' +
    '<h3>' + idA + ' and ' + idB + ' are too close</h3>' +
    (acted[key]
      ? '<div class="countdown calm">You changed speed or route. Countdown stopped while they separate. They crash only if they touch (under ' + TOUCH_KM + ' km and ' + TOUCH_FEET + ' ft).</div>'
      : '<div class="countdown"><span><b>' + left + ' s</b> to act, or they crash</span><div class="cbar"><i style="width:' + (left / DECISION_SECONDS * 100) + '%"></i></div></div>') +
    '<p class="small">' + Math.round(gap.km) + ' km apart (need ' + MIN_DISTANCE + ') and ' + gap.feet + ' ft height gap (need ' + MIN_HEIGHT + '). ' +
    (waiting ? '<b>Planes are paused until you act.</b>' : 'Waiting for them to separate...') + '</p>' +
    '<p class="small">Change: ' +
      '<button class="' + (controlledId === idA ? 'on' : '') + '" onclick="chooseControlled(\'' + idA + '\')">' + idA + ' (' + a.airline + ')</button> ' +
      '<button class="' + (controlledId === idB ? 'on' : '') + '" onclick="chooseControlled(\'' + idB + '\')">' + idB + ' (' + b.airline + ')</button></p>' +
    '<div class="tool"><span>Altitude: ' + p.altitude + ' ft</span>' + btn('↓ 1000', "changeAltitude('" + p.id + "',-1000)") + btn('↑ 1000', "changeAltitude('" + p.id + "',1000)") + '</div>' +
    '<div class="tool"><span>Speed: ' + p.speed + ' km/h</span>' + btn('Slower', "changeSpeed('" + p.id + "',-100)") + btn('Faster', "changeSpeed('" + p.id + "',100)") + '</div>' +
    '<div class="tool"><span>Route</span>' + btn('Take another route', "changeRoute('" + p.id + "')") + '</div>' +
    '</div>');
}

// ---------- start ----------
document.onmousedown = () => { mouseDown = true; };
document.onmouseup = () => { setTimeout(() => { mouseDown = false; }, 150); };
fillForm();
drawBackground();
connectBackend();          // use the C++ backend if it is running (api.js)
showPage();                // open the page in the address (#/plan by default)
setupZoom();
addLog('System ready: ' + cities.length + ' cities.');
showPanels();
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);
requestAnimationFrame(loop);
