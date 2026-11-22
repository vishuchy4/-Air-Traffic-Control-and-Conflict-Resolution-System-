#include "fleet.h"

#include <algorithm>

const std::vector<Operator> OPERATORS = {
    {"Passenger", "Air India", {"Airbus A320neo", "Airbus A321neo", "Boeing 787-8"}},
    {"Passenger", "IndiGo", {"Airbus A320neo", "Airbus A321neo", "ATR 72-600"}},
    {"Passenger", "Akasa Air", {"Boeing 737-8"}},
    {"Passenger", "SpiceJet", {"Boeing 737-8"}},
    {"Passenger", "Air India Express", {"Boeing 737-8"}},
    {"Cargo", "Blue Dart Aviation", {"Boeing 757-200F", "Boeing 737-800F"}},
    {"Cargo", "Quikjet Cargo", {"Airbus A321F", "Boeing 737-800F"}},
    {"Cargo", "SpiceXpress", {"Boeing 737-800F"}},
    {"Medical", "Private air ambulance", {"Learjet 45", "Beechcraft King Air B200"}},
    {"Medical", "Government air ambulance", {"Pilatus PC-12", "Beechcraft King Air B200"}},
    {"Rescue", "Indian Air Force", {"Lockheed C-130J"}},
    {"Rescue", "Indian Navy", {"Boeing P-8I"}},
    {"Training", "Airline pilot training", {"Airbus A320neo"}},
    {"Training", "Indian Air Force training", {"BAE Hawk 132"}}};

const std::vector<AircraftSpeed> SPEEDS = {
    {"Airbus A320neo", 830},
    {"Airbus A321neo", 830},
    {"Boeing 787-8", 900},
    {"ATR 72-600", 510},
    {"Boeing 737-8", 840},
    {"Boeing 757-200F", 850},
    {"Boeing 737-800F", 840},
    {"Airbus A321F", 830},
    {"Learjet 45", 800},
    {"Beechcraft King Air B200", 530},
    {"Pilatus PC-12", 520},
    {"Lockheed C-130J", 640},
    {"Boeing P-8I", 815},
    {"BAE Hawk 132", 760}};

const std::vector<AircraftInfo> AIRCRAFT_INFO = {
    {"Airbus A320neo", 180, 0, "Passenger jet"},
    {"Airbus A321neo", 222, 0, "Passenger jet, long body"},
    {"Boeing 787-8", 256, 0, "Wide-body passenger jet"},
    {"ATR 72-600", 78, 0, "Turboprop for short routes"},
    {"Boeing 737-8", 189, 0, "Passenger jet"},
    {"Boeing 757-200F", 0, 39, "Freighter, cargo only"},
    {"Boeing 737-800F", 0, 23, "Freighter, cargo only"},
    {"Airbus A321F", 0, 28, "Freighter, cargo only"},
    {"Learjet 45", 8, 0, "Air ambulance: 1 stretcher patient + medical team"},
    {"Beechcraft King Air B200", 8, 0, "Air ambulance: 1 stretcher patient + medical team"},
    {"Pilatus PC-12", 9, 0, "Air ambulance: 1 stretcher patient + medical team"},
    {"Lockheed C-130J", 92, 19, "Military transport: people or cargo"},
    {"Boeing P-8I", 9, 0, "Patrol aircraft for search and rescue (crew)"},
    {"BAE Hawk 132", 2, 0, "Jet trainer: trainee + instructor"},
};

const std::vector<std::string> BIG_JETS = {"Airbus A321neo", "Boeing 787-8", "Boeing 757-200F", "Airbus A321F"};

const std::vector<std::string> MEDICAL_REASONS = {
    "Organ transport",
    "Critical patient transfer",
    "Cardiac emergency",
    "Accident or trauma patient",
    "Newborn (NICU) transfer",
    "Urgent blood or medicine supply"};

int priorityOf(const std::string& type) {
    const FlightType* kind = findType(type);
    return kind ? kind->priority() : 0;  // the right priority() runs for each kind (virtual call)
}

int altitudeOf(const std::string& type) {
    const FlightType* kind = findType(type);
    return kind ? kind->altitude() : 0;
}

int cruiseSpeed(const std::string& aircraft) {
    for (const AircraftSpeed& s : SPEEDS)
        if (s.aircraft == aircraft) return s.speed;
    return 0;
}

bool isBigJet(const std::string& aircraft) {
    return std::find(BIG_JETS.begin(), BIG_JETS.end(), aircraft) != BIG_JETS.end();
}

bool operatorFlies(const std::string& type, const std::string& op, const std::string& aircraft) {
    for (const Operator& o : OPERATORS)
        if (o.type == type && o.name == op)
            return std::find(o.aircraft.begin(), o.aircraft.end(), aircraft) != o.aircraft.end();
    return false;
}

bool isMedicalReason(const std::string& reason) {
    return std::find(MEDICAL_REASONS.begin(), MEDICAL_REASONS.end(), reason) != MEDICAL_REASONS.end();
}

AircraftInfo infoOf(const std::string& aircraft) {
    for (const AircraftInfo& a : AIRCRAFT_INFO)
        if (a.aircraft == aircraft) return a;
    return {aircraft, 0, 0, ""};
}

std::string number(double value) {  // 19 -> "19", 19.5 -> "19.5"
    std::string text = std::to_string(value);
    text.erase(text.find_last_not_of('0') + 1);
    if (text.back() == '.') text.pop_back();
    return text;
}

std::string capacityText(const std::string& aircraft) {
    AircraftInfo a = infoOf(aircraft);
    if (a.seats > 0 && a.cargo > 0) return std::to_string(a.seats) + " people or " + number(a.cargo) + " t cargo";
    if (a.cargo > 0) return number(a.cargo) + " t cargo";
    return std::to_string(a.seats) + " seats";
}

// ---------- the five kinds of flight (each INHERITS from FlightType) ----------
class MedicalFlight : public FlightType {
   public:
    std::string name() const override { return "Medical"; }
    int priority() const override { return 5; }
    int altitude() const override { return 33000; }
    bool needsReason() const override { return true; }  // must say why (organ transport, ...)
};

class RescueFlight : public FlightType {
   public:
    std::string name() const override { return "Rescue"; }
    int priority() const override { return 4; }
    int altitude() const override { return 32000; }
};

class PassengerFlight : public FlightType {
   public:
    std::string name() const override { return "Passenger"; }
    int priority() const override { return 3; }
    int altitude() const override { return 34000; }
    // passengers: a whole number of people, at most the number of seats
    std::string checkLoad(const AircraftInfo& plane, double load) const override {
        bool wholeNumber = (load == (int)load);
        if (!wholeNumber || load < 1 || load > plane.seats)
            return "Passengers must be a whole number from 1 to " + std::to_string(plane.seats) + " for the " + plane.aircraft + ".";
        return "";
    }
};

class CargoFlight : public FlightType {
   public:
    std::string name() const override { return "Cargo"; }
    int priority() const override { return 2; }
    int altitude() const override { return 31000; }
    // cargo: more than 0 tonnes, at most what the aircraft can carry
    std::string checkLoad(const AircraftInfo& plane, double load) const override {
        if (load <= 0 || load > plane.cargo)
            return "Cargo must be more than 0 and at most " + number(plane.cargo) + " tonnes for the " + plane.aircraft + ".";
        return "";
    }
};

class TrainingFlight : public FlightType {
   public:
    std::string name() const override { return "Training"; }
    int priority() const override { return 1; }
    int altitude() const override { return 30000; }
};

const std::vector<const FlightType*>& flightTypes() {
    static const MedicalFlight medical;
    static const RescueFlight rescue;
    static const PassengerFlight passenger;
    static const CargoFlight cargo;
    static const TrainingFlight training;
    static const std::vector<const FlightType*> all = {&medical, &rescue, &passenger, &cargo, &training};
    return all;  // base-class pointers to the different kinds
}

const FlightType* findType(const std::string& name) {
    for (const FlightType* kind : flightTypes())
        if (kind->name() == name) return kind;
    return nullptr;
}

std::string checkLoad(const std::string& type, const std::string& aircraft, double load) {
    const FlightType* kind = findType(type);
    return kind ? kind->checkLoad(infoOf(aircraft), load) : "";  // each kind checks its own load (virtual call)
}
