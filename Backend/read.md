# AeroGuard backend (Phase 2)

| File | What it does |
|---|---|
| `airspace.h/.cpp` | 26 cities, the air routes between them, distances from coordinates (haversine), hubs and regions |
| `routes.h/.cpp` | Road cost and Dijkstra: the cheapest route and 2-3 route options |
| `planes.h/.cpp` | Where a plane is now and where it will be later |
| `safety.h/.cpp` | Conflict check (closer than 100 km and less than 1,000 ft) and the fixes: altitude, speed, route |
| `server.cpp` | Small web server: sends the website and answers its questions (routes, conflicts) |

## Build and run
Windows (MSYS2 UCRT64):
```
make SOCKET_LIB="-lws2_32 -static"
./aeroguard_server.exe
```
Linux / Mac: `make` then `./aeroguard_server`

Open http://localhost:8080 - the website shows "C++ backend: connected".
