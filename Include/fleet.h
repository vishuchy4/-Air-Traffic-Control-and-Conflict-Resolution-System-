#ifndef FLEET_H
#define FLEET_H

// fleet.h : flight types, who flies them (operators), their aircraft, speeds,
// medical reasons, fuel price and airport capacity.

#include <string>
#include <vector>

struct Operator {
    std::string type;                   // flight type it flies
    std::string name;                   // "IndiGo"
    std::vector<std::string> aircraft;  // its planes
};

struct AircraftSpeed {
    std::string aircraft;
    int speed;  // usual cruising speed in km/h (approximate)
};

// What a plane can carry (typical numbers, approximate; airline layouts differ).
struct AircraftInfo {
    std::string aircraft;
    int seats;         // passenger seats (0 = cargo only)
    double cargo;      // tonnes of cargo (0 = no cargo)
    std::string note;  // what the plane is used for
};

// ---------- flight types: a BASE CLASS and one class per kind of flight (INHERITANCE) ----------
// Each kind answers the same questions in its own way (POLYMORPHISM, through virtual functions).
class FlightType {
   public:
    virtual ~FlightType() = default;
    virtual std::string name() const = 0;               // "Medical"
    virtual int priority() const = 0;                   // 5 = most important
    virtual int altitude() const = 0;                   // usual cruising altitude in ft
    virtual bool needsReason() const { return false; }  // only medical flights must say why they fly
    // Is the load right for this aircraft? "" = fine. Most kinds carry nothing that needs checking.
    virtual std::string checkLoad(const AircraftInfo& plane, double load) const {
        (void)plane;
        (void)load;
        return "";
    }
};

// All the kinds of flight, most important first (Medical, Rescue, Passenger, Cargo, Training).
const std::vector<const FlightType*>& flightTypes();
// The kind with this name, or nullptr if there is none.
const FlightType* findType(const std::string& name);

extern const std::vector<AircraftInfo> AIRCRAFT_INFO;
extern const std::vector<Operator> OPERATORS;
extern const std::vector<AircraftSpeed> SPEEDS;
extern const std::vector<std::string> BIG_JETS;  // only fly between two hubs
extern const std::vector<std::string> MEDICAL_REASONS;

const double ATF_PRICE_PER_LITRE = 137;  // rupees, jet fuel price from 1 Oct 2026 (update every month)
const char* const ATF_PRICE_DATE = "1 Oct 2026";
const double LITRES_PER_KM = 3.8;     // A320-size plane (estimate)
const double HUB_LANDING_GAP = 2;     // minutes between two landings at a hub (30 an hour)
const double SMALL_LANDING_GAP = 10;  // minutes between two landings at a small airport (6 an hour)

int priorityOf(const std::string& type);  // 0 if the type does not exist
int altitudeOf(const std::string& type);
int cruiseSpeed(const std::string& aircraft);  // 0 if the aircraft does not exist
bool isBigJet(const std::string& aircraft);
bool operatorFlies(const std::string& type, const std::string& op, const std::string& aircraft);
bool isMedicalReason(const std::string& reason);

AircraftInfo infoOf(const std::string& aircraft);       // seats, cargo, note
std::string capacityText(const std::string& aircraft);  // "180 seats", "39 t cargo", "92 people or 19 t cargo"

// Passenger flights say how many people fly, cargo flights how many tonnes. "" = fine.
std::string checkLoad(const std::string& type, const std::string& aircraft, double load);

#endif
