// conflict.js : the system FINDS conflicts. The CONTROLLER (you) FIXES them.
// Same idea as detection.c and resolution.c in the C project.

const MIN_DISTANCE = 100;   // km   : closer than this is too close (DISTANCE_THRESHOLD in detection.h)
const MIN_HEIGHT = 1000;    // feet : smaller height gap than this is too close

let activeConflicts = [];   // pairs in conflict right now, like 'AG001+AG002'
let waiting = false;        // true = everything is frozen until the controller acts
let resolved = 0;           // how many conflicts the controller fixed

// CRASH RULES
//  1. The controller does nothing for DECISION_SECONDS -> crash.
//  2. The controller changed speed or route (these need time) -> the countdown stops,
//     and they crash only if they really touch (closer than TOUCH_KM, less than TOUCH_FEET apart) while still getting closer.
//  3. Altitude changed but still not enough -> the countdown keeps going.
const DECISION_SECONDS = 30;  // real seconds the controller has to clear a conflict
let timers = {};              // seconds left for each conflict, like timers['AG001+AG002'] = 12.5
let crashes = [];             // crash spots on the map (for the fire)
let incidents = 0;            // how many crashes
let crashNotice = null;       // the crash message shown on screen (null = none)
let acted = {};               // conflicts where the controller used speed or route, like acted['AG001+AG002'] = true
let lastKm = {};              // distance at the last check, to know if two planes are getting closer
const TOUCH_KM = 5, TOUCH_FEET = 500;   // closer than this = the planes hit each other

// Where is a plane right now? (latitude, longitude, x, y on the map, and direction)
function planePosition(plane) {
  return pointAt(plane.route, plane.leg, plane.progress);
}
// A point on a route: on road number "leg", a part t of the way (0 = start city, 1 = next city).
function pointAt(route, leg, t) {
  const a = cities[route[leg]];
  const b = cities[route[Math.min(leg + 1, route.length - 1)]];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90,
  };
}

// Gap between two planes: km apart and feet apart.
function gapBetween(a, b) {
  const p = planePosition(a), q = planePosition(b);
  return { km: kmBetween(p.lat, p.lon, q.lat, q.lon), feet: Math.abs(a.altitude - b.altitude) };
}

// CONFLICT RULE: too close sideways AND too close in height.
function inConflict(a, b) {
  if (a.status !== 'flying' || b.status !== 'flying') return false;   // landed or crashed planes cannot conflict
  const gap = gapBetween(a, b);
  return gap.km < MIN_DISTANCE && gap.feet < MIN_HEIGHT;
}

// Check every pair. A NEW conflict freezes everything.
function checkConflicts() {
  let now = [];
  if (BACKEND && backendAnswer) {
    now = backendConflictPairs();                    // answer of safety.cpp (api.js)
  } else {
    for (let i = 0; i < flights.length; i++) {
      for (let j = i + 1; j < flights.length; j++) {
        if (inConflict(flights[i], flights[j])) now.push(flights[i].id + '+' + flights[j].id);
      }
    }
  }
  now.forEach(pair => {
    if (!activeConflicts.includes(pair)) {
      waiting = true;                                          // freeze until the controller acts
      timers[pair] = DECISION_SECONDS;                         // start the countdown
      lastKm[pair] = gapBetween(...pair.split('+').map(findFlight)).km;
      addLog('Conflict: ' + pair.replace('+', ' and ') + ' are too close. Everything paused.');
    }
  });
  activeConflicts.forEach(pair => {
    if (!now.includes(pair)) {
      delete timers[pair];
      delete acted[pair];
      delete lastKm[pair];
      resolved++;
      addLog('Conflict fixed: ' + pair.replace('+', ' and ') + ' are safe now.');
    }
  });
  activeConflicts = now;
  if (!activeConflicts.length) waiting = false;        // nothing left to wait for
}

function findFlight(id) {
  return flights.find(f => f.id === id);
}

// ---- "What if" copies: the same plane with ONE change, without touching the real plane ----
function altitudeChanged(plane, amount) {
  return { ...plane, altitude: Math.min(40000, Math.max(20000, plane.altitude + amount)) };
}
function speedChanged(plane, amount) {
  return { ...plane, speed: Math.min(900, Math.max(500, plane.speed + amount)) };
}
// Another route: close one road and run Dijkstra again. Returns null if not possible now.
function routeChanged(plane) {
  const last = plane.route.length - 1;
  let startLeg, banned;
  if (plane.progress < 0.3) {              // just took off: can turn back and use another road
    startLeg = plane.leg;
    banned = [plane.route[plane.leg], plane.route[plane.leg + 1]];
  } else if (plane.leg + 1 < last) {       // later: change the route after the next city
    startLeg = plane.leg + 1;
    banned = [plane.route[plane.leg + 1], plane.route[plane.leg + 2]];
  } else {
    return null;                           // last part of the trip: cannot change
  }
  const answer = dijkstra(plane.route[startLeg], plane.route[last], banned);
  if (!answer) return null;
  const copy = { ...plane, route: plane.route.slice(0, startLeg).concat(answer.path) };
  if (startLeg === plane.leg) copy.progress = 0;   // it turns back to its city
  return copy;
}

// ---- the real actions of the controller ----

// Tool 1: ALTITUDE (20,000 to 40,000 ft)
function changeAltitude(id, amount) {
  const plane = findFlight(id);
  const old = plane.altitude;
  if (altitudeChanged(plane, amount).altitude === old) { alert('Altitude must stay between 20,000 and 40,000 ft.'); return; }
  plane.altitude = altitudeChanged(plane, amount).altitude;
  addLog('You changed ' + id + ' altitude: ' + old + ' to ' + plane.altitude + ' ft.');
  afterAction(false);   // altitude works at once, so stay paused if it is still not enough
}

// Tool 2: SPEED (500 to 900 km/h)
function changeSpeed(id, amount) {
  const plane = findFlight(id);
  const old = plane.speed;
  if (speedChanged(plane, amount).speed === old) { alert('Speed must stay between 500 and 900 km/h.'); return; }
  plane.speed = speedChanged(plane, amount).speed;
  markActed(id);
  addLog('You changed ' + id + ' speed: ' + old + ' to ' + plane.speed + ' km/h.');
  afterAction(true);    // speed needs time to work, so let the planes move
}

// Tool 3: ANOTHER ROUTE (see routeChanged above).
function changeRoute(id) {
  const plane = findFlight(id);
  const copy = routeChanged(plane);
  if (!copy) { alert(id + ' is on its last part (or has no other road). Use altitude or speed.'); return; }
  if (copy.progress !== plane.progress) { plane.progress = copy.progress; plane.trail = []; }
  plane.route = copy.route;
  markActed(id);
  addLog('You rerouted ' + id + ': ' + plane.route.map(c => cities[c].name).join(' › ') + '.');
  afterAction(true);    // a new route needs time to work, so let the planes move
}

// After the controller acts: check again, then decide if the planes may move.
function afterAction(needsTime) {
  if (BACKEND) pollBackend();                          // ask the backend again at once
  checkConflicts();
  waiting = needsTime ? false : activeConflicts.length > 0;
  showPanels();
}

// ---------- COUNTDOWN and CRASH ----------
// Called every frame: each active conflict loses time. At zero the planes crash.
function tickTimers(seconds) {
  activeConflicts.slice().forEach(pair => {
    const [a, b] = pair.split('+').map(findFlight), gap = gapBetween(a, b);
    const closing = gap.km < lastKm[pair];                   // are they getting closer?
    lastKm[pair] = gap.km;
    if (acted[pair]) {                                       // speed/route used: crash only if they touch while closing in
      if (closing && gap.km < TOUCH_KM && gap.feet < TOUCH_FEET) crash(pair, 'touch');
      return;
    }
    timers[pair] -= seconds;
    if (timers[pair] <= 0) crash(pair, 'time');
  });
}
// The controller used speed or route on this plane: stop the countdown of its conflicts.
function markActed(id) {
  activeConflicts.forEach(k => { if (k.split('+').includes(id)) acted[k] = true; });
}

function crash(pair, why) {
  const [a, b] = pair.split('+').map(findFlight);
  if (a.status !== 'flying' || b.status !== 'flying') return;   // already crashed or landed: never twice
  const p = planePosition(a), q = planePosition(b);
  const spot = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, lat: (p.lat + q.lat) / 2, lon: (p.lon + q.lon) / 2 };
  const near = nearestCity(spot);
  a.status = 'crashed'; b.status = 'crashed';
  a.crashNear = near; b.crashNear = near;
  incidents++;
  crashes.push({ x: spot.x, y: spot.y, time: performance.now(), text: a.id + ' + ' + b.id });
  const reason = why === 'touch' ? 'They flew into each other (closer than ' + TOUCH_KM + ' km at almost the same height).'
                                 : 'Nobody cleared the conflict within ' + DECISION_SECONDS + ' seconds.';
  a.crashWhy = reason; b.crashWhy = reason;
  crashNotice = { a: a, b: b, near: near, reason: reason };
  addLog('Crash: ' + a.id + ' and ' + b.id + ' collided near ' + near + '. ' + reason);
  // forget every conflict of these two planes
  activeConflicts = activeConflicts.filter(k => { const gone = k.split('+').some(id => id === a.id || id === b.id); if (gone) { delete timers[k]; delete acted[k]; delete lastKm[k]; } return !gone; });
  waiting = waiting && activeConflicts.length > 0;          // other planes may move again
  shakeMap();
  showPanels();
}
