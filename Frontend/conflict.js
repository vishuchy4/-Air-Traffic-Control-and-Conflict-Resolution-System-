
const MIN_DISTANCE = 100;
const MIN_HEIGHT = 1000;

const DECISION_SECONDS = 30;
const TOUCH_KM = 5;
const TOUCH_FEET = 500;

let activeConflicts = [];
let waiting = false;
let resolved = 0;

let timers = {};
let crashes = [];
let incidents = 0;
let crashNotice = null;
let acted = {};
let lastKm = {};

function findFlight(id) {
  if (!Array.isArray(flights)) return null;
  return flights.find(f => f && f.id === id) || null;
}

function planePosition(plane) {
  if (!plane || !Array.isArray(plane.route)) return null;
  return pointAt(plane.route, plane.leg, plane.progress);
}

function pointAt(route, leg, t) {
  if (!Array.isArray(route) || route.length === 0) return null;

  const index = Math.max(
    0,
    Math.min(Number.isInteger(leg) ? leg : 0, route.length - 1)
  );

  const a = cities[route[index]];
  const b = cities[route[Math.min(index + 1, route.length - 1)]];

  if (!a || !b) return null;

  t = Math.max(0, Math.min(1, Number(t) || 0));

  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90
  };
}

function gapBetween(a, b) {
  const p = planePosition(a);
  const q = planePosition(b);

  if (!p || !q) {
    return { km: Infinity, feet: Infinity };
  }

  return {
    km: kmBetween(p.lat, p.lon, q.lat, q.lon),
    feet: Math.abs(a.altitude - b.altitude)
  };
}

function inConflict(a, b) {
  if (!a || !b) return false;
  if (a.status !== "flying" || b.status !== "flying") return false;

  const gap = gapBetween(a, b);

  return gap.km < MIN_DISTANCE && gap.feet < MIN_HEIGHT;
}

function checkConflicts() {
  const now = [];

  if (BACKEND && backendAnswer) {
    const pairs = backendConflictPairs();

    if (Array.isArray(pairs)) {
      pairs.forEach(pair => {
        if (typeof pair !== "string") return;

        const ids = pair.split("+");
        if (ids.length !== 2) return;

        const a = findFlight(ids[0]);
        const b = findFlight(ids[1]);

        if (inConflict(a, b)) now.push(pair);
      });
    }
  } else {
    for (let i = 0; i < flights.length; i++) {
      for (let j = i + 1; j < flights.length; j++) {
        const a = flights[i];
        const b = flights[j];

        if (inConflict(a, b)) {
          now.push(a.id + "+" + b.id);
        }
      }
    }
  }

  now.forEach(pair => {
    if (!activeConflicts.includes(pair)) {
      const [a, b] = pair.split("+").map(findFlight);
      if (!a || !b) return;

      timers[pair] = DECISION_SECONDS;
      lastKm[pair] = gapBetween(a, b).km;
      acted[pair] = false;

      addLog(
        "Conflict: " + a.id + " and " + b.id +
        " are too close. Conflict timer started."
      );
    }
  });

  activeConflicts.forEach(pair => {
    if (!now.includes(pair)) {
      delete timers[pair];
      delete acted[pair];
      delete lastKm[pair];

      resolved++;

      addLog(
        "Conflict fixed: " +
        pair.replace("+", " and ") +
        " are safe now."
      );
    }
  });

  activeConflicts = now;
  waiting = activeConflicts.length > 0;
}

function altitudeChanged(plane, amount) {
  return {
    ...plane,
    altitude: Math.min(40000, Math.max(20000, plane.altitude + amount))
  };
}

function changeAltitude(id, amount) {
  const plane = findFlight(id);

  if (!plane || plane.status !== "flying") {
    alert("Flight not found or is not flying.");
    return;
  }

  const old = plane.altitude;
  const updated = altitudeChanged(plane, amount);

  if (updated.altitude === old) {
    alert("Altitude must stay between 20,000 and 40,000 ft.");
    return;
  }

  plane.altitude = updated.altitude;
  markActed(id);

  addLog(
    "You changed " + id + " altitude: " +
    old + " to " + plane.altitude + " ft."
  );

  afterAction(false);
}

function speedChanged(plane, amount) {
  return {
    ...plane,
    speed: Math.min(900, Math.max(500, plane.speed + amount))
  };
}

function changeSpeed(id, amount) {
  const plane = findFlight(id);

  if (!plane || plane.status !== "flying") {
    alert("Flight not found or is not flying.");
    return;
  }

  const old = plane.speed;
  const updated = speedChanged(plane, amount);

  if (updated.speed === old) {
    alert("Speed must stay between 500 and 900 km/h.");
    return;
  }

  plane.speed = updated.speed;
  markActed(id);

  addLog(
    "You changed " + id + " speed: " +
    old + " to " + plane.speed + " km/h."
  );

  afterAction(true);
}

function routeChanged(plane) {
  if (!plane || !Array.isArray(plane.route)) return null;

  const last = plane.route.length - 1;
  if (last < 1) return null;

  let startLeg;
  let banned;

  if (plane.progress < 0.3) {
    startLeg = plane.leg;
    banned = [
      plane.route[plane.leg],
      plane.route[plane.leg + 1]
    ];
  } else if (plane.leg + 1 < last) {
    startLeg = plane.leg + 1;
    banned = [
      plane.route[plane.leg + 1],
      plane.route[plane.leg + 2]
    ];
  } else {
    return null;
  }

  const start = plane.route[startLeg];
  const destination = plane.route[last];

  if (start === undefined || destination === undefined) return null;

  const answer = dijkstra(start, destination, banned);

  if (!answer || !Array.isArray(answer.path) || answer.path.length === 0) {
    return null;
  }

  if (
    answer.path[0] !== start ||
    answer.path[answer.path.length - 1] !== destination
  ) {
    return null;
  }

  const copy = {
    ...plane,
    route: plane.route.slice(0, startLeg).concat(answer.path)
  };

  if (startLeg === plane.leg) copy.progress = 0;

  return copy;
}

function changeRoute(id) {
  const plane = findFlight(id);

  if (!plane || plane.status !== "flying") {
    alert("Flight not found or is not flying.");
    return;
  }

  const copy = routeChanged(plane);

  if (!copy) {
    alert(
      id + " cannot be rerouted from its current position. " +
      "Try changing altitude or speed."
    );
    return;
  }

  if (copy.progress !== plane.progress) {
    plane.progress = copy.progress;
    plane.trail = [];
  }

  plane.route = copy.route;
  markActed(id);

  addLog(
    "You rerouted " + id + ": " +
    plane.route.map(c => cities[c].name).join(" › ") + "."
  );

  afterAction(true);
}

function afterAction(needsTime) {
  if (BACKEND) pollBackend();

  checkConflicts();

  waiting = needsTime ? false : activeConflicts.length > 0;

  showPanels();
}

function markActed(id) {
  activeConflicts.forEach(pair => {
    if (pair.split("+").includes(id)) {
      acted[pair] = true;
    }
  });
}

function tickTimers(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  activeConflicts.slice().forEach(pair => {
    const [a, b] = pair.split("+").map(findFlight);

    if (
      !a || !b ||
      a.status !== "flying" ||
      b.status !== "flying"
    ) {
      return;
    }

    const gap = gapBetween(a, b);
    const previousKm = lastKm[pair];
    const closing = gap.km < previousKm;

    lastKm[pair] = gap.km;

    if (
      closing &&
      gap.km < TOUCH_KM &&
      gap.feet < TOUCH_FEET
    ) {
      crash(pair, "touch");
      return;
    }

    if (typeof timers[pair] !== "number") {
      timers[pair] = DECISION_SECONDS;
    }

    timers[pair] -= seconds;

    if (timers[pair] <= 0) {
      crash(pair, "time");
    }
  });

  showPanels();
}

function crash(pair, why) {
  const [a, b] = pair.split("+").map(findFlight);

  if (!a || !b) return;
  if (a.status !== "flying" || b.status !== "flying") return;

  const p = planePosition(a);
  const q = planePosition(b);

  if (!p || !q) return;

  const spot = {
    x: (p.x + q.x) / 2,
    y: (p.y + q.y) / 2,
    lat: (p.lat + q.lat) / 2,
    lon: (p.lon + q.lon) / 2
  };

  const near = nearestCity(spot);

  a.status = "crashed";
  b.status = "crashed";

  a.crashNear = near;
  b.crashNear = near;

  incidents++;

  crashes.push({
    x: spot.x,
    y: spot.y,
    time: performance.now(),
    text: a.id + " + " + b.id
  });

  const reason = why === "touch"
    ? "The aircraft came within " + TOUCH_KM +
      " km of each other at nearly the same altitude."
    : "The conflict was not resolved within " +
      DECISION_SECONDS + " seconds.";

  a.crashWhy = reason;
  b.crashWhy = reason;

  crashNotice = {
    a: a,
    b: b,
    near: near,
    reason: reason
  };

  addLog(
    "Crash: " + a.id + " and " + b.id +
    " collided near " + near + ". " + reason
  );

  activeConflicts = activeConflicts.filter(k => {
    const ids = k.split("+");
    const involvesCrashedPlane =
      ids.includes(a.id) || ids.includes(b.id);

    if (involvesCrashedPlane) {
      delete timers[k];
      delete acted[k];
      delete lastKm[k];
    }

    return !involvesCrashedPlane;
  });

  waiting = activeConflicts.length > 0;

  shakeMap();
  showPanels();
}
