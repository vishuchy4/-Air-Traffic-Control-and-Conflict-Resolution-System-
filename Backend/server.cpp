#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "airspace.h"
#include "routes.h"
#include "safety.h"

#ifdef _WIN32
#include <winsock2.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#define closesocket close
typedef int SOCKET;
#endif

using namespace std;

string urlDecode(const string& text) {
    string out;
    for (size_t i = 0; i < text.size(); i++) {
        if (text[i] == '+') out += ' ';
        else if (text[i] == '%' && i + 2 < text.size()) {
            out += (char)strtol(text.substr(i + 1, 2).c_str(), nullptr, 16);
            i += 2;
        }
        else out += text[i];
    }
    return out;
}

map<string, string> readForm(const string& text) {
    map<string, string> form;
    stringstream ss(text);
    string pair;
    while (getline(ss, pair, '&')) {
        size_t eq = pair.find('=');
        if (eq != string::npos)
            form[urlDecode(pair.substr(0, eq))] = urlDecode(pair.substr(eq + 1));
    }
    return form;
}

vector<string> split(const string& text, char sep) {
    vector<string> parts;
    stringstream ss(text);
    string part;
    while (getline(ss, part, sep)) parts.push_back(part);
    return parts;
}

vector<int> readNumbers(const string& text) {
    vector<int> numbers;
    for (const string& p : split(text, ','))
        if (!p.empty()) numbers.push_back(atoi(p.c_str()));
    return numbers;
}

void readWeather(const string& text) {
    vector<int> pen = readNumbers(text);
    for (int i = 0; i < CITY_COUNT; i++)
        weatherPenalty[i] = i < (int)pen.size() ? pen[i] : 0;
}

bool readPlane(const string& text, Plane& p) {
    vector<string> f = split(text, ';');
    if (f.size() < 8) return false;

    p.id = f[0];
    p.priority = atoi(f[1].c_str());
    p.route = readNumbers(f[2]);
    p.leg = atoi(f[3].c_str());
    p.progress = atof(f[4].c_str());
    p.altitude = atoi(f[5].c_str());
    p.speed = atoi(f[6].c_str());
    p.status = atoi(f[7].c_str());

    if (p.route.size() < 2 || p.leg < 0 || p.leg >= (int)p.route.size()) return false;
    for (int city : p.route)
        if (city < 0 || city >= CITY_COUNT) return false;

    return true;
}

string num(double value) {
    char text[32];
    snprintf(text, sizeof(text), "%.3f", value);
    return text;
}

string routeJson(const Route& r) {
    string path = "[";
    for (size_t i = 0; i < r.cities.size(); i++)
        path += to_string(r.cities[i]) + (i + 1 < r.cities.size() ? "," : "");
    return "{\"path\":" + path + "],\"cost\":" + to_string(r.cost) + ",\"km\":" + to_string(r.km) + "}";
}

string pointJson(const Point& p) {
    return "{\"lat\":" + num(p.lat) + ",\"lon\":" + num(p.lon) + "}";
}

string answerPing() {
    return "{\"ok\":true,\"name\":\"AeroGuard C++ backend\",\"cities\":" + to_string(CITY_COUNT) + "}";
}

string answerAirspace() {
    string cityList, roadList;
    for (int a = 0; a < CITY_COUNT; a++) {
        if (a > 0) cityList += ",";
        cityList += "{\"name\":\"" + cities[a].name + "\",\"lat\":" + num(cities[a].lat) + ",\"lon\":" + num(cities[a].lon) +
                    ",\"macro\":" + (cities[a].isHub ? "1" : "0") + ",\"region\":" + to_string(cities[a].region) + "}";

        for (int b = 0; b < CITY_COUNT; b++) {
            if (roadKm[a][b] == 0) continue;
            if (!roadList.empty()) roadList += ",";
            roadList += "{\"from\":" + to_string(a) + ",\"to\":" + to_string(b) + ",\"km\":" + to_string(roadKm[a][b]) + "}";
        }
    }
    return "{\"cities\":[" + cityList + "],\"roads\":[" + roadList + "]}";
}

string answerRoutes(map<string, string>& form) {
    int from = atoi(form["from"].c_str());
    int to = atoi(form["to"].c_str());
    readWeather(form["pen"]);
    if (from < 0 || to < 0 || from >= CITY_COUNT || to >= CITY_COUNT)
        return "{\"options\":[]}";

    vector<Route> options;

    if (form.count("avoid") || form.count("bannedFrom")) {
        vector<int> avoid = readNumbers(form["avoid"]);
        int bannedFrom = form.count("bannedFrom") ? atoi(form["bannedFrom"].c_str()) : NONE;
        int bannedTo = form.count("bannedTo") ? atoi(form["bannedTo"].c_str()) : NONE;
        Route r;
        if (findRoute(from, to, bannedFrom, bannedTo, avoid, r))
            options.push_back(r);
    }
    else {
        options = findRouteOptions(from, to);
    }

    string list;
    for (size_t i = 0; i < options.size(); i++)
        list += (i ? "," : "") + routeJson(options[i]);

    return "{\"options\":[" + list + "]}";
}

string answerCheck(map<string, string>& form) {
    readWeather(form["pen"]);
    vector<Plane> planes;

    for (const string& text : split(form["planes"], '|')) {
        Plane p;
        if (readPlane(text, p)) planes.push_back(p);
    }

    string now, coming;
    for (size_t i = 0; i < planes.size(); i++) {
        for (size_t j = i + 1; j < planes.size(); j++) {
            Plane& a = planes[i];
            Plane& b = planes[j];

            if (inConflict(a, b)) {
                if (!now.empty()) now += ",";
                now += "{\"a\":\"" + a.id + "\",\"b\":\"" + b.id + "\",\"km\":" + num(kmApart(a, b)) +
                       ",\"feet\":" + to_string(feetApart(a, b)) + "}";
                continue;
            }

            if (a.status != FLYING || b.status != FLYING) continue;

            Prediction p = predictConflict(a, b);
            if (!p.found) continue;

            if (!coming.empty()) coming += ",";
            coming += "{\"a\":\"" + a.id + "\",\"b\":\"" + b.id + "\",\"start\":" + to_string(p.startMinute) +
                      ",\"km\":" + num(p.closestKm) + ",\"feet\":" + to_string(p.feet) +
                      ",\"pa\":" + pointJson(p.a) + ",\"pb\":" + pointJson(p.b) + "}";
        }
    }

    return "{\"conflicts\":[" + now + "],\"predictions\":[" + coming + "]}";
}

string answerWhatIf(map<string, string>& form) {
    readWeather(form["pen"]);
    Plane change, other;

    if (!readPlane(form["change"], change) || !readPlane(form["other"], other))
        return "{\"tests\":[]}";

    auto fixes = [&](const Plane& copy) {
        return (!predictConflict(copy, other).found && !inConflict(copy, other)) ? 1 : 0;
    };

    int up = change.altitude + 1000 <= 40000 ? 1000 : -1000;
    Plane newRoute;
    int routeResult = withNewRoute(change, newRoute) ? fixes(newRoute) : -1;

    return "{\"tests\":["
           "{\"kind\":\"alt\",\"amount\":" + to_string(up) + ",\"result\":" + to_string(fixes(withAltitude(change, up))) + "},"
           "{\"kind\":\"spd\",\"amount\":-100,\"result\":" + to_string(fixes(withSpeed(change, -100))) + "},"
           "{\"kind\":\"route\",\"amount\":0,\"result\":" + to_string(routeResult) + "}]}";
}

bool readFile(const string& path, string& content) {
    ifstream file(path, ios::binary);
    if (!file) return false;

    stringstream ss;
    ss << file.rdbuf();
    content = ss.str();
    return true;
}

string typeOf(const string& name) {
    if (name.find(".html") != string::npos) return "text/html; charset=utf-8";
    if (name.find(".css") != string::npos) return "text/css; charset=utf-8";
    if (name.find(".js") != string::npos) return "text/javascript; charset=utf-8";
    return "text/plain; charset=utf-8";
}

void sendReply(SOCKET client, int status, const string& type, const string& body) {
    string reply = "HTTP/1.1 " + to_string(status) + (status == 200 ? " OK" : " Error") + "\r\n"
                   "Content-Type: " + type + "\r\n"
                   "Content-Length: " + to_string(body.size()) + "\r\n"
                   "Cache-Control: no-store\r\n"
                   "Connection: close\r\n\r\n" + body;

    send(client, reply.c_str(), (int)reply.size(), 0);
}

int main(int argc, char* argv[]) {
    int port = argc > 1 ? atoi(argv[1]) : 8080;
    string uiFolder = argc > 2 ? argv[2] : "../frontend";

    setupAirspace();

#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif

    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, (const char*)&yes, sizeof(yes));

    sockaddr_in address = {};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons((unsigned short)port);

    if (bind(server, (sockaddr*)&address, sizeof(address)) < 0 || listen(server, 10) < 0) {
        cout << "Could not use port " << port << ". Try another one, e.g. ./aeroguard_server 9000" << endl;
        return 1;
    }

    cout << "UI files from: " << uiFolder << endl;
    cout << "AeroGuard server running. Open http://localhost:" << port << "  (Ctrl+C to stop)" << endl;

    while (true) {
        SOCKET client = accept(server, nullptr, nullptr);

        string data;
        char buffer[4096];
        int got;

        while (data.find("\r\n\r\n") == string::npos &&
               (got = recv(client, buffer, sizeof(buffer), 0)) > 0)
            data.append(buffer, got);

        size_t end = data.find("\r\n\r\n");
        if (end == string::npos) {
            closesocket(client);
            continue;
        }

        string headers = data.substr(0, end);
        string body = data.substr(end + 4);

        size_t lengthAt = headers.find("Content-Length:");
        if (lengthAt == string::npos) lengthAt = headers.find("content-length:");

        size_t length = lengthAt == string::npos ? 0 :
                        strtoul(headers.c_str() + lengthAt + 15, nullptr, 10);

        while (body.size() < length &&
               (got = recv(client, buffer, sizeof(buffer), 0)) > 0)
            body.append(buffer, got);

        string method, target;
        stringstream(headers) >> method >> target;
        string path = target.substr(0, target.find('?'));

        map<string, string> form = readForm(
            target.find('?') != string::npos ? target.substr(target.find('?') + 1) : body
        );

        if (path == "/api/ping")
            sendReply(client, 200, "application/json", answerPing());
        else if (path == "/api/airspace")
            sendReply(client, 200, "application/json", answerAirspace());
        else if (path == "/api/routes")
            sendReply(client, 200, "application/json", answerRoutes(form));
        else if (path == "/api/check")
            sendReply(client, 200, "application/json", answerCheck(form));
        else if (path == "/api/whatif")
            sendReply(client, 200, "application/json", answerWhatIf(form));
        else {
            string file = (path == "/") ? "/index.html" : path;
            string content;

            if (file.find("..") == string::npos && readFile(uiFolder + file, content))
                sendReply(client, 200, typeOf(file), content);
            else
                sendReply(client, 404, "text/plain", "Not found: " + file);
        }

        closesocket(client);
    }
}
