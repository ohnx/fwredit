#include <emscripten.h>
#include <emscripten/bind.h>

void demonstrateIssue() {
    while (1) {
        emscripten_sleep(1000);
    }
}

EMSCRIPTEN_BINDINGS(asyncifysleepissue) {
    emscripten::function("demonstrateIssue", &demonstrateIssue);
}

