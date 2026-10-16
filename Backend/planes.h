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
const int SCHEDULED = 4;      // planned for later: takes off at its departure time

struct Plane {
    std::string id;           // "AG001"
    int priority = 0;         // Medical 5 ... Training 1
    std::vector<int> route;   // the cities of its route
    int leg = 0;              // which road of the route it is on (0 = first)
    double progress = 0;      // how far along that road: 0 = start, 1 = end
    int altitude = 0;         // ft
    int speed = 0;            // km/h
    int status = FLYING;      // FLYING, LANDED, CRASHED, HOLDING or SCHEDULED

    // who flies it (filled in by the AirTraffic class)
    std::string type;         // "Passenger"
    std::string airline;      // "IndiGo"
    std::string aircraft;     // "Airbus A320neo"
    std::string reason;       // only for a Medical flight
    int passengers = 0;       // Passenger flight: people on board
    double cargo = 0;         // Cargo flight: tonnes on board

    // times, in flight minutes since the start (see AirTraffic::clockText)
    double departMinute = 0;      // when it took off
    double plannedArrival = 0;    // when it would land if nothing changes
    double arriveMinute = -1;     // when it landed (-1 = not yet)

    double wait = 0;          // minutes it has been holding at its airport
    bool holdTold = false;    // true after "is holding" was written in the log
    std::string crashNear;    // after a crash: near which city
    std::string crashWhy;     // after a crash: why
};

struct Point {
    double lat = 0;
    double lon = 0;
};

// Where the plane is now.
Point whereNow(const Plane& p);

// Where the plane will be after some minutes. Returns false if it has landed by then.
bool whereAfter(const Plane& p, double minutes, Point& where);

#endif
