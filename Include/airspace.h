#ifndef AIRSPACE_H
#define AIRSPACE_H

// airspace.h : the map. 26 cities, the roads between them, and which cities are hubs.

#include <string>
#include <vector>

const int CITY_COUNT = 26;
const int ROAD_COUNT = 65;     // each road can be flown both ways
const int HUB_COUNT = 6;

struct City {
    std::string name;
    double lat;
    double lon;
    bool isHub;     // true = macro city (big hub), false = micro city
    int region;     // number of the hub this city belongs to
};

extern City cities[CITY_COUNT];

// roadKm[a][b] = length of the road from a to b in km (0 = no road)
extern int roadKm[CITY_COUNT][CITY_COUNT];

// neighbours[a] = the cities you can fly to from a (in the same order as the UI)
extern std::vector<int> neighbours[CITY_COUNT];

// Call once at the start: works out distances, neighbours and regions.
void setupAirspace();

// Distance in km between two points on Earth (haversine formula).
double kmBetween(double lat1, double lon1, double lat2, double lon2);


// Number of a city from its name (-1 if there is none).
int cityNumber(const std::string& name);

// The city nearest to a point (to say "near Agra").
int nearestCity(double lat, double lon);

#endif
