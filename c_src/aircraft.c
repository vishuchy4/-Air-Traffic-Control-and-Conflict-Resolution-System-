#include "aircraft.h"

#include <stdio.h>

void initializeAircraft(
    Aircraft* aircraft,
    const char flightID[],
    const char flightType[],
    int priority,
    int source,
    int destination,
    int altitude,
    int speed) {
    if (!aircraft)
        return;

    snprintf(
        aircraft->flightID,
        AIRCRAFT_ID_SIZE,
        "%s",
        flightID ? flightID : "");

    snprintf(
        aircraft->flightType,
        AIRCRAFT_TYPE_SIZE,
        "%s",
        flightType ? flightType : "");

    aircraft->priority = priority;

    aircraft->currentNode =
        source;

    aircraft->destinationNode =
        destination;

    aircraft->altitude =
        altitude;

    aircraft->speed =
        speed;

    aircraft->fuel = 100;
}

void displayAircraft(
    const Aircraft* aircraft,
    const Graph* graph) {
    if (!aircraft || !graph)
        return;

    printf(
        "\n========== C AIRCRAFT STATUS ==========\n");

    printf(
        "Flight ID: %s\n",
        aircraft->flightID);

    printf(
        "Type: %s\n",
        aircraft->flightType);

    printf(
        "Priority: %d\n",
        aircraft->priority);

    if (aircraft->currentNode >= 0 &&
        aircraft->currentNode <
            graph->nodeCount) {
        printf(
            "Position: %s\n",
            graph->nodes[aircraft->currentNode].name);
    }

    if (aircraft->destinationNode >= 0 &&
        aircraft->destinationNode <
            graph->nodeCount) {
        printf(
            "Destination: %s\n",
            graph->nodes[aircraft->destinationNode].name);
    }

    printf(
        "Altitude: %d ft\n",
        aircraft->altitude);

    printf(
        "Speed: %d km/h\n",
        aircraft->speed);

    printf(
        "Fuel: %d %%\n",
        aircraft->fuel);

    printf(
        "=======================================\n");
}

void moveAircraft(
    Aircraft* aircraft,
    const Graph* graph,
    int nextNode,
    int fuelUsed) {
    if (!aircraft ||
        !graph ||
        nextNode < 0 ||
        nextNode >= graph->nodeCount ||
        aircraft->currentNode < 0 ||
        aircraft->currentNode >= graph->nodeCount) {
        return;
    }

    printf(
        "\nAircraft %s moving: %s -> %s\n",
        aircraft->flightID,
        graph->nodes[aircraft->currentNode].name,
        graph->nodes[nextNode].name);

    aircraft->currentNode =
        nextNode;

    aircraft->fuel -= fuelUsed;

    if (aircraft->fuel < 0)
        aircraft->fuel = 0;
}