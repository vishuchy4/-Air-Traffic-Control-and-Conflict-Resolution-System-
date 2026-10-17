#include "airspace.h"

#include <cmath>

// ---------- 1. the cities (name, latitude, longitude; hub and region are filled in later) ----------
City cities[CITY_COUNT] = {
    {"Delhi", 28.61, 77.21, false, 0},
    {"Mumbai", 19.08, 72.88, false, 0},
    {"Bengaluru", 12.97, 77.59, false, 0},
    {"Chennai", 13.08, 80.27, false, 0},
    {"Kolkata", 22.57, 88.36, false, 0},
    {"Hyderabad", 17.39, 78.49, false, 0},
    {"Ahmedabad", 23.02, 72.57, false, 0},
    {"Pune", 18.52, 73.86, false, 0},
    {"Jaipur", 26.91, 75.79, false, 0},
    {"Lucknow", 26.85, 80.95, false, 0},
    {"Chandigarh", 30.73, 76.78, false, 0},
    {"Dehradun", 30.32, 78.03, false, 0},
    {"Agra", 27.18, 78.02, false, 0},
    {"Bhopal", 23.26, 77.41, false, 0},
    {"Indore", 22.72, 75.86, false, 0},
    {"Nagpur", 21.15, 79.09, false, 0},
    {"Patna", 25.59, 85.14, false, 0},
    {"Varanasi", 25.32, 82.97, false, 0},
    {"Guwahati", 26.14, 91.74, false, 0},
    {"Bhubaneswar", 20.3, 85.82, false, 0},
    {"Visakhapatnam", 17.69, 83.22, false, 0},
    {"Kochi", 9.93, 76.27, false, 0},
    {"Thiruvananthapuram", 8.52, 76.94, false, 0},
    {"Goa", 15.38, 73.83, false, 0},
    {"Srinagar", 34.08, 74.8, false, 0},
    {"Raipur", 21.25, 81.63, false, 0}
};

// ---------- 2. the roads (pairs of cities with a direct air route) ----------
const std::string ROADS[ROAD_COUNT][2] = {
    {"Delhi", "Mumbai"}, {"Delhi", "Bengaluru"}, {"Delhi", "Chennai"},
    {"Delhi", "Kolkata"}, {"Delhi", "Hyderabad"}, {"Delhi", "Jaipur"},
    {"Delhi", "Lucknow"}, {"Delhi", "Chandigarh"}, {"Delhi", "Dehradun"},
    {"Delhi", "Agra"}, {"Delhi", "Bhopal"}, {"Delhi", "Srinagar"},
    {"Mumbai", "Bengaluru"}, {"Mumbai", "Chennai"}, {"Mumbai", "Kolkata"},
    {"Mumbai", "Hyderabad"}, {"Mumbai", "Ahmedabad"}, {"Mumbai", "Pune"},
    {"Mumbai", "Indore"}, {"Mumbai", "Goa"}, {"Bengaluru", "Chennai"},
    {"Bengaluru", "Kolkata"}, {"Bengaluru", "Hyderabad"}, {"Bengaluru", "Kochi"},
    {"Bengaluru", "Thiruvananthapuram"}, {"Bengaluru", "Goa"}, {"Chennai", "Kolkata"},
    {"Chennai", "Hyderabad"}, {"Chennai", "Kochi"}, {"Chennai", "Thiruvananthapuram"},
    {"Kolkata", "Hyderabad"}, {"Kolkata", "Patna"}, {"Kolkata", "Varanasi"},
    {"Kolkata", "Guwahati"}, {"Kolkata", "Bhubaneswar"}, {"Hyderabad", "Pune"},
    {"Hyderabad", "Nagpur"}, {"Hyderabad", "Visakhapatnam"}, {"Hyderabad", "Raipur"},
    {"Ahmedabad", "Bhopal"}, {"Ahmedabad", "Indore"}, {"Pune", "Goa"},
    {"Jaipur", "Chandigarh"}, {"Jaipur", "Agra"}, {"Jaipur", "Bhopal"},
    {"Lucknow", "Agra"}, {"Lucknow", "Patna"}, {"Lucknow", "Varanasi"},
    {"Chandigarh", "Dehradun"}, {"Chandigarh", "Agra"}, {"Chandigarh", "Srinagar"},
    {"Dehradun", "Agra"}, {"Dehradun", "Srinagar"}, {"Bhopal", "Indore"},
    {"Bhopal", "Nagpur"}, {"Indore", "Nagpur"}, {"Nagpur", "Raipur"},
    {"Patna", "Varanasi"}, {"Patna", "Guwahati"}, {"Varanasi", "Guwahati"},
    {"Varanasi", "Raipur"}, {"Bhubaneswar", "Visakhapatnam"}, {"Bhubaneswar", "Raipur"},
    {"Visakhapatnam", "Raipur"}, {"Kochi", "Thiruvananthapuram"}
};

// ---------- 3. the hubs (macro cities) ----------
const std::string HUBS[HUB_COUNT] = {"Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Hyderabad"};

int roadKm[CITY_COUNT][CITY_COUNT];
std::vector<int> neighbours[CITY_COUNT];

double kmBetween(double lat1, double lon1, double lat2, double lon2) {
    double toRad = 3.14159265358979 / 180.0;
    double dLat = (lat2 - lat1) * toRad;
    double dLon = (lon2 - lon1) * toRad;
    double h = sin(dLat / 2) * sin(dLat / 2) +
               cos(lat1 * toRad) * cos(lat2 * toRad) * sin(dLon / 2) * sin(dLon / 2);
    return 2 * 6371.0 * asin(sqrt(h));          // 6371 km = radius of the Earth
}

int cityNumber(const std::string& name) {
    for (int i = 0; i < CITY_COUNT; i++)
        if (cities[i].name == name) return i;
    return -1;
}

double kmBetweenCities(int a, int b) {
    return kmBetween(cities[a].lat, cities[a].lon, cities[b].lat, cities[b].lon);
}

void setupAirspace() {
    // roads: distance from the coordinates, rounded to whole km, both ways
    for (int r = 0; r < ROAD_COUNT; r++) {
        int a = cityNumber(ROADS[r][0]);
        int b = cityNumber(ROADS[r][1]);
        int km = (int)(kmBetweenCities(a, b) + 0.5);

        roadKm[a][b] = km;
        roadKm[b][a] = km;
        neighbours[a].push_back(b);
        neighbours[b].push_back(a);
    }

    // hubs
    for (const std::string& hub : HUBS)
        cities[cityNumber(hub)].isHub = true;

    // region of each city = its nearest hub (a hub is its own region)
    for (int i = 0; i < CITY_COUNT; i++) {
        if (cities[i].isHub) { cities[i].region = i; continue; }

        int best = cityNumber(HUBS[0]);
        for (const std::string& hubName : HUBS) {
            int hub = cityNumber(hubName);
            if (kmBetweenCities(i, hub) < kmBetweenCities(i, best)) best = hub;
        }
        cities[i].region = best;
    }
}

int nearestCity(double lat, double lon) {
    int best = 0;
    for (int i = 1; i < CITY_COUNT; i++)
        if (kmBetween(lat, lon, cities[i].lat, cities[i].lon) < kmBetween(lat, lon, cities[best].lat, cities[best].lon)) best = i;
    return best;
}
