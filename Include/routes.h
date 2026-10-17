#ifndef ROUTES_H
#define ROUTES_H

// routes.h : the cost of a road, Dijkstra, and up to 3 route options.

#include <vector>

#include "airspace.h"

const int MAX_OPTIONS = 3;
const int NONE = -1;

struct Route {
    std::vector<int> cities;   // the cities of the route, start to end
    int cost = 0;              // total cost
    int km = 0;                // total distance
};

// Weather penalty of each city (the browser sends it with every request).
extern int weatherPenalty[CITY_COUNT];

// cost = distance + 2 x time + 3 x fuel + 5 x weather + 5 x risk
double roadCost(int from, int to);

// Cheapest route from start to end.
//   bannedFrom / bannedTo = a road that may not be used (NONE = no closed road)
//   avoid = cities to stay away from, e.g. storms (empty = none)
// Returns true if a route was found.
bool findRoute(int start, int end, int bannedFrom, int bannedTo,
               const std::vector<int>& avoid, Route& result);

// The best route, plus other routes found by closing one road of it at a time.
// At most 3, cheapest first.
std::vector<Route> findRouteOptions(int start, int end);

#endif
