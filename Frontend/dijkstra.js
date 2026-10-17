// dijkstra.js : finds the CHEAPEST route between two cities.
// Same idea as routes.cpp in the C++ backend.

// COST of flying one road (from city a to city b).
// Same formula as roadCost() in routes.cpp:
//   cost = distance + 2*time + 3*fuel + 5*weather + 5*conflictRisk
function legCost(a, b) {
  const distance = edgeBetween(a, b).distance;
  const time = distance * 0.16;      // time is guessed from distance
  const fuel = distance * 0.12;      // fuel is guessed from distance
  const risk = 5;                    // same conflict risk for every road
  const weather = weatherPenalty(a); // bad weather at the starting city makes the road costlier
  return distance + 2 * time + 3 * fuel + 5 * weather + 5 * risk;
}

// DIJKSTRA: start city -> end city.
// "banned" is optional: a road [fromCity, toCity] that we are NOT allowed to use (for "another route").
// "avoid" is optional: a list of cities we must NOT fly through (for storms).
// Returns { path: [city numbers], cost: total cost }, or null if there is no route.
function dijkstra(start, end, banned, avoid) {
  const n = cities.length;
  const cost = Array(n).fill(Infinity);   // cheapest cost found so far for each city
  const before = Array(n).fill(-1);       // which city we came from (to rebuild the path)
  const done = Array(n).fill(false);      // true when a city is finished
  cost[start] = 0;

  for (let round = 0; round < n; round++) {
    // Step 1: pick the unfinished city with the smallest cost.
    let now = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && (now === -1 || cost[i] < cost[now])) now = i;
    }
    if (now === -1 || cost[now] === Infinity) break;
    done[now] = true;

    // Step 2: look at every road leaving that city. Is the new way cheaper?
    for (const road of edges) {
      if (road.from !== now) continue;
      if (banned && road.from === banned[0] && road.to === banned[1]) continue;
      if (avoid && avoid.includes(road.to)) continue;
      const newCost = cost[now] + legCost(road.from, road.to);
      if (newCost < cost[road.to]) {
        cost[road.to] = newCost;
        before[road.to] = now;
      }
    }
  }

  if (cost[end] === Infinity) return null;

  // Step 3: walk backwards from the end city to build the path.
  const path = [];
  for (let c = end; c !== -1; c = before[c]) path.push(c);
  path.reverse();
  return { path: path, cost: Math.round(cost[end]) };
}

// ROUTE OPTIONS: the best route, plus other routes found by closing one road of the best route at a time.
// Returns up to 3 routes, cheapest first.
function routeOptions(start, end) {
  const best = dijkstra(start, end);
  if (!best) return [];
  const list = [best];
  for (let i = 0; i < best.path.length - 1; i++) {
    const other = dijkstra(start, end, [best.path[i], best.path[i + 1]]);   // close one road, try again
    if (other && !list.some(r => r.path.join() === other.path.join())) list.push(other);
  }
  list.sort((a, b) => a.cost - b.cost);
  return list.slice(0, 3);
}
