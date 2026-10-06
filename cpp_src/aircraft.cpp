#include <iostream>

#include "CpAircraft.h"

Aircraft::Aircraft(
    const std::string& id,
    const std::string& type,
    int p,
    int current,
    int destination,
    int alt,
    int spd,
    int fuelLevel)
    : flightID(id),
      flightType(type),
      priority(p),
      currentNode(current),
      destinationNode(destination),
      altitude(alt),
      speed(spd),
      fuel(fuelLevel) {
}

void Aircraft::updatePosition(
    int position) {
    currentNode = position;
}

void Aircraft::updateAltitude(
    int newAltitude) {
    altitude = newAltitude;
}

void Aircraft::updateSpeed(
    int newSpeed) {
    speed = newSpeed;
}

void Aircraft::reduceFuel(
    int amount) {
    fuel -= amount;

    if (fuel < 0)
        fuel = 0;
}

const std::string&
Aircraft::getFlightID() const {
    return flightID;
}

const std::string&
Aircraft::getFlightType() const {
    return flightType;
}

int Aircraft::getPriority() const {
    return priority;
}

int Aircraft::getCurrentNode() const {
    return currentNode;
}

int Aircraft::getDestinationNode() const {
    return destinationNode;
}

int Aircraft::getAltitude() const {
    return altitude;
}

int Aircraft::getSpeed() const {
    return speed;
}

int Aircraft::getFuel() const {
    return fuel;
}

void Aircraft::displayStatus() const {
    std::cout
        << "\n========== C++ AIRCRAFT ==========\n";

    std::cout
        << "Flight ID: "
        << flightID
        << '\n';

    std::cout
        << "Type: "
        << flightType
        << '\n';

    std::cout
        << "Priority: "
        << priority
        << '\n';

    std::cout
        << "Current Node: "
        << currentNode
        << '\n';

    std::cout
        << "Destination: "
        << destinationNode
        << '\n';

    std::cout
        << "Altitude: "
        << altitude
        << " ft\n";

    std::cout
        << "Speed: "
        << speed
        << " km/h\n";

    std::cout
        << "Fuel: "
        << fuel
        << "%\n";

    std::cout
        << "===================================\n";
}