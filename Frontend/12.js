/* ================= LOGIN ================= */

function showLogin() {

    document.getElementById("loginForm")
        .classList.remove("hidden");

    document.getElementById("signupForm")
        .classList.add("hidden");

    document.getElementById("loginTab")
        .classList.add("active");

    document.getElementById("signupTab")
        .classList.remove("active");
}


function showSignup() {

    document.getElementById("loginForm")
        .classList.add("hidden");

    document.getElementById("signupForm")
        .classList.remove("hidden");

    document.getElementById("signupTab")
        .classList.add("active");

    document.getElementById("loginTab")
        .classList.remove("active");
}


/* ================= LOGIN ================= */

function login() {

    const username =
        document.getElementById("username").value;

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;


    if (
        username === "atc" &&
        password === "1234"
    ) {

        startApplication("ATC Controller");

        return;
    }


    if (
        username === "user" &&
        password === "1234"
    ) {

        startApplication("Flight User");

        return;
    }


    alert("Invalid login!\n\nDemo:\natc / 1234\nuser / 1234");
}


/* ================= SIGN UP ================= */

function signup() {

    const name =
        document.getElementById("signupName").value;

    const username =
        document.getElementById("signupUsername").value;

    const password =
        document.getElementById("signupPassword").value;


    if (!name || !username || !password) {

        alert("Please fill all fields.");

        return;
    }


    localStorage.setItem(
        "aeroUser",
        JSON.stringify({
            name,
            username,
            password
        })
    );


    alert("Account created successfully!");

    showLogin();
}


/* ================= START APP ================= */

function startApplication(role) {

    document
        .getElementById("loginPage")
        .classList.add("hidden");


    document
        .getElementById("app")
        .classList.remove("hidden");


    document
        .getElementById("currentRole")
        .textContent = role;


    if (role === "ATC Controller") {

        document
            .getElementById("atcMenu")
            .classList.remove("hidden");

        document
            .getElementById("userMenu")
            .classList.add("hidden");

        openPage("dashboard");

    } else {

        document
            .getElementById("atcMenu")
            .classList.add("hidden");

        document
            .getElementById("userMenu")
            .classList.remove("hidden");

        openPage("userDashboard");

    }

}


/* ================= LOGOUT ================= */

function logout() {

    document
        .getElementById("app")
        .classList.add("hidden");


    document
        .getElementById("loginPage")
        .classList.remove("hidden");

}


/* ================= PAGE NAVIGATION ================= */

function openPage(page) {

    const pages =
        document.querySelectorAll(".page");


    pages.forEach(function(p) {

        p.classList.add("hidden");

    });


    document
        .getElementById(page)
        .classList.remove("hidden");


    const titles = {

        dashboard:
            "Air Traffic Control Dashboard",

        route:
            "Dynamic Route Planner",

        flights:
            "Flight Management",

        airports:
            "Airport Management",

        conflicts:
            "Conflict Management",

        weather:
            "Live Weather Intelligence",

        priority:
            "Priority Queue",

        userDashboard:
            "My Flight"

    };


    document
        .getElementById("pageTitle")
        .textContent = titles[page];

}


/* ================= CLOCK ================= */

function updateClock() {

    const now = new Date();

    document
        .getElementById("clock")
        .textContent =
        now.toLocaleTimeString();

}

setInterval(updateClock, 1000);

updateClock();


/* ================= CONFLICT ================= */

function resolveConflict(type) {

    alert(
        "Conflict Resolution\n\n" +
        "Method: " + type +
        "\n\nAI-101 and AI-205 separation restored."
    );


    document
        .getElementById("conflictNumber")
        .textContent = "0";

}


/* ================= ROUTE PLANNER ================= */

function calculateRoute() {

    const source =
        document.getElementById("source").value;

    const destination =
        document.getElementById("destination").value;

    const priority =
        document.getElementById("priority").value;


    if (source === destination) {

        alert("Source and destination cannot be same.");

        return;
    }


    document
        .getElementById("routeStatus")
        .textContent =
        "Analyzing graph and conditions...";


    /*
       Simulating the backend algorithm.

       Actual backend later:

       C/C++ Dijkstra
       +
       Weather
       +
       Traffic
       +
       Conflict
       +
       Fuel
    */


    setTimeout(function() {

        document
            .getElementById("routeStatus")
            .textContent =
            "Route calculated using multiple conditions.";


        document
            .getElementById("distance")
            .textContent =
            "1,145 km";


        document
            .getElementById("time")
            .textContent =
            "2h 32m";


        document
            .getElementById("fuel")
            .textContent =
            "4,200 L";


        document
            .getElementById("risk")
            .textContent =
            "LOW";


        document
            .getElementById("routeWeather")
            .textContent =
            "Favorable";


        const plane =
            document.getElementById("routePlane");


        plane.classList.remove("animate");


        void plane.offsetWidth;


        plane.classList.add("animate");


    }, 1000);

}


/* ================= SIMULATED WEATHER ================= */

const weatherConditions = [

    {
        icon: "☀",
        name: "Clear",
        wind: "18 km/h",
        visibility: "10 km",
        rain: "10%"
    },

    {
        icon: "☁",
        name: "Cloudy",
        wind: "25 km/h",
        visibility: "8 km",
        rain: "20%"
    },

    {
        icon: "🌧",
        name: "Rain",
        wind: "35 km/h",
        visibility: "5 km",
        rain: "70%"
    },

    {
        icon: "⛈",
        name: "Thunderstorm",
        wind: "60 km/h",
        visibility: "3 km",
        rain: "90%"
    }

];


function updateWeather() {

    const data =
        weatherConditions[
            Math.floor(
                Math.random() *
                weatherConditions.length
            )
        ];


    document
        .getElementById("weatherIcon")
        .textContent = data.icon;


    document
        .getElementById("weatherCondition")
        .textContent = data.name;


    document
        .getElementById("wind")
        .textContent = data.wind;


    document
        .getElementById("visibility")
        .textContent = data.visibility;


    document
        .getElementById("rain")
        .textContent = data.rain;

}


updateWeather();

setInterval(updateWeather, 15000);