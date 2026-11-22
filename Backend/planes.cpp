#include "planes.h"

#include <algorithm>
#include <cmath>

// The curve between two cities: a quadratic Bezier curve from a to b through the control point C.
// The control point is worked out from the lower city number to the higher one, so both directions use the same curve.
static Point curveControl(int a, int b) {
    const City& p = cities[std::min(a, b)];
    const City& q = cities[std::max(a, b)];
    double dlat = q.lat - p.lat, dlon = q.lon - p.lon, len = std::sqrt(dlat * dlat + dlon * dlon);
    double side = len > 0 ? 2 * CURVE_BEND * len : 0;  // the middle of the curve ends up CURVE_BEND x len to the side
    Point c;
    c.lat = (p.lat + q.lat) / 2 - (len > 0 ? dlon / len : 0) * side;
    c.lon = (p.lon + q.lon) / 2 + (len > 0 ? dlat / len : 0) * side;
    return c;
}

// A point on road number "leg" of the route, a part t of the way along (on the curve).
Point pointOnRoute(const Plane& p, int leg, double t) {
    int from = p.route[leg];
    int to = (leg + 1 < (int)p.route.size()) ? p.route[leg + 1] : from;
    const City& a = cities[from];
    const City& b = cities[to];
    if (from == to) {
        Point here;
        here.lat = a.lat;
        here.lon = a.lon;
        return here;
    }

    Point c = curveControl(from, to);
    double u = 1 - t;
    Point here;
    here.lat = u * u * a.lat + 2 * u * t * c.lat + t * t * b.lat;
    here.lon = u * u * a.lon + 2 * u * t * c.lon + t * t * b.lon;
    return here;
}

// km of the whole route, and km already flown.
static double routeLength(const Plane& p) {
    double km = 0;
    for (size_t i = 0; i + 1 < p.route.size(); i++) km += roadKm[p.route[i]][p.route[i + 1]];
    return km;
}
static double kmFlown(const Plane& p) {
    double km = 0;
    for (int i = 0; i < p.leg && i + 1 < (int)p.route.size(); i++) km += roadKm[p.route[i]][p.route[i + 1]];
    if (p.leg + 1 < (int)p.route.size()) km += roadKm[p.route[p.leg]][p.route[p.leg + 1]] * p.progress;
    return km;
}

// The height after flying "flown" km: climbing, level, or coming down (smoothly at both ends).
static int altitudeAt(const Plane& p, double flown) {
    double toGo = routeLength(p) - flown;
    double k = std::max(0.0, std::min(1.0, std::min(flown / CLIMB_KM, toGo / DESCENT_KM)));
    k = k * k * (3 - 2 * k);
    return (int)(p.altitude - LOW_DROP * (1 - k) + 0.5);
}

int altitudeNow(const Plane& p) {
    if (p.status == LANDED || p.status == SCHEDULED) return 0;  // on the ground
    if (p.status == HOLDING) return p.altitude - LOW_DROP;      // circling low over its airport
    return altitudeAt(p, kmFlown(p));
}

// How much of the cruise speed the plane flies now: SLOW_START on the ground, 1 in the middle of the trip (the same shape as the height).
static double speedFactorAt(const Plane& p, double flown) {
    double toGo = routeLength(p) - flown;
    double k = std::max(0.0, std::min(1.0, std::min(flown / CLIMB_KM, toGo / DESCENT_KM)));
    k = k * k * (3 - 2 * k);
    return SLOW_START + (1 - SLOW_START) * k;
}

double speedNowKmh(const Plane& p) {
    if (p.status == FLYING) return p.speed * speedFactorAt(p, kmFlown(p));
    if (p.status == HOLDING) return p.speed * SLOW_START;  // circling over its airport
    return 0;
}

int speedNow(const Plane& p) {
    return (int)(speedNowKmh(p) + 0.5);
}

// Km flown in some minutes. The speed changes slowly, so it is worked out in steps of half a minute.
double distanceAfter(const Plane& p, double minutes) {
    double flown = kmFlown(p), start = flown, left = minutes;
    while (left > 1e-9) {
        double step = std::min(0.5, left);
        flown += p.speed * speedFactorAt(p, flown) * step / 60.0;
        left -= step;
    }
    return flown - start;
}

std::vector<double> distanceTable(const Plane& p, int maxMinutes) {
    std::vector<double> table(maxMinutes + 1, 0.0);
    double flown = kmFlown(p), start = flown;
    for (int minute = 1; minute <= maxMinutes; minute++) {
        for (int half = 0; half < 2; half++) flown += p.speed * speedFactorAt(p, flown) * 0.5 / 60.0;
        table[minute] = flown - start;
    }
    return table;
}

// Minutes needed to fly the next km (time = distance / speed, with the speed of every half minute).
double minutesToFly(const Plane& p, double km) {
    double flown = kmFlown(p), start = flown, minutes = 0;
    while (minutes < 3000) {
        double speed = p.speed * speedFactorAt(p, flown), remain = km - (flown - start);
        if (remain <= 0 || speed <= 0) break;
        double need = remain / speed * 60.0;
        if (need <= 0.5) return minutes + need;
        flown += speed * 0.5 / 60.0;
        minutes += 0.5;
    }
    return minutes;
}

int altitudeAtKm(const Plane& p, double km) {
    return altitudeAt(p, kmFlown(p) + km);
}

Point whereNow(const Plane& p) {
    return pointOnRoute(p, p.leg, p.progress);
}

bool whereAtKm(const Plane& p, double km, Point& where) {
    int leg = p.leg;
    double progress = p.progress;
    int lastCity = (int)p.route.size() - 1;

    while (leg < lastCity) {
        double road = roadKm[p.route[leg]][p.route[leg + 1]];
        double leftOnRoad = road * (1 - progress);

        if (km <= leftOnRoad) {  // it stops on this road
            where = pointOnRoute(p, leg, progress + km / road);
            return true;
        }

        km -= leftOnRoad;  // go on to the next road
        leg++;
        progress = 0;
    }

    return false;  // it has landed
}

bool whereAfter(const Plane& p, double minutes, Point& where) {
    return whereAtKm(p, distanceAfter(p, minutes), where);
}

bool nextStop(const Plane& p, int& city, double& km, double& minutes) {
    if (p.status != FLYING || p.leg + 1 >= (int)p.route.size()) return false;
    city = p.route[p.leg + 1];
    km = roadKm[p.route[p.leg]][city] * (1 - p.progress);  // the part of this road still to fly
    minutes = minutesToFly(p, km);                         // time = distance / speed (with the real speed)
    return true;
}
