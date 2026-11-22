#ifndef ATC_H
#define ATC_H

// atc.h : AirTraffic = the whole air traffic control system in one class.
// It keeps the planes, moves them on the clock, finds conflicts, runs the countdown,
// handles landings and holding, and gives the controller the tools to fix things.
// The controller (the user) always decides; the system finds problems and suggests.

#include <string>
#include <unordered_map>
#include <vector>

#include "planes.h"
#include "routes.h"
#include "safety.h"

const double SECONDS_PER_FLIGHT_HOUR = 120;   // 1 hour of flying = 120 seconds on screen (at 1x)
const double DECISION_SECONDS = 30;           // time to clear a conflict before a crash
const int TOUCH_KM = 5;                       // closer than this ...
const int TOUCH_FEET = 500;                   // ... and this = the planes hit each other

struct Conflict {
    std::string a, b;       // the two plane IDs
    double secondsLeft;     // countdown
    bool acted;             // true after a speed or route change (they need time to work)
    double lastKm;          // distance at the last check (to know if they are getting closer)
};

struct ComingConflict {
    std::string a, b;
    Prediction prediction;  // minute, closest km, height gap, where
};

struct FixTest {
    std::string kind;       // "alt", "spd" or "route"
    int amount;             // ft or km/h
    std::string label;      // "Raise AG002 by 1,000 ft"
    int result;             // 1 fixes it, 0 still too close, -1 not possible now
};

struct StormAlert {
    std::string planeId;
    std::string key;                 // to remember "keep route"
    bool atDestination;              // storm at the destination: cannot be avoided
    std::vector<int> storms;         // the storm cities
    bool canGoAround;
    std::vector<int> newRoute;       // the route around the storms
    int startLeg = 0;
    int extraKm = 0;
};

// "Delhi > Agra > Dehradun"
std::string routeText(const std::vector<int>& route);

// What-if: 1 if the changed copy of a plane is safe from the other plane (now and for 60 minutes), else 0.
int fixesIt(const Plane& copy, const Plane& other);

class AirTraffic {
public:
    std::vector<Plane> planes;
    std::vector<Conflict> conflicts;
    std::vector<std::string> log;

    bool paused = false;      // paused by the controller
    bool waiting = false;     // frozen until the controller acts on a new conflict
    int speedX = 1;           // 1x, 2x or 4x
    double flightMinutes = 0; // flight minutes the planes have moved (airport clock)

    int resolved = 0;         // conflicts fixed by the controller
    int prevented = 0;        // conflicts stopped before they happened
    int crashes = 0;
    int weatherReroutes = 0;  // planes flown around bad weather

    AirTraffic();

    // ---------- planning ----------
    // "" if the plan is fine, otherwise the problem (same messages as the UI)
    // load = passengers (Passenger flight) or tonnes (Cargo flight); not used for other types
    std::string checkPlan(int from, int to, const std::string& type, const std::string& airline,
                          const std::string& aircraft, const std::string& reason, double load);
    std::vector<Route> routeOptions(int from, int to);
    // Starts the flight on route option number "option". Returns the new ID, or "" if the plan is wrong.
    // departIn = 0: take off now. More than 0: scheduled, takes off after that many flight minutes.
    std::string startFlight(int from, int to, const std::string& type, const std::string& airline,
                            const std::string& aircraft, const std::string& reason, double load, int option,
                            double departIn = 0);

    // ---------- times ----------
    // The flight clock starts at this computer's time and runs with the simulation.
    std::string clockText(double minutes);       // flight minutes -> "14:35"
    double expectedArrival(const Plane& p);      // minutes, or -1 while holding / crashed
    int delayMinutes(const Plane& p);            // how late (0 = on time)

    // ---------- the clock ----------
    void update(double realSeconds);     // let time pass (in small steps)
    std::string togglePause();           // "" or the reason it is not allowed
    void setSpeed(int x);

    // ---------- the controller's 3 tools ("" = done, otherwise why not) ----------
    std::string changeAltitude(const std::string& id, int amount);
    std::string changeSpeed(const std::string& id, int amount);
    std::string changeRoute(const std::string& id);

    // ---------- prediction ----------
    std::vector<ComingConflict> comingConflicts();
    std::vector<FixTest> fixTests(const std::string& changeId, const std::string& otherId);
    std::string applyFix(const std::string& changeId, const std::string& otherId, const std::string& kind, int amount);

    // ---------- weather on the routes ----------
    std::vector<StormAlert> stormAlerts();
    std::string flyAround(const std::string& planeId);
    void keepRoute(const std::string& key);

    // ---------- airports ----------
    std::vector<std::string> holdingQueue(int city);   // plane IDs, next to land first

    // ---------- small helpers ----------
    Plane* findPlane(const std::string& id);
    double kmLeft(const Plane& p);
    static int routeKm(const std::vector<int>& route);
    void addLog(const std::string& text);

private:
    int nextId = 1;
    std::unordered_map<std::string, size_t> planeIndex;   // HASH TABLE: plane ID -> its place in "planes"
    int clockStart = 0;                          // minute of the day when the program started
    std::vector<double> lastLanding = std::vector<double>(CITY_COUNT, -1);   // -1 = no landing yet
    std::vector<std::string> keptRoutes;

    void tick(double seconds);
    void movePlanes(double seconds);
    void updateAirports(double minutes);
    void checkConflicts();
    void countDown(double seconds);
    void crash(const std::string& a, const std::string& b, const std::string& why);
    void afterAction(bool needsTime);
    void markActed(const std::string& id);
    Conflict* findConflict(const std::string& a, const std::string& b);   // the conflict of this pair, or nullptr
    bool isConflictNow(const std::string& a, const std::string& b);
};

#endif
