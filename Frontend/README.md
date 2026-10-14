# AeroGuard Complete Frontend

A role-based frontend prototype for:
AeroGuard: Air Traffic Control and Conflict Resolution System

## Run
Open `index.html` in a browser, or use VS Code Live Server.

## Demo accounts
ATC:
- username: atc
- password: 1234

User:
- username: user
- password: 1234

## Included
- ATC dashboard
- User flight dashboard
- Role-based navigation
- Animated aircraft
- Animated selected route
- Airspace graph visualization
- Flight management table
- Route planner / Dijkstra simulation UI
- Conflict detection and resolution UI
- Weather intelligence
- Priority queue
- Analytics
- Add-flight modal
- Responsive layout

## Important
This is a frontend simulation. The buttons and displayed algorithm results are currently simulated in JavaScript.

Next integration:
Frontend -> API/data interface -> C/C++ AeroGuard core

The frontend should receive real:
- graph route
- Dijkstra result
- flight position
- weather penalty
- priority
- conflict state
- resolution
from the backend.
