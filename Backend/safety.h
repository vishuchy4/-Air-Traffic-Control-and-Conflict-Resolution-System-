#ifndef SAFETY_H
#define SAFETY_H

// safety.h : conflicts now, conflicts later (prediction), and the 3 fixes.

#include "planes.h"

const int SAFE_DISTANCE_KM = 100;    // closer than this ...
const int SAFE_HEIGHT_FT = 1000;     // ... and less height gap than this = conflict
const int LOOK_AHEAD_MINUTES = 60;   // how far the prediction looks ahead

struct Prediction {
    bool found = false;      // true = a conflict is coming
    int startMinute = 0;     // first minute they are too close
    double closestKm = -1;   // smallest distance
    int feet = 0;            // height difference
    Point a, b;              // where the two planes are at the closest moment
};

double kmApart(const Plane& a, const Plane& b);
int feetApart(const Plane& a, const Plane& b);

// true if both fly and are closer than 100 km AND less than 1000 ft apart
bool inConflict(const Plane& a, const Plane& b);

// Move both planes ahead minute by minute (up to 60) and see if they get too close.
Prediction predictConflict(const Plane& a, const Plane& b);

// The 3 fixes, made on a COPY of the plane (for the What-if tests)
Plane withAltitude(const Plane& p, int change);      // kept between 20,000 and 40,000 ft
Plane withSpeed(const Plane& p, int change);         // kept between 500 and 900 km/h
bool withNewRoute(const Plane& p, Plane& result);    // false if not possible now

#endif
