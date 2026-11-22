// data.js : only what the SCREEN needs: colours, where city names go, and number formats.
// All the rules and all the numbers of the air traffic system come from the C++ backend (see api.js).

const TYPE_COLOR = { Medical: '#e5394f', Rescue: '#d99100', Passenger: '#1e88d6', Cargo: '#8a5cf0', Training: '#2a9d4b' };

// Region name and colour on the radar, by hub city.
const REGION_INFO = {
  Delhi: ['North', '#2f7fd6'], Mumbai: ['West', '#8e5bd1'], Bengaluru: ['South', '#2e9e55'],
  Chennai: ['South-East', '#14958c'], Kolkata: ['East', '#c98500'], Hyderabad: ['Central', '#e0603a'],
};

// These city names are written on the left of their dot (so they do not cover other names).
const LEFT_LABELS = ['Delhi', 'Mumbai', 'Bengaluru', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Bhopal', 'Indore', 'Varanasi', 'Kochi', 'Goa'];

const SOURCE_TAG = { live: '', hand: ' · by hand', sample: '', none: '' };

// ---------- filled from the C++ backend (api.js) ----------
let INFO = null;      // /api/info  : cities, flight types, operators, aircraft, rule numbers
let ROADS = [];       // /api/airspace : the air roads
let S = null;         // /api/state : everything happening right now
let cities = [];      // INFO.cities + x, y on the radar picture

// ---------- small helpers for showing things ----------
const $ = id => document.getElementById(id);
const name = i => cities[i].name;
const cityIndex = n => cities.findIndex(c => c.name === n);
const kmText = n => Math.round(n).toLocaleString('en-IN') + ' km';
const litresText = n => Math.round(n).toLocaleString('en-IN') + ' L';
const rupees = n => '₹' + Math.round(n).toLocaleString('en-IN');
function timeText(minutes) {
  const m = Math.round(minutes);
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}

// Where a place is on the radar picture.
const mapX = lon => (lon - 68) * 24 + 40;
const mapY = lat => (35 - lat) * 24 + 40;

function regionName(i) { const hub = cities[cities[i].region].name; return REGION_INFO[hub][0] + ' (' + hub + ')'; }
function regionColor(i) { return REGION_INFO[cities[cities[i].region].name][1]; }
function cityType(i) { return cities[i].hub ? 'Hub airport' : 'Regional airport, ' + regionName(i); }
function landingGap(i) { return cities[i].hub ? INFO.landingGap.hub : INFO.landingGap.small; }

function typeInfo(type) { return INFO.flightTypes.find(t => t.name === type); }
function aircraftInfo(aircraft) { return INFO.aircraft.find(a => a.name === aircraft) || { seats: 0, cargo: 0, note: '' }; }
function capacityText(aircraft) {                   // "180 seats", "39 t cargo", "92 people or 19 t cargo"
  const a = aircraftInfo(aircraft);
  if (a.seats && a.cargo) return a.seats + ' people or ' + a.cargo + ' t cargo';
  if (a.cargo) return a.cargo + ' t cargo';
  return a.seats + ' seats';
}
function findPlane(id) { return S ? S.planes.find(p => p.id === id) : null; }

// Weather code -> picture and words (the C++ backend decides how bad the weather is).
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
