
const CX = 330, CY = 372;
const PX_PER_KM = 24 / 111;
const PLANE_SHAPE = 'M0-12L3-3 12 3V6L3 4 2 10 6 13V15L0 13-6 15V13L-2 10-3 4-12 6V3L-3-3Z';

function drawBackground() {
  let svg = '<defs>' +
    '<radialGradient id="scope" cx="' + CX + '" cy="' + CY + '" r="420" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#dce9f8"/><stop offset="1" stop-color="#ffffff"/></radialGradient>' +
    '<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="' + CX + '" y1="0" x2="' + (CX + 300) + '" y2="0">' +
    '<stop offset="0" stop-color="#2f7fd6" stop-opacity="0"/><stop offset="1" stop-color="#2f7fd6" stop-opacity=".24"/></linearGradient>' +
    '</defs><rect width="780" height="740" fill="url(#scope)"/>';

  [500, 1000, 1500].forEach(km => {
    const r = km * PX_PER_KM;
    svg += '<circle class="ring" cx="' + CX + '" cy="' + CY + '" r="' + r + '"/>' +
      '<text class="ringLabel" x="' + (CX + r * 0.26 + 4) + '" y="' + (CY + r * 0.97 - 4) + '">' + km + ' km</text>';
  });

  const R = 1550 * PX_PER_KM;

  for (let deg = 0; deg < 360; deg += 10) {
    const a = deg * Math.PI / 180;
    const len = deg % 30 === 0 ? 12 : 6;

    svg += '<line class="tick" x1="' + (CX + Math.sin(a) * R) +
      '" y1="' + (CY - Math.cos(a) * R) +
      '" x2="' + (CX + Math.sin(a) * (R - len)) +
      '" y2="' + (CY - Math.cos(a) * (R - len)) + '"/>';
  }

  svg += '<text class="compass" x="' + CX + '" y="' + (CY - R - 6) + '">N</text>' +
    '<text class="compass" x="' + (CX + R + 12) + '" y="' + (CY + 5) + '">E</text>' +
    '<text class="compass" x="' + CX + '" y="' + (CY + R + 18) + '">S</text>' +
    '<text class="compass" x="14" y="' + (CY + 5) + '">W</text>';

  svg += '<line class="cross" x1="' + CX + '" y1="0" x2="' + CX + '" y2="740"/>' +
    '<line class="cross" x1="0" y1="' + CY + '" x2="780" y2="' + CY + '"/>';

  edges.forEach(e => {
    if (e.from < e.to && cities[e.from] && cities[e.to]) {
      const sameRegion = cities[e.from].region === cities[e.to].region;
      const color = sameRegion ? regionColor(e.from) : '#a9b8c8';

      svg += '<line class="road" style="stroke:' + color +
        '" x1="' + cities[e.from].x + '" y1="' + cities[e.from].y +
        '" x2="' + cities[e.to].x + '" y2="' + cities[e.to].y + '"/>';
    }
  });

  const end = {
    x: CX + Math.sin(Math.PI / 4) * R,
    y: CY - Math.cos(Math.PI / 4) * R
  };

  svg += '<g class="sweep"><path d="M' + CX + ' ' + CY +
    ' L' + CX + ' ' + (CY - R) +
    ' A' + R + ' ' + R + ' 0 0 1 ' + end.x + ' ' + end.y +
    ' Z" fill="url(#beam)"/><line x1="' + CX + '" y1="' + CY +
    '" x2="' + end.x + '" y2="' + end.y +
    '" class="beamLine"/></g>';

  $('mapBg').innerHTML = svg;
  drawRegionBar();
}

function drawMap() {
  let svg = '';

  if (plan && Array.isArray(plan.options)) {
    plan.options.forEach((opt, k) => {
      if (k !== plan.choice && Array.isArray(opt.path)) {
        svg += routeLine(opt.path, 'optLine');
      }
    });
  }

  flights.forEach(f => {
    if (f.status === 'flying' && Array.isArray(f.route)) {
      svg += routeLine(
        f.route,
        f.id === selectedId ? 'flightLine big' : 'flightLine',
        TYPES[f.type].color
      );
    }
  });

  if (plan && Array.isArray(plan.route)) {
    svg += routeLine(plan.route, 'planLine');
  }

  const used = new Set();

  if (plan && Array.isArray(plan.route)) {
    plan.route.forEach(c => used.add(c));
  }

  flights.forEach(f => {
    if (f.status === 'flying' && Array.isArray(f.route)) {
      f.route.forEach(c => used.add(c));
    }
  });

  cities.forEach((c, i) => {
    const on = used.has(i);
    const hub = HUBS.includes(c.name);
    const left = LEFT_LABELS.includes(c.name);
    const tx = left ? c.x - 9 : c.x + 9;
    const anchor = left ? 'end' : 'start';

    const regionStyle = on
      ? ''
      : hub
        ? ' style="stroke:' + regionColor(i) + '"'
        : ' style="fill:' + regionColor(i) + '"';

    svg += '<circle class="' + (on ? 'stop' : hub ? 'hub' : 'dot') +
      '"' + regionStyle + ' cx="' + c.x + '" cy="' + c.y +
      '" r="' + (on ? 7 : hub ? 7.5 : 4.2) + '"/>' +
      '<text class="' + (on ? 'nameOn' : hub ? 'nameHub' : 'name') +
      '" x="' + tx + '" y="' + (c.y + 4) +
      '" text-anchor="' + anchor + '">' + c.name + '</text>';

    const p = weatherPenalty(i);
    const w = weather[i];

    if (w && w.src !== 'none' && (p || hub)) {
      svg += '<text class="' + (p ? 'wxIcon' : 'wxHub') +
        '" x="' + tx + '" y="' + (c.y + 18) +
        '" text-anchor="' + anchor + '">' +
        weatherLook(w.code)[0] + ' ' + Math.round(w.temp) +
        '°' + (p ? ' +' + p : '') + '</text>';
    }
  });

  const beat = (performance.now() / 1000) % 1;

  const ring = pt =>
    '<circle class="conflictRing" cx="' + pt.x +
    '" cy="' + pt.y + '" r="' + (12 + beat * 18) +
    '" opacity="' + (1 - beat) + '"/>';

  activeConflicts.forEach(pair => {
    const [a, b] = pair.split('+').map(findFlight);

    if (!a || !b) return;

    const p = planePosition(a);
    const q = planePosition(b);

    svg += '<line class="conflictLine" x1="' + p.x +
      '" y1="' + p.y + '" x2="' + q.x +
      '" y2="' + q.y + '"/>' + ring(p) + ring(q);
  });

  predictions.slice(0, 2).forEach(pr => {
    if (!pr.p || !pr.q) return;

    svg += '<line class="predLine" x1="' + pr.p.x +
      '" y1="' + pr.p.y + '" x2="' + pr.q.x +
      '" y2="' + pr.q.y + '"/>' +
      '<circle class="ghost" cx="' + pr.p.x +
      '" cy="' + pr.p.y + '" r="9"/>' +
      '<circle class="ghost" cx="' + pr.q.x +
      '" cy="' + pr.q.y + '" r="9"/>' +
      '<text class="predLabel" x="' +
      ((pr.p.x + pr.q.x) / 2 + 12) +
      '" y="' + ((pr.p.y + pr.q.y) / 2 - 12) +
      '">in ' + pr.start + ' min</text>';
  });

  const drawn = [];

  flights.forEach(f => {
    if (f.status === 'holding') {
      const city = f.route[f.route.length - 1];
      const d = cities[city];

      if (!d) return;

      const k = Math.max(0, holdingQueue(city).indexOf(f));
      const angle = performance.now() / 700 + k * 2.1;
      const r = 16 + k * 7;
      const x = d.x + Math.cos(angle) * r;
      const y = d.y + Math.sin(angle) * r;

      svg += '<circle class="holdRing" cx="' + d.x +
        '" cy="' + d.y + '" r="' + r + '"/>' +
        '<g transform="translate(' + x + ',' + y + ')">' +
        '<path d="' + PLANE_SHAPE + '" fill="' +
        TYPES[f.type].color + '" transform="rotate(' +
        (angle * 180 / Math.PI + 180) + ') scale(1.1)"/>' +
        '<text class="planeName" x="12" y="-4">' +
        f.id + ' holding #' + (k + 1) + '</text></g>';

      return;
    }

    if (f.status !== 'flying') return;

    const color = TYPES[f.type].color;

    for (let k = 1; k < f.trail.length; k++) {
      svg += '<line x1="' + f.trail[k - 1].x +
        '" y1="' + f.trail[k - 1].y +
        '" x2="' + f.trail[k].x +
        '" y2="' + f.trail[k].y +
        '" stroke="' + color +
        '" stroke-width="3.2" stroke-linecap="round" opacity="' +
        (k / f.trail.length * 0.9) + '"/>';
    }

    const p = planePosition(f);

    const shift = drawn.filter(d =>
      Math.hypot(d.x - p.x, d.y - p.y) < 26
    ).length * 26;

    drawn.push(p);

    svg += '<g transform="translate(' + p.x + ',' + p.y + ')">' +
      '<circle r="14" fill="' + color + '" opacity="0.22"/>' +
      '<path d="' + PLANE_SHAPE + '" fill="' + color +
      '" stroke="#ffffff" stroke-width="1.2" transform="rotate(' +
      p.angle + ') scale(1.45)"/>' +
      '<text class="planeName" x="18" y="' + (shift - 5) +
      '">' + f.id + '</text>' +
      '<text class="planeInfo" x="18" y="' + (shift + 9) +
      '">' + Math.round(f.altitude / 100) / 10 +
      'k ft · ' + Math.round(kmLeft(f)) + ' km</text></g>';
  });

  const now = performance.now();

  crashes.forEach(c => {
    const t = (now - c.time) / 1000;

    if (t < 2.5) {
      svg += '<circle cx="' + c.x + '" cy="' + c.y +
        '" r="' + (10 + t * 40) +
        '" fill="#f97316" opacity="' + (0.8 - t / 3.2) + '"/>' +
        '<circle cx="' + c.x + '" cy="' + c.y +
        '" r="' + (6 + t * 22) +
        '" fill="#fde047" opacity="' + (0.9 - t / 2.8) + '"/>';
    }

    const flicker = 22 + Math.sin(now / 90) * 3;

    svg += '<circle cx="' + c.x + '" cy="' + (c.y - 6) +
      '" r="16" fill="#ef4444" opacity="0.25"/>' +
      '<text x="' + c.x + '" y="' + (c.y + 7) +
      '" font-size="' + flicker +
      '" text-anchor="middle">🔥</text>' +
      '<text class="crashLabel" x="' + (c.x + 16) +
      '" y="' + (c.y - 14) + '">' + c.text + '</text>';
  });

  $('mapLive').innerHTML = svg;
}

function shakeMap() {
  const card = $('mapCard');

  if (!card) return;

  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function routeLine(route, cls, color) {
  if (!Array.isArray(route)) return '';

  const points = route
    .filter(c => cities[c])
    .map(c => cities[c].x + ',' + cities[c].y)
    .join(' ');

  return '<polyline class="' + cls + '" ' +
    (color ? 'stroke="' + color + '" ' : '') +
    'points="' + points + '"/>';
}

let view = { x: 0, y: 0, w: 780, h: 740 };

function setView() {
  $('map').setAttribute(
    'viewBox',
    view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h
  );

  $('zoomLevel').textContent =
    Math.round(780 / view.w * 100) + '%';
}

function keepInside() {
  view.x = Math.min(Math.max(view.x, 0), 780 - view.w);
  view.y = Math.min(Math.max(view.y, 0), 740 - view.h);
}

function zoom(factor, cx, cy) {
  if (cx === undefined) {
    cx = view.x + view.w / 2;
    cy = view.y + view.h / 2;
  }

  const w = Math.min(780, Math.max(130, view.w * factor));
  const h = w * 740 / 780;

  view.x = cx - (cx - view.x) * w / view.w;
  view.y = cy - (cy - view.y) * h / view.h;
  view.w = w;
  view.h = h;

  keepInside();
  setView();
}

function zoomReset() {
  view = { x: 0, y: 0, w: 780, h: 740 };
  setView();
}

function fitRoute() {
  const f = findFlight(selectedId);
  const route = plan ? plan.route : f ? f.route : null;

  if (!route || route.length === 0) {
    zoomReset();
    return;
  }

  const xs = route.map(c => cities[c].x);
  const ys = route.map(c => cities[c].y);

  const w = Math.max(
    180,
    Math.max(...xs) - Math.min(...xs) + 160,
    (Math.max(...ys) - Math.min(...ys) + 160) * 780 / 740
  );

  view.w = Math.min(780, w);
  view.h = view.w * 740 / 780;
  view.x = (Math.min(...xs) + Math.max(...xs)) / 2 - view.w / 2;
  view.y = (Math.min(...ys) + Math.max(...ys)) / 2 - view.h / 2;

  keepInside();
  setView();
}

function setupZoom() {
  const svg = $('map');
  if (!svg) return;

  const mapPoint = e => {
    const pt = svg.createSVGPoint();

    pt.x = e.clientX;
    pt.y = e.clientY;

    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  svg.addEventListener('wheel', e => {
    e.preventDefault();

    const p = mapPoint(e);
    zoom(e.deltaY < 0 ? 0.8 : 1.25, p.x, p.y);
  }, { passive: false });

  svg.addEventListener('dblclick', e => {
    const p = mapPoint(e);
    zoom(0.6, p.x, p.y);
  });

  let drag = null;

  svg.addEventListener('mousedown', e => {
    if (e.button !== 0) return;

    drag = {
      x: e.clientX,
      y: e.clientY,
      vx: view.x,
      vy: view.y
    };

    svg.classList.add('dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!drag) return;

    const matrix = svg.getScreenCTM();
    if (!matrix || !matrix.a) return;

    const unitsPerPixel = 1 / matrix.a;

    view.x = drag.vx - (e.clientX - drag.x) * unitsPerPixel;
    view.y = drag.vy - (e.clientY - drag.y) * unitsPerPixel;

    keepInside();
    setView();
  });

  window.addEventListener('mouseup', () => {
    drag = null;
    svg.classList.remove('dragging');
  });
}

function drawRegionBar() {
  const bar = $('regionBar');
  if (!bar) return;

  bar.innerHTML =
    '<button onclick="zoomReset()">All India</button>' +
    HUBS.map(h =>
      '<button style="border-color:' + REGION_INFO[h][1] +
      ';color:' + REGION_INFO[h][1] +
      '" onclick="zoomRegion(' + cityIndex(h) + ')">' +
      REGION_INFO[h][0] + '</button>'
    ).join('');
}

function zoomRegion(hub) {
  const list = cities
    .map((c, i) => i)
    .filter(i => cities[i].region === hub);

  if (list.length === 0) {
    zoomReset();
    return;
  }

  const xs = list.map(c => cities[c].x);
  const ys = list.map(c => cities[c].y);

  view.w = Math.min(
    780,
    Math.max(
      220,
      Math.max(...xs) - Math.min(...xs) + 180,
      (Math.max(...ys) - Math.min(...ys) + 180) * 780 / 740
    )
  );

  view.h = view.w * 740 / 780;
  view.x = (Math.min(...xs) + Math.max(...xs)) / 2 - view.w / 2;
  view.y = (Math.min(...ys) + Math.max(...ys)) / 2 - view.h / 2;

  keepInside();
  setView();
}
