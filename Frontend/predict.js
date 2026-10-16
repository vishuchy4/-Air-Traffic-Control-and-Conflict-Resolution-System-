// predict.js : PREDICTIVE conflict check ("see it before it happens").
// Idea: fast-forward every pair of planes up to 60 minutes into the future, one minute at a time.
// If they will come closer than 100 km at the same height, warn the controller NOW.
// The system only advises. The controller decides and presses Apply.

const LOOK_AHEAD_MINUTES = 60;
let predictions = [];        // future conflicts, soonest first
let predictedKeys = [];      // pairs already written in the log
let prevented = 0;           // conflicts the controller stopped before they happened
let predictControlId = null; // plane the controller wants to change

// Where will this plane be after some minutes? (null if it has landed by then)
function positionAfter(plane, minutes) {
  let leg = plane.leg, progress = plane.progress;
  let km = plane.speed * minutes / 60;                       // distance = speed x time
  while (leg < plane.route.length - 1) {
    const road = edgeBetween(plane.route[leg], plane.route[leg + 1]).distance;
    const leftOnRoad = road * (1 - progress);
    if (km <= leftOnRoad) return pointAt(plane.route, leg, progress + km / road);
    km -= leftOnRoad;                                        // go on to the next road
    leg++;
    progress = 0;
  }
  return null;                                               // landed
}

// Will planes a and b get too close in the next 60 minutes?
// Returns { start: minutes until too close, km: closest distance, p, q: positions at the closest moment } or null.
function predictPair(a, b) {
  const feet = Math.abs(a.altitude - b.altitude);
  if (feet >= MIN_HEIGHT) return null;                       // different heights: always safe
  let start = null, closest = null;
  for (let m = 1; m <= LOOK_AHEAD_MINUTES; m++) {
    const p = positionAfter(a, m), q = positionAfter(b, m);
    if (!p || !q) break;                                     // one of them has landed
    const km = kmBetween(p.lat, p.lon, q.lat, q.lon);
    if (km < MIN_DISTANCE && start === null) start = m;      // first minute they are too close
    if (!closest || km < closest.km) closest = { km: km, p: p, q: q };
  }
  if (start === null) return null;
  return { start: start, km: closest.km, feet: feet, p: closest.p, q: closest.q };
}

// Check every pair of flying planes (pairs already in conflict are handled by conflict.js).
function predictAll() {
  let list = [];
  const flying = flights.filter(f => f.status === 'flying');
  if (BACKEND && backendAnswer) list = backendPredictions();          // answer of safety.cpp (api.js)
  else for (let i = 0; i < flying.length; i++) {
    for (let j = i + 1; j < flying.length; j++) {
      const a = flying[i], b = flying[j], key = a.id + '+' + b.id;
      if (activeConflicts.includes(key)) continue;
      const result = predictPair(a, b);
      if (result) list.push({ ...result, a: a, b: b, key: key });
    }
  }
  list.sort((x, y) => x.start - y.start);
  list.forEach(pr => {                                       // write each new prediction once in the log
    if (!predictedKeys.includes(pr.key)) addLog('Predicted: ' + pr.a.id + ' and ' + pr.b.id + ' will be too close in ' + pr.start + ' min.');
  });
  predictedKeys = list.map(pr => pr.key);
  return list;
}

// The city nearest to a point (to say "near Nagpur").
function nearestCity(point) {
  let best = 0;
  cities.forEach((c, i) => {
    if (kmBetween(point.lat, point.lon, c.lat, c.lon) < kmBetween(point.lat, point.lon, cities[best].lat, cities[best].lon)) best = i;
  });
  return cities[best].name;
}

// WHAT IF: try each fix on a COPY of the plane, and see if the future conflict goes away.
function whatIfTests(pr, plane) {
  const fromBackend = BACKEND ? backendWhatIf(pr, plane) : null;      // answer of safety.cpp (api.js)
  if (fromBackend) return fromBackend;
  const other = plane.id === pr.a.id ? pr.b : pr.a;
  const up = plane.altitude + 1000 <= 40000 ? 1000 : -1000;
  const tests = [
    { kind: 'alt', amount: up, label: (up > 0 ? 'Raise ' : 'Lower ') + plane.id + ' by 1,000 ft', after: altitudeChanged(plane, up) },
    { kind: 'spd', amount: -100, label: 'Slow ' + plane.id + ' by 100 km/h', after: speedChanged(plane, -100) },
    { kind: 'route', amount: 0, label: 'Send ' + plane.id + ' on another route', after: routeChanged(plane) },
  ];
  tests.forEach(t => {
    t.fixes = t.after ? (!predictPair(t.after, other) && !inConflict(t.after, other)) : null;   // null = not possible now
  });
  return tests;
}

// The controller presses Apply on one of the tests.
async function applyFix(kind, id, amount, key) {
  if (kind === 'alt') changeAltitude(id, amount);
  else if (kind === 'spd') changeSpeed(id, amount);
  else changeRoute(id);
  if (BACKEND) await backendNow();                     // wait for the C++ answer after the change
  predictions = predictAll();
  if (!predictions.some(pr => pr.key === key) && !activeConflicts.includes(key)) {
    prevented++;
    addLog('Conflict prevented in advance: ' + key.replace('+', ' and ') + '.');
  }
  showPanels();
}

// The orange PREDICTION card.
function predictionHTML() {
  if (predictions.length === 0) return '';
  const pr = predictions[0];
  if (predictControlId !== pr.a.id && predictControlId !== pr.b.id) predictControlId = (pr.a.priority < pr.b.priority) ? pr.a.id : pr.b.id;
  const plane = findFlight(predictControlId);
  const tests = whatIfTests(pr, plane);
  const best = tests.find(t => t.fixes);                    // same order as resolution.c: altitude, then speed, then route
  const mid = { lat: (pr.p.lat + pr.q.lat) / 2, lon: (pr.p.lon + pr.q.lon) / 2 };
  const pick = id => '<button class="' + (id === predictControlId ? 'on' : '') + '" onclick="predictControlId=\'' + id + '\';showPanels()">' + id + ' (' + findFlight(id).type + ', ' + findFlight(id).airline + ')</button>';
  return '<div class="card predict">' +
    '<h3>Conflict predicted in ' + pr.start + ' min</h3>' +
    '<p class="small"><b>' + pr.a.id + '</b> and <b>' + pr.b.id + '</b> will come within <b>' + Math.round(pr.km) + ' km</b> at almost the same height (' +
      pr.feet + ' ft gap), near <b>' + nearestCity(mid) + '</b>. Nothing has happened yet, so there is time to act.</p>' +
    '<p class="small">Change: ' + pick(pr.a.id) + ' ' + pick(pr.b.id) + '</p>' +
    '<div class="tests">' + tests.map(t =>
      '<div class="test"><span>' + t.label + '</span>' +
      (t.fixes === null ? '<em class="no">not possible now</em>' : t.fixes ? '<em class="yes">✓ fixes it</em>' : '<em class="no">✗ still too close</em>') +
      (t.fixes === null ? '' : '<button onclick="applyFix(\'' + t.kind + '\',\'' + plane.id + '\',' + t.amount + ',\'' + pr.key + '\')">Apply</button>') +
      '</div>').join('') + '</div>' +
    '<p class="small suggest">' + (best ? 'AeroGuard suggests: <b>' + best.label + '</b>. You decide.' : 'None of these fixes it alone. Try another plane or combine two changes.') + '</p>' +
    (predictions.length > 1 ? '<p class="small muted">+ ' + (predictions.length - 1) + ' more predicted.</p>' : '') +
    '</div>';
}

// CLOSEST APPROACH of two planes in the next 60 minutes (no matter their height).
function closestApproach(a, b) {
  let best = null;
  for (let m = 0; m <= LOOK_AHEAD_MINUTES; m++) {
    const p = positionAfter(a, m), q = positionAfter(b, m);
    if (!p || !q) break;
    const km = kmBetween(p.lat, p.lon, q.lat, q.lon);
    if (!best || km < best.km) best = { minutes: m, km: km };
  }
  return best;
}

// The PREDICTION TAB: always visible, shows what the prediction engine sees.
function predictionTabHTML() {
  const flying = flights.filter(f => f.status === 'flying');
  let html = '<h3 class="ptitle">Predictive Conflict Guard</h3>' +
    '<p class="small muted">Warns before two flights get too close (closer than ' + MIN_DISTANCE + ' km and less than ' + MIN_HEIGHT.toLocaleString('en-IN') + ' ft apart).</p>';
  const rules = '';
  if (flying.length < 2) {
    return html + '<div class="waitbox"><b>Prediction engine waiting.</b> It needs 2 or more flights in the air.<br>' +
      'Try: Delhi → Lucknow, then Lucknow → Delhi, same flight type.</div><table class="ptable">' + rules + '</table>';
  }
  // every pair, most dangerous first
  const pairs = [];
  for (let i = 0; i < flying.length; i++) {
    for (let j = i + 1; j < flying.length; j++) {
      const a = flying[i], b = flying[j], key = a.id + '+' + b.id;
      const near = closestApproach(a, b), pr = predictions.find(x => x.key === key);
      const now = activeConflicts.includes(key);
      pairs.push({ a: a, b: b, near: near, feet: Math.abs(a.altitude - b.altitude),
                   rank: now ? 0 : pr ? 1 + pr.start / 100 : 3 + near.km / 10000,
                   result: now ? 'Conflict now' : pr ? 'Conflict in ' + pr.start + ' min' : 'Safe' });
    }
  }
  pairs.sort((x, y) => x.rank - y.rank);
  const t = pairs[0];
  html += '<p class="small"><b>Most critical pair: ' + t.a.id + ' and ' + t.b.id + '</b> · ' + t.result + '</p>' +
    '<table class="ptable">' +
      '<tr><td>Closest predicted distance</td><td><b>' + Math.round(t.near.km) + ' km</b></td></tr>' +
      '<tr><td>Time to closest approach</td><td><b>' + t.near.minutes + ' min</b></td></tr>' +
      '<tr><td>Height gap</td><td><b>' + t.feet.toLocaleString('en-IN') + ' ft</b></td></tr>' + rules +
    '</table>';
  html += predictions.length ? predictionHTML()
    : activeConflicts.length ? '<div class="waitbox red">A conflict is happening now. Use the red box above.</div>'
    : '<div class="okbox"><b>No action needed.</b> No conflict in the next 60 minutes.</div>';
  if (pairs.length > 1) {
    html += '<h3>All pairs</h3>' + pairs.map(x => '<div class="row"><b>' + x.a.id + ' & ' + x.b.id + '</b> closest ' + Math.round(x.near.km) + ' km in ' +
      x.near.minutes + ' min, ' + x.feet + ' ft gap<span>' + x.result + '</span></div>').join('');
  }
  return html;
}
