#include "planes.h"

// A point on road number "leg" of the route, a part t of the way along (straight line).
Point pointOnRoute(const Plane& p, int leg, double t) {
    const City& a = cities[p.route[leg]];
    const City& b = (leg + 1 < (int)p.route.size()) ? cities[p.route[leg + 1]] : a;

    Point here;
    here.lat = a.lat + (b.lat - a.lat) * t;
    here.lon = a.lon + (b.lon - a.lon) * t;
    return here;
}

Point whereNow(const Plane& p) {
    return pointOnRoute(p, p.leg, p.progress);
}

bool whereAfter(const Plane& p, double minutes, Point& where) {
    int leg = p.leg;
    double progress = p.progress;
    double km = p.speed * minutes / 60.0;              // distance = speed x time
    int lastCity = (int)p.route.size() - 1;

    while (leg < lastCity) {
        double road = roadKm[p.route[leg]][p.route[leg + 1]];
        double leftOnRoad = road * (1 - progress);

        if (km <= leftOnRoad) {                        // it stops on this road
            where = pointOnRoute(p, leg, progress + km / road);
            return true;
        }

        km -= leftOnRoad;                              // go on to the next road
        leg++;
        progress = 0;
    }

    return false;                                      // it has landed
}
