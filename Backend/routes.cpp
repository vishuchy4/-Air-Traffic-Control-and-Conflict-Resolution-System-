#include "routes.h"

#include <algorithm>

int weatherPenalty[CITY_COUNT];

double roadCost(int from, int to) {
    double distance = roadKm[from][to];
    double time = distance * 0.16;      // estimated from the distance
    double fuel = distance * 0.12;      // estimated from the distance
    int risk = 5;                       // same for every road

    return distance + 2 * time + 3 * fuel + 5 * weatherPenalty[from] + 5 * risk;
}

bool findRoute(int start, int end, int bannedFrom, int bannedTo,
               const std::vector<int>& avoid, Route& result) {
    const double BIG = 1e18;                       // "not reached yet"
    std::vector<double> cost(CITY_COUNT, BIG);     // cheapest cost found so far for each city
    std::vector<int> cameFrom(CITY_COUNT, -1);     // the city before it on the cheapest way
    std::vector<bool> done(CITY_COUNT, false);     // true when the city is finished
    cost[start] = 0;

    for (int round = 0; round < CITY_COUNT; round++) {
        // 1. the unfinished city with the smallest cost
        int now = -1;
        for (int i = 0; i < CITY_COUNT; i++)
            if (!done[i] && (now == -1 || cost[i] < cost[now])) now = i;
        if (now == -1 || cost[now] >= BIG) break;
        done[now] = true;

        // 2. look at every road leaving it: is going this way cheaper?
        for (int next : neighbours[now]) {
            if (now == bannedFrom && next == bannedTo) continue;                     // closed road
            if (std::find(avoid.begin(), avoid.end(), next) != avoid.end()) continue; // storm city

            double newCost = cost[now] + roadCost(now, next);
            if (newCost < cost[next]) {
                cost[next] = newCost;
                cameFrom[next] = now;
            }
        }
    }

    if (cost[end] >= BIG) return false;   // no route

    // 3. walk back from the end to the start, then turn the list around
    result.cities.clear();
    for (int c = end; c != -1; c = cameFrom[c]) result.cities.push_back(c);
    std::reverse(result.cities.begin(), result.cities.end());

    result.km = 0;
    for (size_t i = 0; i + 1 < result.cities.size(); i++)
        result.km += roadKm[result.cities[i]][result.cities[i + 1]];
    result.cost = (int)(cost[end] + 0.5);
    return true;
}

// For sorting: the cheaper route comes first.
bool cheaperFirst(const Route& a, const Route& b) {
    return a.cost < b.cost;
}

std::vector<Route> findRouteOptions(int start, int end) {
    std::vector<Route> found;
    Route best;
    if (!findRoute(start, end, NONE, NONE, {}, best)) return found;
    found.push_back(best);

    // close one road of the best route at a time and search again
    for (size_t i = 0; i + 1 < best.cities.size(); i++) {
        Route other;
        if (!findRoute(start, end, best.cities[i], best.cities[i + 1], {}, other)) continue;

        bool isNew = true;
        for (const Route& r : found)
            if (r.cities == other.cities) isNew = false;
        if (isNew) found.push_back(other);
    }

    // cheapest first (equal costs keep their order), at most 3
    std::stable_sort(found.begin(), found.end(), cheaperFirst);
    if (found.size() > MAX_OPTIONS) found.resize(MAX_OPTIONS);
    return found;
}
