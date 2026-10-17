// data.js : all the DATA (cities, which cities are connected, flight types, fuel price).
// Same idea as addNode() and addRoute() in the C++ project.

// 1. CITIES: [name, latitude, longitude]  (city centre)
const CITIES = [
  ['Delhi', 28.61, 77.21],
  ['Mumbai', 19.08, 72.88],
  ['Bengaluru', 12.97, 77.59],
  ['Chennai', 13.08, 80.27],
  ['Kolkata', 22.57, 88.36],
  ['Hyderabad', 17.39, 78.49],
  ['Ahmedabad', 23.02, 72.57],
  ['Pune', 18.52, 73.86],
  ['Jaipur', 26.91, 75.79],
  ['Lucknow', 26.85, 80.95],
  ['Chandigarh', 30.73, 76.78],
  ['Dehradun', 30.32, 78.03],
  ['Agra', 27.18, 78.02],
  ['Bhopal', 23.26, 77.41],
  ['Indore', 22.72, 75.86],
  ['Nagpur', 21.15, 79.09],
  ['Patna', 25.59, 85.14],
  ['Varanasi', 25.32, 82.97],
  ['Guwahati', 26.14, 91.74],
  ['Bhubaneswar', 20.3, 85.82],
  ['Visakhapatnam', 17.69, 83.22],
  ['Kochi', 9.93, 76.27],
  ['Thiruvananthapuram', 8.52, 76.94],
  ['Goa', 15.38, 73.83],
  ['Srinagar', 34.08, 74.8],
  ['Raipur', 21.25, 81.63]
];

// 2. CONNECTIONS: which two cities have a direct air route (flown both ways).
//    The distance is NOT typed by hand. It is calculated from the coordinates (see kmBetween below).
const CONNECTIONS = [
  ['Delhi', 'Mumbai'], ['Delhi', 'Bengaluru'], ['Delhi', 'Chennai'], ['Delhi', 'Kolkata'],
  ['Delhi', 'Hyderabad'], ['Delhi', 'Jaipur'], ['Delhi', 'Lucknow'], ['Delhi', 'Chandigarh'],
  ['Delhi', 'Dehradun'], ['Delhi', 'Agra'], ['Delhi', 'Bhopal'], ['Delhi', 'Srinagar'],
  ['Mumbai', 'Bengaluru'], ['Mumbai', 'Chennai'], ['Mumbai', 'Kolkata'], ['Mumbai', 'Hyderabad'],
  ['Mumbai', 'Ahmedabad'], ['Mumbai', 'Pune'], ['Mumbai', 'Indore'], ['Mumbai', 'Goa'],
  ['Bengaluru', 'Chennai'], ['Bengaluru', 'Kolkata'], ['Bengaluru', 'Hyderabad'], ['Bengaluru', 'Kochi'],
  ['Bengaluru', 'Thiruvananthapuram'], ['Bengaluru', 'Goa'], ['Chennai', 'Kolkata'], ['Chennai', 'Hyderabad'],
  ['Chennai', 'Kochi'], ['Chennai', 'Thiruvananthapuram'], ['Kolkata', 'Hyderabad'], ['Kolkata', 'Patna'],
  ['Kolkata', 'Varanasi'], ['Kolkata', 'Guwahati'], ['Kolkata', 'Bhubaneswar'], ['Hyderabad', 'Pune'],
  ['Hyderabad', 'Nagpur'], ['Hyderabad', 'Visakhapatnam'], ['Hyderabad', 'Raipur'], ['Ahmedabad', 'Bhopal'],
  ['Ahmedabad', 'Indore'], ['Pune', 'Goa'], ['Jaipur', 'Chandigarh'], ['Jaipur', 'Agra'],
  ['Jaipur', 'Bhopal'], ['Lucknow', 'Agra'], ['Lucknow', 'Patna'], ['Lucknow', 'Varanasi'],
  ['Chandigarh', 'Dehradun'], ['Chandigarh', 'Agra'], ['Chandigarh', 'Srinagar'], ['Dehradun', 'Agra'],
  ['Dehradun', 'Srinagar'], ['Bhopal', 'Indore'], ['Bhopal', 'Nagpur'], ['Indore', 'Nagpur'],
  ['Nagpur', 'Raipur'], ['Patna', 'Varanasi'], ['Patna', 'Guwahati'], ['Varanasi', 'Guwahati'],
  ['Varanasi', 'Raipur'], ['Bhubaneswar', 'Visakhapatnam'], ['Bhubaneswar', 'Raipur'], ['Visakhapatnam', 'Raipur'],
  ['Kochi', 'Thiruvananthapuram']
];

// 3. FLIGHT TYPES: priority (5 = most important), usual cruising altitude, colour on the map.
const TYPES = {
  Medical:   { priority: 5, altitude: 33000, color: '#e5394f' },
  Rescue:    { priority: 4, altitude: 32000, color: '#d99100' },
  Passenger: { priority: 3, altitude: 34000, color: '#1e88d6' },
  Cargo:     { priority: 2, altitude: 31000, color: '#8a5cf0' },
  Training:  { priority: 1, altitude: 30000, color: '#2a9d4b' },
};

// 4. FUEL. Planes use jet fuel (ATF), not petrol.
//    Price for domestic airlines from 1 October 2026 (changes on the 1st of every month, update it then).
const ATF_PRICE_PER_LITRE = 137;
const ATF_PRICE_DATE = '1 Oct 2026';
//    Rough fuel use of an A320-size plane: about 3.8 litres per km (an estimate, not exact).
const LITRES_PER_KM = 3.8;

// 5. WHO FLIES IT: the airline / operator for each flight type, and the planes each one uses.
const OPERATORS = {
  Passenger: {
    'Air India': ['Airbus A320neo', 'Airbus A321neo', 'Boeing 787-8'],
    'IndiGo': ['Airbus A320neo', 'Airbus A321neo', 'ATR 72-600'],
    'Akasa Air': ['Boeing 737-8'],
    'SpiceJet': ['Boeing 737-8'],
    'Air India Express': ['Boeing 737-8'],
  },
  Cargo: {
    'Blue Dart Aviation': ['Boeing 757-200F', 'Boeing 737-800F'],
    'Quikjet Cargo': ['Airbus A321F', 'Boeing 737-800F'],
    'SpiceXpress': ['Boeing 737-800F'],
  },
  Medical: {
    'Private air ambulance': ['Learjet 45', 'Beechcraft King Air B200'],
    'Government air ambulance': ['Pilatus PC-12', 'Beechcraft King Air B200'],
  },
  Rescue: {
    'Indian Air Force': ['Lockheed C-130J'],
    'Indian Navy': ['Boeing P-8I'],
  },
  Training: {
    'Airline pilot training': ['Airbus A320neo'],
    'Indian Air Force training': ['BAE Hawk 132'],
  },
};
// Usual cruising speed of each plane in km/h (approximate numbers).
const PLANE_SPEED = {
  'Airbus A320neo': 830, 'Airbus A321neo': 830, 'Boeing 787-8': 900, 'ATR 72-600': 510, 'Boeing 737-8': 840,
  'Boeing 757-200F': 850, 'Boeing 737-800F': 840, 'Airbus A321F': 830,
  'Learjet 45': 800, 'Beechcraft King Air B200': 530, 'Pilatus PC-12': 520,
  'Lockheed C-130J': 640, 'Boeing P-8I': 815, 'BAE Hawk 132': 760,
};
// A Medical flight must say WHY it flies.
const MEDICAL_REASONS = [
  'Organ transport', 'Critical patient transfer', 'Cardiac emergency',
  'Accident or trauma patient', 'Newborn (NICU) transfer', 'Urgent blood or medicine supply',
];

// 6. MAP LABELS: big airports get bigger names; some names go on the LEFT of the dot so they do not overlap.
const HUBS = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad'];
const LEFT_LABELS = ['Delhi', 'Mumbai', 'Bengaluru', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Bhopal', 'Indore', 'Varanasi', 'Kochi', 'Goa'];

// ---------- turn the lists above into things the program can use ----------

// Each city gets an x,y position on the map picture.
const cities = CITIES.map(([name, lat, lon]) => ({
  name: name, lat: lat, lon: lon,
  x: (lon - 68) * 24 + 40,
  y: (35 - lat) * 24 + 40,
}));

// Distance in km between two points on Earth (haversine formula, the "great-circle" distance).
function kmBetween(lat1, lon1, lat2, lon2) {
  const rad = d => d * Math.PI / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Straight-line distance between two cities (by number).
function straightKm(a, b) {
  return Math.round(kmBetween(cities[a].lat, cities[a].lon, cities[b].lat, cities[b].lon));
}

// Find a city's number from its name (Delhi = 0, Mumbai = 1, ...).
function cityIndex(name) {
  return CITIES.findIndex(c => c[0] === name);
}

// "edges" = one-way roads with their distance. Each connection gives two edges.
const edges = [];
CONNECTIONS.forEach(([nameA, nameB]) => {
  const a = cityIndex(nameA), b = cityIndex(nameB), km = straightKm(a, b);
  edges.push({ from: a, to: b, distance: km });
  edges.push({ from: b, to: a, distance: km });
});

// The road from city a to city b.
function edgeBetween(a, b) {
  return edges.find(e => e.from === a && e.to === b);
}

// ---------- MACRO and MICRO cities ----------
// Macro city = one of the 6 big hub airports. Micro city = a small regional airport.
// Every micro city belongs to the REGION of its nearest hub.
cities.forEach(c => { c.macro = HUBS.includes(c.name); });
cities.forEach(c => {
  c.region = c.macro ? cityIndex(c.name) : HUBS.map(cityIndex).reduce((best, h) =>
    kmBetween(c.lat, c.lon, cities[h].lat, cities[h].lon) < kmBetween(c.lat, c.lon, cities[best].lat, cities[best].lon) ? h : best,
    cityIndex(HUBS[0]));
});

// Region name and colour (for the radar), by hub.
const REGION_INFO = {
  Delhi: ['North', '#2f7fd6'], Mumbai: ['West', '#8e5bd1'], Bengaluru: ['South', '#2e9e55'],
  Chennai: ['South-East', '#14958c'], Kolkata: ['East', '#c98500'], Hyderabad: ['Central', '#e0603a'],
};
function regionName(i) { const hub = cities[cities[i].region].name; return REGION_INFO[hub][0] + ' (' + hub + ')'; }
function regionColor(i) { return REGION_INFO[cities[cities[i].region].name][1]; }
function cityType(i) { return cities[i].macro ? 'Hub airport' : 'Regional airport, ' + regionName(i); }

// AIRCRAFT SIZE: big jets need long runways, so they only fly between two hub airports.
const BIG_JETS = ['Airbus A321neo', 'Boeing 787-8', 'Boeing 757-200F', 'Airbus A321F'];

// AIRPORT CAPACITY: minutes between two landings on the runway.
const LANDING_GAP = { macro: 2, micro: 10 };      // macro: 30 landings an hour, micro: 6 an hour
function landingGap(i) { return cities[i].macro ? LANDING_GAP.macro : LANDING_GAP.micro; }

// ---------- AIRCRAFT: what each plane can carry (typical numbers, approximate; airline layouts differ) ----------
// seats = passenger seats, cargo = tonnes of cargo, note = what the plane is used for
const AIRCRAFT_INFO = {
  'Airbus A320neo':           { seats: 180, cargo: 0,  note: 'Passenger jet' },
  'Airbus A321neo':           { seats: 222, cargo: 0,  note: 'Passenger jet, long body' },
  'Boeing 787-8':             { seats: 256, cargo: 0,  note: 'Wide-body passenger jet' },
  'ATR 72-600':               { seats: 78,  cargo: 0,  note: 'Turboprop for short routes' },
  'Boeing 737-8':             { seats: 189, cargo: 0,  note: 'Passenger jet' },
  'Boeing 757-200F':          { seats: 0,   cargo: 39, note: 'Freighter, cargo only' },
  'Boeing 737-800F':          { seats: 0,   cargo: 23, note: 'Freighter, cargo only' },
  'Airbus A321F':             { seats: 0,   cargo: 28, note: 'Freighter, cargo only' },
  'Learjet 45':               { seats: 8,   cargo: 0,  note: 'Air ambulance: 1 stretcher patient + medical team' },
  'Beechcraft King Air B200': { seats: 8,   cargo: 0,  note: 'Air ambulance: 1 stretcher patient + medical team' },
  'Pilatus PC-12':            { seats: 9,   cargo: 0,  note: 'Air ambulance: 1 stretcher patient + medical team' },
  'Lockheed C-130J':          { seats: 92,  cargo: 19, note: 'Military transport: people or cargo' },
  'Boeing P-8I':              { seats: 9,   cargo: 0,  note: 'Patrol aircraft for search and rescue (crew)' },
  'BAE Hawk 132':             { seats: 2,   cargo: 0,  note: 'Jet trainer: trainee + instructor' },
};

// "180 seats", "39 t cargo", "92 people or 19 t cargo"
function capacityText(aircraft) {
  const a = AIRCRAFT_INFO[aircraft];
  if (!a) return '-';
  if (a.seats && a.cargo) return a.seats + ' people or ' + a.cargo + ' t cargo';
  if (a.cargo) return a.cargo + ' t cargo';
  return a.seats + ' seats';
}

// Passenger flights say how many people fly, cargo flights how many tonnes. "" = fine.
function checkLoad(type, aircraft, value) {
  const a = AIRCRAFT_INFO[aircraft];
  if (!a) return '';
  if (type === 'Passenger' && !(Number.isInteger(value) && value >= 1 && value <= a.seats))
    return 'Passengers must be a whole number from 1 to ' + a.seats + ' for the ' + aircraft + '.';
  if (type === 'Cargo' && !(value > 0 && value <= a.cargo))
    return 'Cargo must be more than 0 and at most ' + a.cargo + ' tonnes for the ' + aircraft + '.';
  return '';
}
