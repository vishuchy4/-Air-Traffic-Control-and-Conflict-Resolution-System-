#include "atc.h"

#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <functional>
#include <queue>

#include "fleet.h"
#include "weather.h"

AirTraffic::AirTraffic() {
    std::time_t now = std::time(nullptr);
    std::tm* local = std::localtime(&now);
    clockStart = local->tm_hour * 60 + local->tm_min;      // the flight clock starts at this computer's time
    addLog("System ready: " + std::to_string(CITY_COUNT) + " cities.");
}

std::string AirTraffic::clockText(double minutes) {
    int total = (int)(clockStart + minutes + 0.5);
    int day = total / 1440, m = total % 1440;
    char text[32];
    snprintf(text, sizeof(text), "%02d:%02d", m / 60, m % 60);
    return std::string(text) + (day > 0 ? " (+" + std::to_string(day) + " day)" : "");
}

double AirTraffic::expectedArrival(const Plane& p) {
    if (p.status == SCHEDULED) return p.plannedArrival;
    if (p.status == LANDED) return p.arriveMinute;
    if (p.status == FLYING) return flightMinutes + minutesToFly(p, kmLeft(p));
    return -1;                                       // holding (not known yet) or crashed
}

int AirTraffic::delayMinutes(const Plane& p) {
    double arrive = expectedArrival(p);
    if (arrive < 0) return 0;
    int late = (int)(arrive - p.plannedArrival + 0.5);
    return late <= 1 ? 0 : late;                     // 1 minute or less = on time
}

void AirTraffic::addLog(const std::string& text) {
    log.push_back(clockText(flightMinutes) + "  " + text);   // "14:35  AG001 took off ..."
}

Plane* AirTraffic::findPlane(const std::string& id) {
    auto found = planeIndex.find(id);                 // hash table: no need to look through every plane
    return found == planeIndex.end() ? nullptr : &planes[found->second];
}

int AirTraffic::routeKm(const std::vector<int>& route) {
    int km = 0;
    for (size_t i = 0; i + 1 < route.size(); i++) km += roadKm[route[i]][route[i + 1]];
    return km;
}

double AirTraffic::kmLeft(const Plane& p) {
    if (p.status != FLYING) return 0;
    double km = 0;
    for (int i = p.leg; i + 1 < (int)p.route.size(); i++) {
        double road = roadKm[p.route[i]][p.route[i + 1]];
        km += (i == p.leg) ? road * (1 - p.progress) : road;
    }
    return km;
}

std::string routeText(const std::vector<int>& route) {        // "Delhi > Agra > Dehradun"
    std::string text;
    for (size_t i = 0; i < route.size(); i++) text += cities[route[i]].name + (i + 1 < route.size() ? " > " : "");
    return text;
}

std::string withCommas(int number) {                           // 1147 -> "1,147" (Indian style)
    std::string digits = std::to_string(number), out;
    int count = 0;
    for (int i = (int)digits.size() - 1; i >= 0; i--) {
        out.insert(out.begin(), digits[i]);
        count++;
        if (i > 0 && (count == 3 || (count > 3 && (count - 3) % 2 == 0))) out.insert(out.begin(), ',');
    }
    return out;
}

// =====================================================================
// PLANNING
// =====================================================================

std::string AirTraffic::checkPlan(int from, int to, const std::string& type, const std::string& airline,
                                  const std::string& aircraft, const std::string& reason, double load) {
    if (from < 0 || to < 0 || from >= CITY_COUNT || to >= CITY_COUNT) return "Please choose From and To.";
    if (from == to) return "From and To must be different cities.";
    if (priorityOf(type) == 0) return "Please choose a flight type.";
    if (!operatorFlies(type, airline, aircraft)) return "Please choose an operator and one of its aircraft.";
    if (findType(type)->needsReason() && !isMedicalReason(reason)) return "Please choose the reason for the medical flight.";
    if (isBigJet(aircraft) && !(cities[from].isHub && cities[to].isHub)) return "Big jets can only fly between two hub airports.";
    return checkLoad(type, aircraft, load);
}

std::vector<Route> AirTraffic::routeOptions(int from, int to) {
    usePenaltiesFromWeather();                    // Dijkstra uses the latest weather
    return findRouteOptions(from, to);
}

std::string AirTraffic::startFlight(int from, int to, const std::string& type, const std::string& airline,
                                    const std::string& aircraft, const std::string& reason, double load, int option,
                                    double departIn) {
    if (!checkPlan(from, to, type, airline, aircraft, reason, load).empty()) return "";
    std::vector<Route> options = routeOptions(from, to);
    if (option < 0 || option >= (int)options.size()) return "";

    char id[10];
    snprintf(id, sizeof(id), "AG%03d", nextId++);   // AG001, AG002, ...

    Plane p;
    p.id = id;
    p.type = type;
    p.priority = priorityOf(type);
    p.airline = airline;
    p.aircraft = aircraft;
    p.reason = (type == "Medical") ? reason : "";
    p.route = options[option].cities;
    p.altitude = altitudeOf(type) + (std::rand() % 2) * 500;   // usual altitude + 0 or 500 ft
    p.speed = cruiseSpeed(aircraft);
    if (type == "Passenger") p.passengers = (int)load;
    if (type == "Cargo") p.cargo = load;
    planeIndex[p.id] = planes.size();                                     // remember where it is (hash table)
    if (departIn < 0) departIn = 0;
    if (departIn > 0) p.status = SCHEDULED;                                // takes off later
    p.departMinute = flightMinutes + departIn;                             // flight clock at take-off
    p.plannedArrival = p.departMinute + minutesToFly(p, routeKm(p.route)); // if nothing changes (it flies slower after take-off and before landing)
    planes.push_back(p);

    addLog(p.id + " (" + type + ", " + airline + " - " + aircraft + ")" +
           (departIn > 0 ? " scheduled for " + clockText(p.departMinute) + ": " : " took off: ") + routeText(p.route) +
           ", " + withCommas(routeKm(p.route)) + " km.");
    return p.id;
}

// =====================================================================
// THE CLOCK
// =====================================================================

void AirTraffic::update(double realSeconds) {
    while (realSeconds > 0) {                     // small steps, so nothing is missed
        double step = std::min(realSeconds, 0.05);
        tick(step);
        realSeconds -= step;
    }
}

void AirTraffic::tick(double seconds) {
    if (!paused && !waiting) movePlanes(seconds); // frozen while a new conflict waits for the controller
    checkConflicts();
    countDown(seconds);                           // the countdown runs in real seconds, even when paused
}

std::string AirTraffic::togglePause() {
    if (waiting) return "Fix the conflict first. Change altitude, speed or route.";
    paused = !paused;
    return "";
}

void AirTraffic::setSpeed(int x) {
    if (x == 1 || x == 2 || x == 4) speedX = x;
}

void AirTraffic::movePlanes(double seconds) {
    double minutes = seconds * speedX / SECONDS_PER_FLIGHT_HOUR * 60;   // flight minutes that pass

    for (Plane& p : planes) {                     // scheduled flights take off at their time
        if (p.status == SCHEDULED && flightMinutes >= p.departMinute) {
            p.status = FLYING;
            addLog(p.id + " took off as scheduled: " + routeText(p.route) + ".");
        }
    }

    for (Plane& p : planes) {
        if (p.status != FLYING) continue;
        double road = roadKm[p.route[p.leg]][p.route[p.leg + 1]];
        double km = speedNowKmh(p) * minutes / 60;                      // distance = speed x time (the speed changes with the flight)
        p.progress += km / road;

        if (p.progress >= 1) {                    // reached the next city
            p.progress = 0;
            p.leg++;
            if (p.leg >= (int)p.route.size() - 1) {
                p.status = HOLDING;               // at the destination: wait for the runway
                p.wait = 0;
            }
        }
    }
    updateAirports(minutes);
}

// =====================================================================
// AIRPORTS: a runway takes 1 landing every few minutes; the others hold
// =====================================================================

// The order of the landing queue: "a lands later than b?" (used by the priority queue).
// Higher priority lands first, then the one waiting longest, then the one that arrived first.
struct LandsLater {
    bool operator()(const Plane* a, const Plane* b) const {
        if (a->priority != b->priority) return a->priority < b->priority;
        if (a->wait != b->wait) return a->wait < b->wait;
        return std::greater<const Plane*>()(a, b);           // same priority and wait: the earlier flight first
    }
};

std::vector<std::string> AirTraffic::holdingQueue(int city) {
    // PRIORITY QUEUE: the plane on top is always the next one to land
    std::priority_queue<Plane*, std::vector<Plane*>, LandsLater> queue;
    for (Plane& p : planes)
        if (p.status == HOLDING && p.route.back() == city) queue.push(&p);

    std::vector<std::string> ids;                    // the queue in landing order
    while (!queue.empty()) {
        ids.push_back(queue.top()->id);
        queue.pop();
    }
    return ids;
}

void AirTraffic::updateAirports(double minutes) {
    flightMinutes += minutes;
    for (Plane& p : planes)
        if (p.status == HOLDING) p.wait += minutes;

    for (int city = 0; city < CITY_COUNT; city++) {
        std::vector<std::string> queue = holdingQueue(city);
        if (queue.empty()) continue;

        double gap = cities[city].isHub ? HUB_LANDING_GAP : SMALL_LANDING_GAP;
        if (lastLanding[city] >= 0 && flightMinutes - lastLanding[city] < gap) continue;   // runway busy

        Plane* next = findPlane(queue[0]);
        next->status = LANDED;
        next->arriveMinute = flightMinutes;
        lastLanding[city] = flightMinutes;
        addLog(next->id + " landed at " + cities[city].name +
               (next->wait > 0.05 ? " after holding " + std::to_string((int)(next->wait + 0.5)) + " min." : "."));
    }

    for (Plane& p : planes) {                     // tell once when a plane starts holding
        if (p.status != HOLDING || p.holdTold) continue;
        p.holdTold = true;
        std::vector<std::string> queue = holdingQueue(p.route.back());
        int place = (int)(std::find(queue.begin(), queue.end(), p.id) - queue.begin()) + 1;
        addLog(p.id + " is holding at " + cities[p.route.back()].name + ": runway busy, number " +
               std::to_string(place) + " in the landing queue.");
    }
}

// =====================================================================
// CONFLICTS, COUNTDOWN, CRASH
// =====================================================================

Conflict* AirTraffic::findConflict(const std::string& a, const std::string& b) {
    for (Conflict& c : conflicts)
        if (c.a == a && c.b == b) return &c;
    return nullptr;
}

bool AirTraffic::isConflictNow(const std::string& a, const std::string& b) {
    return findConflict(a, b) != nullptr;
}

void AirTraffic::checkConflicts() {
    std::vector<Conflict> now;

    for (size_t i = 0; i < planes.size(); i++) {
        for (size_t j = i + 1; j < planes.size(); j++) {
            if (!inConflict(planes[i], planes[j])) continue;

            Conflict c = {planes[i].id, planes[j].id, DECISION_SECONDS, false, kmApart(planes[i], planes[j])};
            Conflict* old = findConflict(c.a, c.b);
            if (old) c = *old;                    // not new: keep its countdown

            if (!old) {
                waiting = true;                   // freeze until the controller acts
                addLog("Conflict: " + c.a + " and " + c.b + " are too close. Everything paused. Your decision.");
            }
            now.push_back(c);
        }
    }

    for (const Conflict& old : conflicts) {       // gone = fixed
        bool still = false;
        for (const Conflict& c : now)
            if (c.a == old.a && c.b == old.b) still = true;
        if (!still) {
            resolved++;
            addLog("Conflict fixed: " + old.a + " and " + old.b + " are safe now.");
        }
    }

    conflicts = now;
    if (conflicts.empty()) waiting = false;       // nothing left to wait for
}

// Crash rules:
//  1. nobody acts for 30 seconds -> crash
//  2. speed or route was changed -> the countdown stops; crash only if they touch while getting closer
//  3. altitude changed but still not enough -> the countdown keeps going
void AirTraffic::countDown(double seconds) {
    std::vector<Conflict> list = conflicts;        // a crash changes the list, so use a copy

    for (const Conflict& c : list) {
        Plane* a = findPlane(c.a);
        Plane* b = findPlane(c.b);
        if (!a || !b || a->status != FLYING || b->status != FLYING) continue;

        double km = kmApart(*a, *b);
        bool closing = km < c.lastKm;
        Conflict* real = findConflict(c.a, c.b);       // the real one (the list may have changed after a crash)
        if (real) real->lastKm = km;

        if (c.acted) {
            if (closing && km < TOUCH_KM && feetApart(*a, *b) < TOUCH_FEET)
                crash(c.a, c.b, "They flew into each other (closer than 5 km at almost the same height).");
            continue;
        }

        if (real) {
            real->secondsLeft -= seconds;
            if (real->secondsLeft <= 0) crash(c.a, c.b, "Nobody cleared the conflict within 30 seconds.");
        }
    }
}

void AirTraffic::crash(const std::string& idA, const std::string& idB, const std::string& why) {
    Plane* a = findPlane(idA);
    Plane* b = findPlane(idB);
    if (!a || !b || a->status != FLYING || b->status != FLYING) return;   // never twice

    Point p = whereNow(*a), q = whereNow(*b);
    std::string nearName = cities[nearestCity((p.lat + q.lat) / 2, (p.lon + q.lon) / 2)].name;

    a->status = CRASHED; a->crashNear = nearName; a->crashWhy = why;
    b->status = CRASHED; b->crashNear = nearName; b->crashWhy = why;
    crashes++;
    addLog("Crash: " + idA + " and " + idB + " collided near " + nearName + ". " + why);

    std::vector<Conflict> left;                   // forget every conflict of these two planes
    for (const Conflict& c : conflicts)
        if (c.a != idA && c.b != idA && c.a != idB && c.b != idB) left.push_back(c);
    conflicts = left;
    waiting = waiting && !conflicts.empty();      // the other planes may move again
}

// =====================================================================
// THE CONTROLLER'S 3 TOOLS
// =====================================================================

void AirTraffic::markActed(const std::string& id) {
    for (Conflict& c : conflicts)
        if (c.a == id || c.b == id) c.acted = true;
}

void AirTraffic::afterAction(bool needsTime) {
    checkConflicts();
    // altitude works at once: stay frozen if it is still not enough. Speed and route need time: move again.
    waiting = needsTime ? false : !conflicts.empty();
}

std::string AirTraffic::changeAltitude(const std::string& id, int amount) {
    Plane* p = findPlane(id);
    if (!p || p->status != FLYING) return "No flying plane " + id + ".";
    int old = p->altitude;
    int changed = withAltitude(*p, amount).altitude;
    if (changed == old) return "Altitude must stay between 20,000 and 40,000 ft.";

    p->altitude = changed;
    addLog("You changed " + id + " altitude: " + std::to_string(old) + " to " + std::to_string(changed) + " ft.");
    afterAction(false);
    return "";
}

std::string AirTraffic::changeSpeed(const std::string& id, int amount) {
    Plane* p = findPlane(id);
    if (!p || p->status != FLYING) return "No flying plane " + id + ".";
    int old = p->speed;
    int changed = withSpeed(*p, amount).speed;
    if (changed == old) return "Speed must stay between 500 and 900 km/h.";

    p->speed = changed;
    markActed(id);
    addLog("You changed " + id + " speed: " + std::to_string(old) + " to " + std::to_string(changed) + " km/h.");
    afterAction(true);
    return "";
}

std::string AirTraffic::changeRoute(const std::string& id) {
    Plane* p = findPlane(id);
    if (!p || p->status != FLYING) return "No flying plane " + id + ".";
    usePenaltiesFromWeather();
    Plane changed;
    if (!withNewRoute(*p, changed)) return id + " is on its last part (or has no other road). Use altitude or speed.";

    p->route = changed.route;
    p->progress = changed.progress;
    markActed(id);
    addLog("You rerouted " + id + ": " + routeText(p->route) + ".");
    afterAction(true);
    return "";
}

// =====================================================================
// PREDICTION AND WHAT-IF
// =====================================================================

// For sorting coming conflicts: the soonest first.
bool soonerFirst(const ComingConflict& x, const ComingConflict& y) {
    return x.prediction.startMinute < y.prediction.startMinute;
}

std::vector<ComingConflict> AirTraffic::comingConflicts() {
    std::vector<ComingConflict> list;
    for (size_t i = 0; i < planes.size(); i++) {
        for (size_t j = i + 1; j < planes.size(); j++) {
            if (planes[i].status != FLYING || planes[j].status != FLYING) continue;
            if (isConflictNow(planes[i].id, planes[j].id)) continue;          // already happening
            Prediction p = predictConflict(planes[i], planes[j]);
            if (p.found) list.push_back({planes[i].id, planes[j].id, p});
        }
    }
    std::stable_sort(list.begin(), list.end(), soonerFirst);
    return list;
}

int fixesIt(const Plane& copy, const Plane& other) {
    bool comingLater = predictConflict(copy, other).found;
    bool happeningNow = inConflict(copy, other);
    if (comingLater || happeningNow) return 0;   // still too close
    return 1;                                     // the conflict is gone
}

std::vector<FixTest> AirTraffic::fixTests(const std::string& changeId, const std::string& otherId) {
    std::vector<FixTest> tests;
    Plane* change = findPlane(changeId);
    Plane* other = findPlane(otherId);
    if (!change || !other) return tests;
    usePenaltiesFromWeather();

    int up = change->altitude + 1000 <= 40000 ? 1000 : -1000;   // up, or down if already at the top
    Plane newRoute;
    tests.push_back({"alt", up, (up > 0 ? "Raise " : "Lower ") + changeId + " by 1,000 ft", fixesIt(withAltitude(*change, up), *other)});
    tests.push_back({"spd", -100, "Slow " + changeId + " by 100 km/h", fixesIt(withSpeed(*change, -100), *other)});
    tests.push_back({"route", 0, "Send " + changeId + " on another route", withNewRoute(*change, newRoute) ? fixesIt(newRoute, *other) : -1});
    return tests;
}

std::string AirTraffic::applyFix(const std::string& changeId, const std::string& otherId, const std::string& kind, int amount) {
    std::string problem;
    if (kind == "alt") problem = changeAltitude(changeId, amount);
    else if (kind == "spd") problem = changeSpeed(changeId, amount);
    else problem = changeRoute(changeId);
    if (!problem.empty()) return problem;

    // the pair, written in the same order as in the list of planes
    std::string a = changeId, b = otherId;
    for (const Plane& p : planes) {
        if (p.id == otherId) { a = otherId; b = changeId; break; }
        if (p.id == changeId) break;
    }

    bool stillComing = false;
    for (const ComingConflict& c : comingConflicts())
        if (c.a == a && c.b == b) stillComing = true;
    if (!stillComing && !isConflictNow(a, b)) {
        prevented++;
        addLog("Conflict prevented in advance: " + a + " and " + b + ".");
    }
    return "";
}

// =====================================================================
// SEVERE WEATHER ON THE ROUTE OF A FLYING PLANE
// =====================================================================

std::vector<StormAlert> AirTraffic::stormAlerts() {
    std::vector<StormAlert> list;
    usePenaltiesFromWeather();
    auto wasKept = [&](const std::string& key) { return std::find(keptRoutes.begin(), keptRoutes.end(), key) != keptRoutes.end(); };

    for (const Plane& p : planes) {
        if (p.status != FLYING) continue;
        int dest = p.route.back();

        StormAlert alert;
        alert.planeId = p.id;
        alert.atDestination = false;
        alert.canGoAround = false;

        for (int i = p.leg + 1; i + 1 < (int)p.route.size(); i++)   // cities still to pass (not the destination)
            if (isSevere(p.route[i])) alert.storms.push_back(p.route[i]);

        if (!alert.storms.empty()) {
            alert.key = p.id + "@";
            for (size_t i = 0; i < alert.storms.size(); i++) alert.key += (i ? "," : "") + std::to_string(alert.storms[i]);
            if (wasKept(alert.key)) continue;

            // where the new route can start
            int startLeg = -1;
            bool nextIsStorm = std::find(alert.storms.begin(), alert.storms.end(), p.route[p.leg + 1]) != alert.storms.end();
            if (p.progress < 0.3) startLeg = p.leg;          // just took off: it can turn back
            else if (!nextIsStorm) startLeg = p.leg + 1;     // change after the next city

            Route around;
            if (startLeg >= 0 && findRoute(p.route[startLeg], dest, NONE, NONE, alert.storms, around)) {
                alert.canGoAround = true;
                alert.startLeg = startLeg;
                alert.newRoute.assign(p.route.begin(), p.route.begin() + startLeg);
                alert.newRoute.insert(alert.newRoute.end(), around.cities.begin(), around.cities.end());
                alert.extraKm = routeKm(alert.newRoute) - routeKm(p.route);
            }
            list.push_back(alert);
        } else if (isSevere(dest)) {
            alert.key = p.id + "@dest" + std::to_string(dest);
            if (wasKept(alert.key)) continue;
            alert.atDestination = true;
            alert.storms.push_back(dest);
            list.push_back(alert);
        }
    }
    return list;
}

std::string AirTraffic::flyAround(const std::string& planeId) {
    for (const StormAlert& a : stormAlerts()) {
        if (a.planeId != planeId || !a.canGoAround) continue;
        Plane* p = findPlane(planeId);
        if (a.startLeg == p->leg && p->progress > 0) p->progress = 0;   // it turns back to its city
        p->route = a.newRoute;
        weatherReroutes++;

        std::string where;
        for (size_t i = 0; i < a.storms.size(); i++) where += (i ? ", " : "") + cities[a.storms[i]].name;
        addLog("You flew " + planeId + " around bad weather at " + where + ": " + routeText(p->route) + ".");
        checkConflicts();
        return "";
    }
    return "No way around the weather for " + planeId + ".";
}

void AirTraffic::keepRoute(const std::string& key) {
    keptRoutes.push_back(key);
    addLog("You kept the route of " + key.substr(0, key.find('@')) + " through the bad weather.");
}
