#pragma once

/* main arduino api code */
#include <emscripten.h>
/** \brief Sleep for a brief period of time
 */
void delay(unsigned long ms) {
    emscripten_sleep(ms);
}

// binding code
#include <emscripten/bind.h>

void setup();
void loop();

// code to set up various variables
void glueSetupAndRun() {
    // call the setup() function of the user code
    setup();

    // call the loop() function of the user code
    while (1) {
        loop();
    }
}

EMSCRIPTEN_BINDINGS(romi_code) {
    emscripten::function("GlueCode_setupAndRun", &glueSetupAndRun);
}
