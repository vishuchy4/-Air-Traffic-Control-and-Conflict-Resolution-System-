#ifndef PLANES_H
#define PLANES_H

// planes.h : a plane, and where it is now or will be later.

#include <string>
#include <vector>

#include "airspace.h"

// status of a plane (the same numbers the UI sends)
const int FLYING = 0;
const int LANDED = 1;
const int CRASHED = 2;
const int HOLDING = 3;
const int SCHEDULED = 4;  // planned for later: takes off at its departure time

struct Plane {
    std::string id;          // "AG001"
    int priority = 0;        // Medical 5 ... Training 1
    std::vector<int> route;  // the cities of its route
    int leg = 0;             // which road of the route it is on (0 = first)
    double progress = 0;     // how far along that road: 0 = start, 1 = end
    int altitude = 0;        // ft
    int speed = 0;           // km/h
    int status = FLYING;     // FLYING, LANDED, CRASHED, HOLDING or SCHEDULED

    // who flies it (filled in by the AirTraffic class)
    std::string type;      // "Passenger"
    std::string airline;   // "IndiGo"
    std::string aircraft;  // "Airbus A320neo"
    std::string reason;    // only for a Medical flight
    int passengers = 0;    // Passenger flight: people on board
    double cargo = 0;      // Cargo flight: tonnes on board

    // times, in flight minutes since the start (see AirTraffic::clockText)
    double departMinute = 0;    // when it took off
    double plannedArrival = 0;  // when it would land if nothing changes
    double arriveMinute = -1;   // when it landed (-1 = not yet)

    double wait = 0;        // minutes it has been holding at its airport
    bool holdTold = false;  // true after "is holding" was written in the log
    std::string crashNear;  // after a crash: near which city
    std::string crashWhy;   // after a crash: why
};

struct Point {
    double lat = 0;
    double lon = 0;
};

// ---------- like a real flight ----------
// 1. A plane never flies a straight line: every road is a gentle curve, the same curve in both directions (like an airway).
//    Its middle is pushed sideways by CURVE_BEND of the road's length.
// 2. The height changes along the trip: it climbs after take-off (the first CLIMB_KM), flies level at its cruising
//    height (p.altitude, the height the controller sets), and comes down in the last DESCENT_KM. At the start and the
//    end it is LOW_DROP ft below its cruising height. Because every plane uses the same shape, a controller's
//    +1000 ft always makes a full 1,000 ft difference, also while climbing.
const double CURVE_BEND = 0.08;
const double CLIMB_KM = 180, DESCENT_KM = 220;
const int LOW_DROP = 28000;

// Where the plane is now.
Point whereNow(const Plane& p);
// How high the plane really is now (ft): climbing, level or coming down. Landed / waiting to depart: 0.
int altitudeNow(const Plane& p);
// How high it will be after some minutes (ft).

// ---------- speed ----------
// p.speed is the CRUISE speed (the one the controller changes). After take-off and before landing the plane flies slower:
// it starts at SLOW_START of the cruise speed and speeds up smoothly over the same distance as the climb, and it slows down again
// over the same distance as the descent. So speed and height change together, like a real flight.
const double SLOW_START = 0.65;
double speedNowKmh(const Plane& p);                    // how fast it really flies now (0 if it is not flying)
int speedNow(const Plane& p);                          // the same, rounded (km/h), for the screen
double distanceAfter(const Plane& p, double minutes);  // km it flies in the next minutes
double minutesToFly(const Plane& p, double km);        // minutes it needs for the next km
// For the 60-minute prediction: the km flown after 0, 1, 2 ... maxMinutes minutes (worked out once, not again for every minute).
std::vector<double> distanceTable(const Plane& p, int maxMinutes);
bool whereAtKm(const Plane& p, double km, Point& where);  // where it is after flying km more (false = it has landed)
int altitudeAtKm(const Plane& p, double km);              // its height after flying km more

// Where the plane will be after some minutes. Returns false if it has landed by then.
bool whereAfter(const Plane& p, double minutes, Point& where);

// The next city on the route of a flying plane: which city, how many km and how many minutes away.
// Returns false if the plane is not flying.
bool nextStop(const Plane& p, int& city, double& km, double& minutes);

#endif
