#ifndef WEATHER_H
#define WEATHER_H

// weather.h : the weather of every city and how much it costs to fly from there.
//
// Where a city's weather comes from (source):
//   "none"   : no data (never fake sunshine)
//   "live"   : real weather (the browser downloads it from Open-Meteo and sends it here)
//   "sample" : sample numbers for a demo
//   "hand"   : set by the controller (Clear -> Thunderstorm -> Fog -> Heavy rain)

#include <string>

#include "airspace.h"

struct CityWeather {
    std::string source = "none";
    double temp = 0;    // C
    double wind = 0;    // km/h
    double rain = 0;    // mm
    int code = 0;       // weather code (0 clear ... 45 fog ... 95 thunderstorm)
};

extern CityWeather weather[CITY_COUNT];

const int SEVERE = 3;   // penalty 3 or more = severe weather

// wind over 40 km/h +2, rain over 5 mm +2, fog +3, thunderstorm +3
int penaltyFor(double wind, double rain, int code);   // for any weather values (e.g. one past day)
int penaltyOf(int city);                              // for a city's weather now
bool isSevere(int city);
std::string describe(int code);        // "Thunderstorm", "Fog", ...

void setLiveWeather(int city, double temp, double wind, double rain, int code);   // keeps hand-set weather
void useSampleWeather();
void setWeatherByHand(int city);       // next one in Clear -> Thunderstorm -> Fog -> Heavy rain
void clearWeather();                   // everything back to "no data"

// Copies every penalty into routes (so Dijkstra uses the current weather).
void usePenaltiesFromWeather();

#endif
