// weather.js : weather for every city. Same idea as the Weather class in C++.
// Where does a city's weather come from? src =
//   'none'   : nothing yet (shown as "No data", never as fake sunshine)
//   'live'   : real, from Open-Meteo
//   'hand'   : set by clicking the city (for the demo)
//   'sample' : sample numbers, ONLY when live weather cannot load and the user presses "Use sample weather"

const NO_DATA = { src: 'none', temp: 0, wind: 0, rain: 0, code: 0 };
const weather = cities.map(() => ({ ...NO_DATA }));
let weatherTime = '';        // when live weather last arrived
let weatherFailed = false;   // true if the live request did not work

// PENALTY = extra cost that bad weather adds to roads leaving that city.
function weatherPenalty(i) {
  const w = weather[i];
  if (w.src === 'none') return 0;
  return penaltyFromValues(w.wind, w.rain, w.code);
}
// The same rule for any weather values (penaltyFor() in backend/weather.cpp)
function penaltyFromValues(wind, rain, code) {
  let penalty = 0;
  if (wind > 40) penalty += 2;                         // strong wind (km/h)
  if (rain > 5) penalty += 2;                          // heavy rain (mm)
  if (code === 45 || code === 48) penalty += 3;        // fog
  if (code >= 95) penalty += 3;                        // thunderstorm
  return penalty;
}

// Weather code -> emoji and words.
function weatherLook(code) {
  if (code >= 95) return ['⛈️', 'Thunderstorm'];
  if (code >= 80) return ['🌦️', 'Rain showers'];
  if (code >= 61) return ['🌧️', 'Rain'];
  if (code >= 51) return ['🌦️', 'Drizzle'];
  if (code >= 45) return ['🌫️', 'Fog'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code >= 1) return ['⛅', 'Partly cloudy'];
  return ['☀️', 'Clear sky'];
}
const SOURCE_TAG = { live: '', hand: ' · by hand', sample: '', none: '' };

// One line about a city's weather.
function weatherLine(i) {
  const w = weather[i];
  if (w.src === 'none') return cities[i].name + ': weather not available';
  const look = weatherLook(w.code), p = weatherPenalty(i);
  return look[0] + ' ' + cities[i].name + ': ' + look[1] + ', ' + Math.round(w.temp) + '°C, wind ' + Math.round(w.wind) + ' km/h' +
         (p ? ' (bad weather, +' + p + ')' : '') + (w.src === 'hand' ? ' [set by hand]' : '');
}
function badWeatherCount() {
  return cities.filter((c, i) => weatherPenalty(i) > 0).length;
}

// Where the weather on screen comes from, in one sentence.
function weatherStatus() {
  const sample = weather.some(w => w.src === 'sample');
  if (sample) return '<b>Sample weather</b> (not real).';
  if (weatherTime) return '<b>Live weather</b> from Open-Meteo, updated <b>' + weatherTime + '</b>';
  if (weatherFailed) return '<b>Live weather unavailable.</b>';
  return 'Loading live weather...';
}

// LIVE WEATHER: Open-Meteo (free, no key). All 26 cities in one request.
async function loadWeather() {
  const lats = cities.map(c => c.lat).join(',');
  const lons = cities.map(c => c.lon).join(',');
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lons +
              '&current=temperature_2m,wind_speed_10m,precipitation,weather_code';
  try {
    const response = await fetch(url);
    const data = await response.json();               // a list: one item per city
    data.forEach((item, i) => {
      if (weather[i].src === 'hand') return;          // keep weather set by hand
      weather[i] = { src: 'live', temp: item.current.temperature_2m, wind: item.current.wind_speed_10m,
                     rain: item.current.precipitation, code: item.current.weather_code };
    });
    weatherTime = new Date().toLocaleTimeString();
    weatherFailed = false;
    addLog('Live weather updated for ' + cities.length + ' cities.');
  } catch (error) {
    weatherFailed = true;
  }
  if (plan) refreshPlanRoutes();
  showPanels();
}

// SAMPLE WEATHER: [temp °C, wind km/h, rain mm, weather code]. Only used when the user asks for it.
const SAMPLE = {
  Delhi: [31, 12, 0, 1], Mumbai: [29, 26, 7, 63], Bengaluru: [24, 14, 0, 3], Chennai: [32, 18, 0, 2],
  Kolkata: [28, 48, 9, 95], Hyderabad: [29, 13, 0, 1], Ahmedabad: [33, 15, 0, 0], Pune: [27, 12, 1, 61],
  Jaipur: [32, 16, 0, 0], Lucknow: [30, 10, 0, 2], Chandigarh: [27, 9, 0, 1], Dehradun: [24, 8, 2, 61],
  Agra: [32, 11, 0, 0], Bhopal: [28, 13, 0, 2], Indore: [27, 14, 0, 3], Nagpur: [30, 12, 0, 1],
  Patna: [31, 20, 3, 80], Varanasi: [31, 12, 0, 1], Guwahati: [26, 22, 6, 81], Bhubaneswar: [29, 28, 4, 80],
  Visakhapatnam: [29, 24, 0, 2], Kochi: [27, 20, 8, 63], Thiruvananthapuram: [28, 18, 5, 61], Goa: [28, 22, 4, 80],
  Srinagar: [14, 5, 0, 45], Raipur: [30, 11, 0, 1],
};
function useSampleWeather() {
  cities.forEach((c, i) => {
    if (weather[i].src === 'hand') return;
    const [temp, wind, rain, code] = SAMPLE[c.name];
    weather[i] = { src: 'sample', temp: temp, wind: wind, rain: rain, code: code };
  });
  addLog('Sample weather turned on (not real data).');
  if (plan) refreshPlanRoutes();
  showPanels();
}

// DEMO: click a city to change its weather: Clear -> Thunderstorm -> Fog -> Heavy rain -> Clear ...
const HAND_WEATHER = [
  { temp: 28, wind: 10, rain: 0, code: 0 },     // clear
  { temp: 26, wind: 55, rain: 12, code: 95 },   // thunderstorm (+7)
  { temp: 14, wind: 5, rain: 0, code: 45 },     // fog (+3)
  { temp: 24, wind: 45, rain: 10, code: 65 },   // heavy rain (+4)
];
function cycleWeather(i) {
  const w = weather[i];
  const now = w.src === 'hand' ? HAND_WEATHER.findIndex(h => h.code === w.code) : -1;
  const next = HAND_WEATHER[(now + 1) % HAND_WEATHER.length];
  weather[i] = { src: 'hand', temp: next.temp, wind: next.wind, rain: next.rain, code: next.code };
  addLog(cities[i].name + ': weather set by hand to ' + weatherLook(next.code)[1] + ' (penalty +' + weatherPenalty(i) + ').');
  if (plan) refreshPlanRoutes();                      // route options may change with the weather
  showPanels();
}
function backToLive() {
  weather.forEach((w, i) => { if (w.src !== 'live') weather[i] = { ...NO_DATA }; });
  weatherFailed = false;
  addLog('Back to live weather.');
  loadWeather();
}

// Buttons shown next to the status sentence.
function weatherButtons() {
  const notLive = !weatherTime || weather.some(w => w.src === 'sample');
  return (notLive && !weather.some(w => w.src === 'sample') ? ' <button class="mini go" onclick="useSampleWeather()">Use sample weather</button>' : '') +
         (weather.some(w => w.src === 'hand' || w.src === 'sample') ? ' <button class="mini" onclick="backToLive()">Back to live</button>' : '');
}

// The WEATHER STRIP under the radar: always visible, slowly scrolling (stops when the mouse is on it).
let lastStrip = '';
function showWeatherStrip() {
  const order = cities.map((c, i) => i).sort((a, b) => weatherPenalty(b) - weatherPenalty(a) || cities[a].name.localeCompare(cities[b].name));
  const known = order.filter(i => weather[i].src !== 'none');
  const chips = known.map(i => {
    const w = weather[i], look = weatherLook(w.code), p = weatherPenalty(i);
    return '<span class="wchip' + (p ? ' bad' : '') + '" onclick="cycleWeather(' + i + ')">' + look[0] + ' <b>' + cities[i].name + '</b> ' +
           Math.round(w.temp) + '° · ' + Math.round(w.wind) + ' km/h' + (p ? ' · +' + p : '') + SOURCE_TAG[w.src] + '</span>';
  }).join('');
  const html = '<div class="wstatus">' + weatherStatus() + weatherButtons() + '</div>' +
    (chips ? '<div class="ticker"><div class="track">' + chips + chips + '</div></div>'
           : '<div class="small muted">No weather data yet.</div>');
  if (html !== lastStrip) { $('weatherStrip').innerHTML = html; lastStrip = html; }   // only redraw when it changed (keeps the scroll smooth)
}

// The WEATHER TAB: every city as a small card.
function weatherTabHTML() {
  let html = '<p class="small">' + weatherStatus() + weatherButtons() + '</p>' +
             '<p class="small muted">Click a city to change its weather (for the demo).</p>' +
             '<div class="wgrid">';
  cities.map((c, i) => i).sort((a, b) => weatherPenalty(b) - weatherPenalty(a) || cities[a].name.localeCompare(cities[b].name)).forEach(i => {
    const w = weather[i], p = weatherPenalty(i), has = w.src !== 'none';
    const look = has ? weatherLook(w.code) : ['—', 'No data'];
    html += '<div class="wcard' + (p ? ' bad' : '') + (has ? '' : ' dim') + '" onclick="cycleWeather(' + i + ')">' +
            '<div class="wtop"><span>' + look[0] + '</span><b>' + (has ? Math.round(w.temp) + '°' : '') + '</b>' +
            (p ? '<i>+' + p + '</i>' : '') + '</div>' +
            '<div class="wname">' + cities[i].name + '</div>' +
            '<div class="wsub">' + look[1] + (has ? ' · ' + Math.round(w.wind) + ' km/h' : '') + SOURCE_TAG[w.src] + '</div></div>';
  });
  return html + '</div>';
}

// ---------- SEVERE WEATHER on the route of a flight that is ALREADY flying ----------
// Severe = penalty 3 or more (fog, thunderstorm, or strong wind + heavy rain together).
// The system only WARNS and SUGGESTS a route around the storm. The controller decides: Reroute or Keep route.
const SEVERE = 3;
let keptRoutes = [];         // alerts the controller chose to ignore ("Keep route")
let weatherReroutes = 0;     // how many times the controller flew a plane around bad weather

function weatherAlerts() {
  const list = [];
  flights.forEach(f => {
    if (f.status !== 'flying') return;
    const dest = f.route[f.route.length - 1];
    const ahead = f.route.slice(f.leg + 1, -1);                     // cities still to pass (not the destination)
    const storms = ahead.filter(c => weatherPenalty(c) >= SEVERE);
    if (storms.length) {
      const key = f.id + '@' + storms.join(',');
      if (!keptRoutes.includes(key)) list.push({ plane: f, key: key, kind: 'route', cities: storms, fix: stormReroute(f, storms) });
    } else if (weatherPenalty(dest) >= SEVERE) {
      const key = f.id + '@dest' + dest;
      if (!keptRoutes.includes(key)) list.push({ plane: f, key: key, kind: 'dest', cities: [dest], fix: null });
    }
  });
  return list;
}

// A new route that does not pass through the storm cities (or null if it is too late / impossible).
function stormReroute(plane, storms) {
  let startLeg;
  if (plane.progress < 0.3) startLeg = plane.leg;                               // just took off: can turn back
  else if (!storms.includes(plane.route[plane.leg + 1])) startLeg = plane.leg + 1;   // change after the next city
  else return null;                                                             // already flying into the storm city
  const dest = plane.route[plane.route.length - 1];
  const answer = dijkstra(plane.route[startLeg], dest, null, storms);
  if (!answer) return null;
  const route = plane.route.slice(0, startLeg).concat(answer.path);
  return { route: route, startLeg: startLeg, extraKm: routeKm(route) - routeKm(plane.route) };
}

// Controller presses "Fly around it".
function applyStormReroute(id) {
  const alert = weatherAlerts().find(a => a.plane.id === id);
  if (!alert || !alert.fix) return;
  const plane = alert.plane;
  if (alert.fix.startLeg === plane.leg && plane.progress > 0) { plane.progress = 0; plane.trail = []; }   // turns back to its city
  plane.route = alert.fix.route;
  weatherReroutes++;
  addLog('You flew ' + id + ' around bad weather at ' + alert.cities.map(c => cities[c].name).join(', ') + ': ' + plane.route.map(c => cities[c].name).join(' › ') + '.');
  checkConflicts();
  showPanels();
}
// Controller presses "Keep route".
function keepRoute(key) {
  keptRoutes.push(key);
  addLog('You kept the route of ' + key.split('@')[0] + ' through the bad weather.');
  showPanels();
}

// The weather alerts for the Safety tab.
function weatherAlertsHTML(list) {
  if (!list.length) return '<div class="okbox">No severe weather on any flight route.</div>';
  return list.map(a => {
    const where = a.cities.map(c => weatherLook(weather[c].code)[0] + ' ' + cities[c].name + ' (' + weatherLook(weather[c].code)[1].toLowerCase() + ', +' + weatherPenalty(c) + ')').join(', ');
    if (a.kind === 'dest') {
      return '<div class="wxalert"><b>' + a.plane.id + '</b>: bad weather at its destination ' + where + '. It cannot avoid its destination. ' +
        'Real ATC would make it hold or divert. <button class="mini" onclick="keepRoute(\'' + a.key + '\')">OK</button></div>';
    }
    const fix = a.fix;
    return '<div class="wxalert"><b>' + a.plane.id + '</b> will fly through ' + where + '.<br>' +
      (fix ? 'Way around: ' + fix.route.slice(fix.startLeg).map(c => cities[c].name).join(' › ') + ' (' + (fix.extraKm >= 0 ? '+' : '') + Math.round(fix.extraKm) + ' km, ' +
             (fix.extraKm >= 0 ? '+' : '') + Math.round(fix.extraKm / a.plane.speed * 60) + ' min). ' +
             '<button class="mini go" onclick="applyStormReroute(\'' + a.plane.id + '\')">Fly around it</button>'
           : 'Too late to avoid it (already flying into that city), or no other way. ') +
      '<button class="mini" onclick="keepRoute(\'' + a.key + '\')">Keep route</button></div>';
  }).join('');
}

// ---------- CITY WEATHER SEARCH + THE LAST 5 DAYS ----------
// 1. Find the place: one of our 26 cities, or any city through the Open-Meteo city search.
// 2. Get its weather now and for the last 5 days (+ today) from Open-Meteo.
// 3. Penalty of each day: from the C++ backend when it runs (penaltyFor), else the same rule here.
let searchResult = null;

async function searchWeather() {
  const text = $('weatherSearch').value.trim();
  if (!text) return;
  searchResult = { loading: true, name: text };
  showSearchResult();
  try {
    let place;
    const ours = cities.findIndex(c => c.name.toLowerCase() === text.toLowerCase());
    if (ours >= 0) {
      place = { name: cities[ours].name, lat: cities[ours].lat, lon: cities[ours].lon, where: cityType(ours), inNetwork: true };
    } else {
      const geo = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(text))).json();
      if (!geo.results || !geo.results.length) {
        searchResult = { error: 'No place called "' + text + '" was found. Check the spelling.' };
        showSearchResult();
        return;
      }
      const r = geo.results[0];
      place = { name: r.name, lat: r.latitude, lon: r.longitude, where: [r.admin1, r.country].filter(Boolean).join(', '), inNetwork: false };
    }

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
      '&past_days=5&forecast_days=1&timezone=auto';
    const data = await (await fetch(url)).json();
    const d = data.daily;
    const days = d.time.map((date, k) => ({
      date: date, code: d.weather_code[k], max: d.temperature_2m_max[k], min: d.temperature_2m_min[k],
      rain: d.precipitation_sum[k], wind: d.wind_speed_10m_max[k],
    }));
    const penalties = await dayPenalties(days);
    days.forEach((day, k) => { day.penalty = penalties[k]; });
    searchResult = { ...place, current: data.current, days: days };
  } catch (error) {
    searchResult = { error: 'Weather search needs internet. Open-Meteo could not be reached.' };
  }
  showSearchResult();
}

async function dayPenalties(days) {
  if (BACKEND) {
    try {
      const answer = await askBackend('/api/penalty', { rows: days.map(d => [d.wind || 0, d.rain || 0, d.code || 0].join(',')).join(';') });
      if (answer.penalties.length === days.length) return answer.penalties;
    } catch (error) { /* fall back to the same rule here */ }
  }
  return days.map(d => penaltyFromValues(d.wind || 0, d.rain || 0, d.code || 0));
}

function showSearchResult() {
  setHTML('weatherSearchResult', searchResultHTML());
}

function searchResultHTML() {
  const r = searchResult;
  if (!r) return '';
  if (r.loading) return '<p class="muted">Searching ' + r.name + '...</p>';
  if (r.error) return '<div class="waitbox">' + r.error + '</div>';

  const value = (v, unit) => (v === null || v === undefined) ? '-' : Math.round(v) + unit;
  const dayName = (date, k) => k === r.days.length - 1 ? 'Today' :
    new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const past = r.days.slice(0, -1);                      // the last 5 days (without today)
  const known = list => list.filter(v => v !== null && v !== undefined);
  const average = list => known(list).length ? known(list).reduce((a, b) => a + b, 0) / known(list).length : null;
  const total = list => known(list).reduce((a, b) => a + b, 0);
  const now = r.current || {};
  const look = weatherLook(now.weather_code || 0);

  let html = '<div class="card searchCard">' +
    '<h3>' + r.name + '</h3><p class="small muted">' + r.where + (r.inNetwork ? '' : ' · not in the AeroGuard network') + '</p>' +
    '<p class="nowLine">' + look[0] + ' <b>' + value(now.temperature_2m, '°C') + '</b> ' + look[1] +
      ' · humidity ' + value(now.relative_humidity_2m, '%') + ' · wind ' + value(now.wind_speed_10m, ' km/h') +
      ' · rain ' + (now.precipitation ?? '-') + ' mm</p>' +
    '<div class="score five">' +
      '<div><b>' + value(average(past.map(d => d.max)), '°') + '</b><span>Average high</span></div>' +
      '<div><b>' + value(average(past.map(d => d.min)), '°') + '</b><span>Average low</span></div>' +
      '<div><b>' + total(past.map(d => d.rain)).toFixed(1) + ' mm</b><span>Total rain</span></div>' +
      '<div><b>' + value(Math.max(...known(past.map(d => d.wind)), 0), ' km/h') + '</b><span>Strongest wind</span></div>' +
      '<div class="' + (past.some(d => d.penalty > 0) ? 'bad' : '') + '"><b>' + past.filter(d => d.penalty > 0).length + ' of 5</b><span>Bad-weather days</span></div>' +
    '</div>' + weatherChart(r.days, dayName) +
    '<div class="tableWrap"><table class="ptable days"><tr><th>Day</th><th>Weather</th><th>High</th><th>Low</th><th>Rain</th><th>Max wind</th><th>Penalty</th></tr>';
  r.days.forEach((d, k) => {
    const l = weatherLook(d.code || 0);
    html += '<tr' + (k === r.days.length - 1 ? ' class="today"' : '') + '><td>' + dayName(d.date, k) + '</td><td>' + l[0] + ' ' + l[1] + '</td><td>' +
      value(d.max, '°') + '</td><td>' + value(d.min, '°') + '</td><td>' + (d.rain ?? '-') + ' mm</td><td>' + value(d.wind, ' km/h') +
      '</td><td><span class="pen' + (d.penalty >= 3 ? ' severe' : d.penalty > 0 ? ' bad' : '') + '">+' + d.penalty + '</span></td></tr>';
  });
  return html + '</table></div><p class="small muted">Penalty: the AeroGuard rule on each day: strongest wind over 40 km/h +2, rain over 5 mm +2, fog +3, thunderstorm +3. 3 or more is severe. Data: Open-Meteo.</p></div>';
}

// A small chart: rain as blue bars, highest and lowest temperature as lines.
function weatherChart(days, dayName) {
  // top part: the 2 temperature lines. Bottom strip (50 px): the rain bars. So they never cover each other.
  const W = 640, H = 230, left = 36, right = 36, top = 22, bottom = 30, rainStrip = 50;
  const step = (W - left - right) / days.length;
  const temps = days.flatMap(d => [d.max, d.min]).filter(v => v !== null && v !== undefined);
  const tMin = Math.floor(Math.min(...temps) / 5) * 5 - 5, tMax = Math.ceil(Math.max(...temps) / 5) * 5;
  const rMax = Math.max(5, ...days.map(d => d.rain || 0));
  const x = k => left + step * k + step / 2;
  const tempBottom = H - bottom - rainStrip - 18;                       // lowest point of the temperature lines
  const yT = t => top + (tempBottom - top) * (1 - (t - tMin) / (tMax - tMin));
  const yR = r => H - bottom - (rainStrip - 12) * (r / rMax);
  const line = key => days.map((d, k) => (d[key] === null || d[key] === undefined) ? '' : (k ? 'L' : 'M') + x(k) + ' ' + yT(d[key])).join(' ').replace(/^ *L/, 'M');

  let svg = '<svg class="wchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Rain and temperature, last 5 days and today">';
  svg += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + (H - bottom) + '" y2="' + (H - bottom) + '" class="cBase"/>';
  days.forEach((d, k) => {
    const h = (H - bottom) - yR(d.rain || 0);
    svg += '<rect x="' + (x(k) - step * 0.22) + '" y="' + yR(d.rain || 0) + '" width="' + step * 0.44 + '" height="' + h + '" class="rainBar"/>' +
           '<text x="' + x(k) + '" y="' + (H - 10) + '" class="cLabel">' + dayName(d.date, k) + '</text>' +
           ((d.rain || 0) > 0 ? '<text x="' + x(k) + '" y="' + (yR(d.rain) - 4) + '" class="cRain">' + d.rain + ' mm</text>' : '');
  });
  svg += '<path d="' + line('max') + '" class="tMaxLine"/><path d="' + line('min') + '" class="tMinLine"/>';
  days.forEach((d, k) => {
    if (d.max !== null && d.max !== undefined) svg += '<circle cx="' + x(k) + '" cy="' + yT(d.max) + '" r="3.5" class="tMaxDot"/><text x="' + x(k) + '" y="' + (yT(d.max) - 8) + '" class="cMax">' + Math.round(d.max) + '°</text>';
    if (d.min !== null && d.min !== undefined) svg += '<circle cx="' + x(k) + '" cy="' + yT(d.min) + '" r="3.5" class="tMinDot"/><text x="' + x(k) + '" y="' + (yT(d.min) + 16) + '" class="cMin">' + Math.round(d.min) + '°</text>';
  });
  return svg + '</svg><p class="small muted chartKey"><span class="k1"></span> highest temperature <span class="k2"></span> lowest temperature <span class="k3"></span> rain (mm)</p>';
}
