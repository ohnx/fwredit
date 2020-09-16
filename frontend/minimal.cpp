#include <emscripten.h>
/** \brief Sleep for a brief period of time
 */
void delay(unsigned long ms) {
    emscripten_sleep(ms);
}

// binding code
#include <emscripten/bind.h>

// code to set up various variables
void glueSetupAndRun() {
    // call the loop() function of the user code
    while (1) {
        delay(1000);
    }
}

EMSCRIPTEN_BINDINGS(romi_code) {
    emscripten::function("GlueCode_setupAndRun", &glueSetupAndRun);
}
