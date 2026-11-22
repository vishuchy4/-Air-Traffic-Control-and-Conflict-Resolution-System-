// map.js : the RADAR. Everything it shows comes from the C++ backend (S = /api/state).
//   drawBackground() : drawn ONCE  (radar scope, rings, compass, roads, sweep)
//   drawMap()        : drawn EVERY FRAME (names, routes, planes, trails, conflicts, bad weather)

const CX = 330, CY = 372;              // centre of the radar scope (central India)
const PX_PER_KM = 24 / 111;            // 1 degree of latitude = 24 pixels = about 111 km
const PLANE_SHAPE = 'M0-12L3-3 12 3V6L3 4 2 10 6 13V15L0 13-6 15V13L-2 10-3 4-12 6V3L-3-3Z';

function drawBackground() {
  let svg = '<defs>' +
    '<radialGradient id="scope" cx="' + CX + '" cy="' + CY + '" r="420" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0" stop-color="#dce9f8"/><stop offset="1" stop-color="#ffffff"/></radialGradient>' +
    '<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="' + CX + '" y1="0" x2="' + (CX + 300) + '" y2="0">' +
      '<stop offset="0" stop-color="#2f7fd6" stop-opacity="0"/><stop offset="1" stop-color="#2f7fd6" stop-opacity=".24"/></linearGradient>' +
    '</defs>' +
    '<rect width="780" height="740" fill="url(#scope)"/>' +
    (typeof geoSVG === 'function' ? geoSVG() : '');                       // land, coast, rivers, seas (geo.js)
  // range rings: 500, 1000, 1500 km
  [500, 1000, 1500].forEach(km => {
    const r = km * PX_PER_KM;
    svg += '<circle class="ring" cx="' + CX + '" cy="' + CY + '" r="' + r + '"/>' +
           '<text class="ringLabel" x="' + (CX + r * 0.26 + 4) + '" y="' + (CY + r * 0.97 - 4) + '">' + km + ' km</text>';
  });
  // compass ticks every 10 degrees, and N E S W
  const R = 1550 * PX_PER_KM;
  for (let deg = 0; deg < 360; deg += 10) {
    const a = deg * Math.PI / 180, len = deg % 30 === 0 ? 12 : 6;
    svg += '<line class="tick" x1="' + (CX + Math.sin(a) * R) + '" y1="' + (CY - Math.cos(a) * R) +
           '" x2="' + (CX + Math.sin(a) * (R - len)) + '" y2="' + (CY - Math.cos(a) * (R - len)) + '"/>';
  }
  svg += '<text class="compass" x="' + CX + '" y="' + (CY - R - 6) + '">N</text>' +
         '<text class="compass" x="' + (CX + R + 12) + '" y="' + (CY + 5) + '">E</text>' +
         '<text class="compass" x="' + CX + '" y="' + (CY + R + 18) + '">S</text>' +
         '<text class="compass" x="14" y="' + (CY + 5) + '">W</text>';
  svg += '<line class="cross" x1="' + CX + '" y1="0" x2="' + CX + '" y2="740"/><line class="cross" x1="0" y1="' + CY + '" x2="780" y2="' + CY + '"/>';
  // every road: in the region colour when both cities are in the same region, otherwise grey
  ROADS.forEach(r => {
    if (r.from < r.to) {
      const color = cities[r.from].region === cities[r.to].region ? regionColor(r.from) : '#a9b8c8';
      svg += '<line class="road" style="stroke:' + color + '" x1="' + cities[r.from].x + '" y1="' + cities[r.from].y +
             '" x2="' + cities[r.to].x + '" y2="' + cities[r.to].y + '"/>';
    }
  });
  // the turning radar beam
  const end = { x: CX + Math.sin(Math.PI / 4) * R, y: CY - Math.cos(Math.PI / 4) * R };
  svg += '<g class="sweep"><path d="M' + CX + ' ' + CY + ' L' + CX + ' ' + (CY - R) + ' A' + R + ' ' + R + ' 0 0 1 ' + end.x + ' ' + end.y +
         ' Z" fill="url(#beam)"/><line x1="' + CX + '" y1="' + CY + '" x2="' + end.x + '" y2="' + end.y + '" class="beamLine"/></g>';
  $('mapBg').innerHTML = svg;
  drawRegionBar();
}

// Where a plane is on the picture, and which way its nose points (along the road it is on).
function planeXY(p) {
  const leg = Math.min(p.leg, p.route.length - 2);
  const a = cities[p.route[leg]], b = cities[p.route[leg + 1]];
  return { x: mapX(p.lon), y: mapY(p.lat), angle: curveAngle(p.route[leg], p.route[leg + 1], p.leg > leg ? 1 : p.progress) * 180 / Math.PI + 90 };
}

function drawMap() {
  if (!S) return;
  let svg = '';
  // routes: other options (grey), the chosen plan (yellow, moving dashes), flying planes (their colour)
  if (plan) plan.answer.options.forEach((opt, k) => { if (k !== plan.choice) svg += routeLine(opt.path, 'optLine'); });
  S.planes.forEach(f => { if (f.status === 'flying') svg += routeLine(f.route, f.id === selectedId ? 'flightLine big' : 'flightLine', TYPE_COLOR[f.type]); });
  if (plan) svg += routeLine(planRoute(), 'planLine');

  // cities on a route right now get bright names
  const used = new Set();
  if (plan) planRoute().forEach(c => used.add(c));
  S.planes.forEach(f => { if (f.status === 'flying') f.route.forEach(c => used.add(c)); });

  // cities: dot + name (+ weather)
  cities.forEach((c, i) => {
    const on = used.has(i), left = LEFT_LABELS.includes(c.name);
    const tx = left ? c.x - 9 : c.x + 9, anchor = left ? 'end' : 'start';
    const regionStyle = on ? '' : c.hub ? ' style="stroke:' + regionColor(i) + '"' : ' style="fill:' + regionColor(i) + '"';
    svg += '<circle class="' + (on ? 'stop' : c.hub ? 'hub' : 'dot') + '"' + regionStyle + ' cx="' + c.x + '" cy="' + c.y + '" r="' + (on ? 7 : c.hub ? 7.5 : 4.2) + '"/>' +
           '<text class="' + (on ? 'nameOn' : c.hub ? 'nameHub' : 'name') + '" x="' + tx + '" y="' + (c.y + 4) + '" text-anchor="' + anchor + '">' + c.name + '</text>';
    const w = S.weather[i];
    if (w.source !== 'none' && (w.penalty || c.hub)) {      // weather on the radar: hubs, and any city with bad weather
      svg += '<text class="' + (w.penalty ? 'wxIcon' : 'wxHub') + '" x="' + tx + '" y="' + (c.y + 18) + '" text-anchor="' + anchor + '">' +
             weatherLook(w.code)[0] + ' ' + Math.round(w.temp) + '°' + (w.penalty ? ' +' + w.penalty : '') + '</text>';
    }
  });

  // conflicts now: red line between the planes and pulsing red rings
  const beat = (performance.now() / 1000) % 1;
  const ring = pt => '<circle class="conflictRing" cx="' + pt.x + '" cy="' + pt.y + '" r="' + (12 + beat * 18) + '" opacity="' + (1 - beat) + '"/>';
  S.conflicts.forEach(c => {
    const a = findPlane(c.a), b = findPlane(c.b);
    if (!a || !b) return;
    const p = planeXY(a), q = planeXY(b);
    svg += '<line class="conflictLine" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '"/>' + ring(p) + ring(q);
  });

  // conflicts coming: ghost planes where they will be closest, joined by an orange dashed line
  S.coming.slice(0, 2).forEach(pr => {
    const p = { x: mapX(pr.pa.lon), y: mapY(pr.pa.lat) }, q = { x: mapX(pr.pb.lon), y: mapY(pr.pb.lat) };
    svg += '<line class="predLine" x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '"/>' +
           '<circle class="ghost" cx="' + p.x + '" cy="' + p.y + '" r="9"/><circle class="ghost" cx="' + q.x + '" cy="' + q.y + '" r="9"/>' +
           '<text class="predLabel" x="' + ((p.x + q.x) / 2 + 12) + '" y="' + ((p.y + q.y) / 2 - 12) + '">in ' + pr.start + ' min</text>';
  });

  // planes: holding ones circle their airport; flying ones have a fading trail, the plane, its name and height
  const drawn = [];
  S.planes.forEach(f => {
    if (f.status === 'holding') {
      const d = cities[f.route[f.route.length - 1]], k = f.queuePlace - 1;
      const angle = performance.now() / 700 + k * 2.1, r = 16 + k * 7;
      const x = d.x + Math.cos(angle) * r, y = d.y + Math.sin(angle) * r;
      svg += '<circle class="holdRing" cx="' + d.x + '" cy="' + d.y + '" r="' + r + '"/>' +
             '<g transform="translate(' + x + ',' + y + ')"><path d="' + PLANE_SHAPE + '" fill="' + TYPE_COLOR[f.type] +
             '" transform="rotate(' + (angle * 180 / Math.PI + 180) + ') scale(1.1)"/>' +
             '<text class="planeName" x="12" y="-4">' + f.id + ' holding #' + (k + 1) + '</text></g>';
      return;
    }
    if (f.status !== 'flying') return;
    const color = TYPE_COLOR[f.type], trail = trails[f.id] || [];
    for (let k = 1; k < trail.length; k++) {
      svg += '<line x1="' + trail[k - 1].x + '" y1="' + trail[k - 1].y + '" x2="' + trail[k].x + '" y2="' + trail[k].y +
             '" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round" opacity="' + (k / trail.length * 0.9) + '"/>';
    }
    const p = planeXY(f);
    const shift = drawn.filter(d => Math.hypot(d.x - p.x, d.y - p.y) < 26).length * 26;   // move the name down if planes overlap
    drawn.push(p);
    svg += '<g transform="translate(' + p.x + ',' + p.y + ')">' +
           '<circle r="14" fill="' + color + '" opacity="0.22"/>' +
           '<path d="' + PLANE_SHAPE + '" fill="' + color + '" stroke="#ffffff" stroke-width="1.2" transform="rotate(' + p.angle + ') scale(1.45)"/>' +
           '<text class="planeName" x="18" y="' + (shift - 5) + '">' + f.id + '</text>' +
           '<text class="planeInfo" x="18" y="' + (shift + 9) + '">' + Math.round(f.altitude / 100) / 10 + 'k ft · ' + Math.round(f.kmLeft) + ' km</text></g>';
  });

  // crashes: a fireball for 2.5 seconds, then a fire that keeps burning
  const now = performance.now();
  crashMarks.forEach(c => {
    const t = (now - c.time) / 1000;
    if (t < 2.5) {
      svg += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (10 + t * 40) + '" fill="#f97316" opacity="' + (0.8 - t / 3.2) + '"/>' +
             '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (6 + t * 22) + '" fill="#fde047" opacity="' + (0.9 - t / 2.8) + '"/>';
    }
    const flicker = 22 + Math.sin(now / 90) * 3;
    svg += '<circle cx="' + c.x + '" cy="' + (c.y - 6) + '" r="16" fill="#ef4444" opacity="0.25"/>' +
           '<text x="' + c.x + '" y="' + (c.y + 7) + '" font-size="' + flicker + '" text-anchor="middle">🔥</text>' +
           '<text class="crashLabel" x="' + (c.x + 16) + '" y="' + (c.y - 14) + '">' + c.text + '</text>';
  });
  $('mapLive').innerHTML = svg;
}

function routeLine(route, cls, color) {
  return '<polyline class="' + cls + '" ' + (color ? 'stroke="' + color + '" ' : '') +
         'points="' + routeCurvePoints(route, 16).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + '"/>';
}

// ---------- ZOOM and MOVE ----------
// We zoom by changing the SVG "viewBox" = the part of the map we look at.
let view = { x: 0, y: 0, w: 780, h: 740 };

function setView() {
  $('map').setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  $('zoomLevel').textContent = Math.round(780 / view.w * 100) + '%';
}
function keepInside() {                                   // never move outside the map
  view.x = Math.min(Math.max(view.x, 0), 780 - view.w);
  view.y = Math.min(Math.max(view.y, 0), 740 - view.h);
}
// factor < 1 zooms in, > 1 zooms out. (cx, cy) = the map point that stays still.
function zoom(factor, cx, cy) {
  if (cx === undefined) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
  const w = Math.min(780, Math.max(130, view.w * factor)), h = w * 740 / 780;   // between 100% and 600%
  view.x = cx - (cx - view.x) * w / view.w;
  view.y = cy - (cy - view.y) * h / view.h;
  view.w = w; view.h = h;
  keepInside();
  setView();
}
function zoomReset() { view = { x: 0, y: 0, w: 780, h: 740 }; setView(); }

// Zoom so the whole route (of the plan, or of the selected flight) fills the map.
function fitRoute() {
  const f = findPlane(selectedId);
  const route = plan ? planRoute() : f ? f.route : null;
  if (!route) { zoomReset(); return; }
  const xs = route.map(c => cities[c].x), ys = route.map(c => cities[c].y);
  const w = Math.max(180, Math.max(...xs) - Math.min(...xs) + 160, (Math.max(...ys) - Math.min(...ys) + 160) * 780 / 740);
  view.w = Math.min(780, w); view.h = view.w * 740 / 780;
  view.x = (Math.min(...xs) + Math.max(...xs)) / 2 - view.w / 2;
  view.y = (Math.min(...ys) + Math.max(...ys)) / 2 - view.h / 2;
  keepInside();
  setView();
}

// Mouse: wheel = zoom, drag = move, double-click = zoom in.
function setupZoom() {
  const svg = $('map');
  const mapPoint = e => {                                   // screen point -> map point
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.addEventListener('wheel', e => { e.preventDefault(); const p = mapPoint(e); zoom(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0025), p.x, p.y); }, { passive: false });
  svg.addEventListener('dblclick', e => { const p = mapPoint(e); zoom(0.6, p.x, p.y); });
  let drag = null;
  svg.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; svg.classList.add('dragging'); });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const unitsPerPixel = 1 / svg.getScreenCTM().a;
    view.x = drag.vx - (e.clientX - drag.x) * unitsPerPixel;
    view.y = drag.vy - (e.clientY - drag.y) * unitsPerPixel;
    keepInside();
    setView();
  });
  window.addEventListener('mouseup', () => { drag = null; svg.classList.remove('dragging'); });
}

// ---------- REGIONS: buttons to zoom on one region (micro view) or all India (macro view) ----------
function drawRegionBar() {
  const hubs = cities.filter(c => c.hub).map(c => c.name);
  $('regionBar').innerHTML = '<button onclick="zoomReset()">All India</button>' + hubs.map(h =>
    '<button style="border-color:' + REGION_INFO[h][1] + ';color:' + REGION_INFO[h][1] + '" onclick="zoomRegion(' + cityIndex(h) + ')">' +
    REGION_INFO[h][0] + '</button>').join('');
}
function zoomRegion(hub) {
  const list = cities.map((c, i) => i).filter(i => cities[i].region === hub);
  const xs = list.map(c => cities[c].x), ys = list.map(c => cities[c].y);
  view.w = Math.min(780, Math.max(220, Math.max(...xs) - Math.min(...xs) + 180, (Math.max(...ys) - Math.min(...ys) + 180) * 780 / 740));
  view.h = view.w * 740 / 780;
  view.x = (Math.min(...xs) + Math.max(...xs)) / 2 - view.w / 2;
  view.y = (Math.min(...ys) + Math.max(...ys)) / 2 - view.h / 2;
  keepInside();
  setView();
}
