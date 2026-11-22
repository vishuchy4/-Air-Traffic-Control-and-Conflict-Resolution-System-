#include "weather.h"

#include "routes.h"

CityWeather weather[CITY_COUNT];

struct SampleWeather {
    std::string city;
    double temp, wind, rain;
    int code;
};

// Sample weather for a demo (NOT real data).
const SampleWeather SAMPLE[CITY_COUNT] = {
    {"Delhi", 31, 12, 0, 1},
    {"Mumbai", 29, 26, 7, 63},
    {"Bengaluru", 24, 14, 0, 3},
    {"Chennai", 32, 18, 0, 2},
    {"Kolkata", 28, 48, 9, 95},
    {"Hyderabad", 29, 13, 0, 1},
    {"Ahmedabad", 33, 15, 0, 0},
    {"Pune", 27, 12, 1, 61},
    {"Jaipur", 32, 16, 0, 0},
    {"Lucknow", 30, 10, 0, 2},
    {"Chandigarh", 27, 9, 0, 1},
    {"Dehradun", 24, 8, 2, 61},
    {"Agra", 32, 11, 0, 0},
    {"Bhopal", 28, 13, 0, 2},
    {"Indore", 27, 14, 0, 3},
    {"Nagpur", 30, 12, 0, 1},
    {"Patna", 31, 20, 3, 80},
    {"Varanasi", 31, 12, 0, 1},
    {"Guwahati", 26, 22, 6, 81},
    {"Bhubaneswar", 29, 28, 4, 80},
    {"Visakhapatnam", 29, 24, 0, 2},
    {"Kochi", 27, 20, 8, 63},
    {"Thiruvananthapuram", 28, 18, 5, 61},
    {"Goa", 28, 22, 4, 80},
    {"Srinagar", 14, 5, 0, 45},
    {"Raipur", 30, 11, 0, 1}
};

// The weather the controller can set by hand, in this order.
const CityWeather HAND_WEATHER[4] = {
    {"hand", 28, 10, 0, 0},
    {"hand", 26, 55, 12, 95},
    {"hand", 14, 5, 0, 45},
    {"hand", 24, 45, 10, 65}
};

int penaltyFor(double wind, double rain, int code) {
    int penalty = 0;
    if (wind > 40) penalty += 2;                      // strong wind
    if (rain > 5) penalty += 2;                       // heavy rain
    if (code == 45 || code == 48) penalty += 3;       // fog
    if (code >= 95) penalty += 3;                     // thunderstorm
    return penalty;
}

int penaltyOf(int city) {
    const CityWeather& w = weather[city];
    if (w.source == "none") return 0;                 // no data: no penalty
    return penaltyFor(w.wind, w.rain, w.code);
}

bool isSevere(int city) {
    return penaltyOf(city) >= SEVERE;
}

std::string describe(int code) {
    if (code >= 95) return "Thunderstorm";
    if (code >= 80) return "Rain showers";
    if (code >= 61) return "Rain";
    if (code >= 51) return "Drizzle";
    if (code >= 45) return "Fog";
    if (code == 3) return "Cloudy";
    if (code >= 1) return "Partly cloudy";
    return "Clear sky";
}

void setLiveWeather(int city, double temp, double wind, double rain, int code) {
    if (weather[city].source == "hand") return;       // keep weather set by hand
    weather[city] = {"live", temp, wind, rain, code};
}

void useSampleWeather() {
    for (const SampleWeather& s : SAMPLE)
        for (int i = 0; i < CITY_COUNT; i++)
            if (cities[i].name == s.city && weather[i].source != "hand")
                weather[i] = {"sample", s.temp, s.wind, s.rain, s.code};
}

void setWeatherByHand(int city) {
    int now = -1;                                      // where we are in the list
    if (weather[city].source == "hand")
        for (int i = 0; i < 4; i++)
            if (HAND_WEATHER[i].code == weather[city].code) now = i;
    weather[city] = HAND_WEATHER[(now + 1) % 4];
}

void clearWeather() {
    for (CityWeather& w : weather) w = CityWeather();
}

void usePenaltiesFromWeather() {
    for (int i = 0; i < CITY_COUNT; i++) weatherPenalty[i] = penaltyOf(i);
}
