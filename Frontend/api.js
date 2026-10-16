
let BACKEND = false;
let backendAnswer = null;
let backendTests = {};
let backendBusy = false;
let backendPollingStarted = false;

async function askBackend(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: new URLSearchParams(data)
  });

  if (!response.ok) {
    throw new Error(path + ' answered ' + response.status);
  }

  return response.json();
}

function penaltiesText() {
  return cities.map((c, i) => weatherPenalty(i)).join(',');
}

const STATUS_NUMBER = {
  flying: 0,
  landed: 1,
  crashed: 2,
  holding: 3,
  scheduled: 4
};

function planeText(p) {
  return [
    p.id,
    p.priority,
    p.route.join(','),
    p.leg,
    Number(p.progress || 0).toFixed(5),
    p.altitude,
    p.speed,
    STATUS_NUMBER[p.status] ?? 4
  ].join(';');
}

async function connectBackend() {
  try {
    const infoResponse = await fetch('/api/ping');
    if (!infoResponse.ok) throw new Error('Ping failed');

    const info = await infoResponse.json();
    if (!info.ok) throw new Error('Backend is unavailable');

    const mapResponse = await fetch('/api/airspace');
    if (!mapResponse.ok) throw new Error('Airspace request failed');

    const map = await mapResponse.json();

    const roads = Array.isArray(map.roads) ? map.roads : [];
    const mapCities = Array.isArray(map.cities) ? map.cities : [];

    const same =
      roads.length === edges.length &&
      roads.every(r => {
        const e = edgeBetween(r.from, r.to);
        return e && e.distance === r.km;
      }) &&
      mapCities.length === cities.length &&
      mapCities.every((c, i) =>
        c.macro === (cities[i].macro ? 1 : 0) &&
        c.region === cities[i].region
      );

    BACKEND = true;

    addLog(
      'Connected to the C++ backend. Airspace check: ' +
      roads.length +
      ' roads, ' +
      (same
        ? 'all distances and regions match the UI.'
        : 'DIFFERENT data from the UI!')
    );

    if (!backendPollingStarted) {
      backendPollingStarted = true;
      setInterval(() => {
        pollBackend();
      }, 250);
    }
  } catch (error) {
    BACKEND = false;
  }

  showBackendBadge();

  if (typeof showPanels === 'function') {
    showPanels();
  }
}

async function backendRoutes(from, to) {
  const answer = await askBackend('/api/routes', {
    from: from,
    to: to,
    pen: penaltiesText()
  });

  return (answer.options || []).map(o => ({
    path: o.path,
    cost: o.cost
  }));
}

async function pollBackend() {
  if (!BACKEND || backendBusy) return;

  backendBusy = true;

  try {
    backendAnswer = await askBackend('/api/check', {
      planes: flights.map(planeText).join('|'),
      pen: penaltiesText()
    });

    const predictions = Array.isArray(backendAnswer.predictions)
      ? backendAnswer.predictions
      : [];

    const first = predictions[0];

    if (first) {
      const a = findFlight(first.a);
      const b = findFlight(first.b);
      const key = first.a + '+' + first.b;

      for (const [change, other] of [[a, b], [b, a]]) {
        if (!change || !other) continue;

        const answer = await askBackend('/api/whatif', {
          change: planeText(change),
          other: planeText(other),
          pen: penaltiesText()
        });

        backendTests[change.id + '|' + key] = answer.tests || [];
      }
    }
  } catch (error) {
    BACKEND = false;
    addLog(
      'The C++ backend stopped answering. The UI continues alone (JavaScript).'
    );
    showBackendBadge();
  } finally {
    backendBusy = false;
  }
}

async function backendNow() {
  while (backendBusy) {
    await new Promise(done => setTimeout(done, 20));
  }

  await pollBackend();
}

function backendConflictPairs() {
  if (!backendAnswer || !Array.isArray(backendAnswer.conflicts)) {
    return [];
  }

  return backendAnswer.conflicts
    .filter(c => {
      const a = findFlight(c.a);
      const b = findFlight(c.b);

      return a && b &&
        a.status === 'flying' &&
        b.status === 'flying';
    })
    .map(c => c.a + '+' + c.b);
}

function backendPredictions() {
  if (!backendAnswer || !Array.isArray(backendAnswer.predictions)) {
    return [];
  }

  const toMap = pt => ({
    lat: pt.lat,
    lon: pt.lon,
    x: (pt.lon - 68) * 24 + 40,
    y: (35 - pt.lat) * 24 + 40
  });

  return backendAnswer.predictions
    .filter(pr => pr.pa && pr.pb)
    .map(pr => ({
      a: findFlight(pr.a),
      b: findFlight(pr.b),
      key: pr.a + '+' + pr.b,
      start: pr.start,
      km: pr.km,
      feet: pr.feet,
      p: toMap(pr.pa),
      q: toMap(pr.pb)
    }))
    .filter(pr =>
      pr.a &&
      pr.b &&
      pr.a.status === 'flying' &&
      pr.b.status === 'flying' &&
      !activeConflicts.includes(pr.key)
    );
}

function backendWhatIf(pr, plane) {
  const tests = backendTests[plane.id + '|' + pr.key];

  if (!Array.isArray(tests)) return null;

  return tests.map(t => ({
    kind: t.kind,
    amount: t.amount,
    label:
      t.kind === 'alt'
        ? (t.amount > 0 ? 'Raise ' : 'Lower ') +
          plane.id + ' by 1,000 ft'
        : t.kind === 'spd'
          ? 'Slow ' + plane.id + ' by 100 km/h'
          : 'Send ' + plane.id + ' on another route',
    fixes: t.result === -1 ? null : t.result === 1
  }));
}

function showBackendBadge() {
  const badge = $('backendBadge');
  if (!badge) return;

  badge.textContent = 'C++ backend: connected';
  badge.className = 'pill green' + (BACKEND ? '' : ' hidden');
}
