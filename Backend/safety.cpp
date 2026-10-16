#include "safety.h"

#include <algorithm>
#include <cstdlib>

#include "routes.h"

double kmApart(const Plane& a, const Plane& b) {
    Point p = whereNow(a), q = whereNow(b);
    return kmBetween(p.lat, p.lon, q.lat, q.lon);
}

int feetApart(const Plane& a, const Plane& b) {
    return std::abs(a.altitude - b.altitude);
}

bool inConflict(const Plane& a, const Plane& b) {
    if (a.status != FLYING || b.status != FLYING) return false;
    return kmApart(a, b) < SAFE_DISTANCE_KM && feetApart(a, b) < SAFE_HEIGHT_FT;
}

Prediction predictConflict(const Plane& a, const Plane& b) {
    Prediction result;
    result.feet = feetApart(a, b);

    if (result.feet >= SAFE_HEIGHT_FT) return result;   // different heights: always safe

    for (int minute = 1; minute <= LOOK_AHEAD_MINUTES; minute++) {
        Point p, q;
        if (!whereAfter(a, minute, p) || !whereAfter(b, minute, q)) break;   // one has landed

        double km = kmBetween(p.lat, p.lon, q.lat, q.lon);

        if (km < SAFE_DISTANCE_KM && !result.found) {   // the first minute they are too close
            result.found = true;
            result.startMinute = minute;
        }
        if (result.closestKm < 0 || km < result.closestKm) {
            result.closestKm = km;
            result.a = p;
            result.b = q;
        }
    }
    return result;
}

Plane withAltitude(const Plane& p, int change) {
    Plane copy = p;
    copy.altitude = std::min(40000, std::max(20000, p.altitude + change));
    return copy;
}

Plane withSpeed(const Plane& p, int change) {
    Plane copy = p;
    copy.speed = std::min(900, std::max(500, p.speed + change));
    return copy;
}

bool withNewRoute(const Plane& p, Plane& result) {
    int last = (int)p.route.size() - 1;
    int startLeg;

    if (p.progress < 0.3) startLeg = p.leg;            // just left a city: it can turn back
    else if (p.leg + 1 < last) startLeg = p.leg + 1;   // otherwise change after the next city
    else return false;                                 // last road: no change possible

    // close the road it would take from there, and search again
    Route r;
    if (!findRoute(p.route[startLeg], p.route[last], p.route[startLeg], p.route[startLeg + 1], {}, r)) return false;

    result = p;
    result.route.assign(p.route.begin(), p.route.begin() + startLeg);        // the part already flown
    result.route.insert(result.route.end(), r.cities.begin(), r.cities.end()); // the new part
    if (startLeg == p.leg) result.progress = 0;                              // it turned back
    return true;
}
