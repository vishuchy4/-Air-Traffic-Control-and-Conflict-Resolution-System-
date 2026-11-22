// server.cpp : the web server. It connects the C++ air traffic system to the UI.
//
// It does 2 jobs:
//   1. sends the UI files (index.html, style.css, *.js) to the browser
//   2. passes every "/api/..." question to api.cpp and sends back the JSON answer
//
// Run:  ./aeroguard_server            (port 8080, UI from ../frontend)
//       ./aeroguard_server 9000 web   (another port and UI folder)
// Single-file build ("make single" -> aeroguard.exe): the website is inside the program, so no folder is needed.

#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "airspace.h"
#include "api.h"

#ifdef SINGLE_FILE
#include "webfiles.h"      // the single-file build carries the website inside it
#endif

// Sockets are written a little differently on Windows and on Linux / Mac.
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

// =====================================================================
// 4. The web server
// =====================================================================

// Reads a UI file. Returns false if it does not exist.
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
    string uiFolder = argc > 2 ? argv[2] : "../Frontend";

    setupAirspace();                         // distances, linked lists of roads, regions (airspace.cpp)
    // random +0 / +500 ft altitudes; set AEROGUARD_SEED for the same numbers every run (handy for demos)
    const char* seed = getenv("AEROGUARD_SEED");
    srand(seed ? (unsigned)atoi(seed) : (unsigned)time(nullptr));

#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif

    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, (const char*)&yes, sizeof(yes));

    sockaddr_in address = {};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);   // only this computer can connect
    address.sin_port = htons((unsigned short)port);

    if (bind(server, (sockaddr*)&address, sizeof(address)) < 0 || listen(server, 10) < 0) {
        cout << "Could not use port " << port << ". Try another one, e.g. ./aeroguard_server 9000" << endl;
        return 1;
    }
    cout << "UI files from: " << uiFolder << endl;
    cout << "AeroGuard server running. Open http://localhost:" << port << "  (Ctrl+C to stop)" << endl;   // endl shows it at once (also in MSYS2)
#if defined(_WIN32) && defined(SINGLE_FILE)
    string open = "start http://localhost:" + to_string(port);      // the single .exe opens the browser by itself
    system(open.c_str());
#endif

    while (true) {
        SOCKET client = accept(server, nullptr, nullptr);

        // 1. read the request: first the headers, then the body (its size is in Content-Length)
        string data;
        char buffer[4096];
        int got;
        while (data.find("\r\n\r\n") == string::npos && (got = recv(client, buffer, sizeof(buffer), 0)) > 0)
            data.append(buffer, got);

        size_t end = data.find("\r\n\r\n");
        if (end == string::npos) { closesocket(client); continue; }

        string headers = data.substr(0, end);
        string body = data.substr(end + 4);

        size_t lengthAt = headers.find("Content-Length:");
        if (lengthAt == string::npos) lengthAt = headers.find("content-length:");
        size_t length = lengthAt == string::npos ? 0 : strtoul(headers.c_str() + lengthAt + 15, nullptr, 10);
        while (body.size() < length && (got = recv(client, buffer, sizeof(buffer), 0)) > 0)
            body.append(buffer, got);

        // 2. the first line, e.g. "POST /api/routes HTTP/1.1"
        string method, target;
        stringstream(headers) >> method >> target;
        string path = target.substr(0, target.find('?'));

        // 3. answer: an API question (api.cpp), or a UI file
        string json;
        if (answerApi(path, target.find('?') != string::npos ? target.substr(target.find('?') + 1) : body, json)) {
            sendReply(client, 200, "application/json", json);
        } else {
            string file = (path == "/") ? "/index.html" : path;
            string content;
            bool found = file.find("..") == string::npos && readFile(uiFolder + file, content);   // the website folder
#ifdef SINGLE_FILE
            if (!found) found = embeddedFile(file, content);                                    // or the copy inside the program
#endif
            if (found)
                sendReply(client, 200, typeOf(file), content);                // a UI file
            else
                sendReply(client, 404, "text/plain", "Not found: " + file);
        }

        closesocket(client);
    }
}
