# AeroGuard (frontend)

Made with plain HTML, CSS and JavaScript. No framework, nothing to install.

## Run
    python -m http.server 8000        (Mac: python3 -m http.server 8000)
Open http://localhost:8000  (Ctrl+C to stop). Live weather needs internet.

## Files (load order)
1. index.html   page structure
2. style.css    design
3. data.js      cities, connections, flight types, ATF price
4. dijkstra.js  cheapest route + route options
5. weather.js   live weather, penalty, sample/demo weather
6. conflict.js  conflict now + controller tools
7. predict.js   conflict prediction (60 min) + What-if
8. map.js       radar
9. main.js      screens, tabs, flying planes

Read SAMJHO.md for the explanation in simple Hinglish.
