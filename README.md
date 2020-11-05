# fwredit

## what

An attempt to make a (mostly) in-browser robot simulator.

## why

The goal of this simulator is to, as closely as possible, replicate the experience of programming a physical Romi 32U4 following the "98-012: Fun with Robots" course outline, but virtually. For example, design choices have been made to limit I/O abilities to ones most similar to the ones available on the Romi.

## how it works

### compilation

Users write C/C++ code, which they submit to a [backend server](backend/app.js). This backend server compiles the code using [emscripten](https://emscripten.org) into Javascript. During the compilation process, various headers that emulate the Arduino environment are added to the include path; these headers can be found [here](backend/util). Also note the [backend/library.js](backend/library.js) file, which contains the actual "glue" between the simulator and the C++ code.

The backend server will store the compiled code in the [backend/compile_out](backend/compile_out) directory with some unique name and return that name to the user. Then, the simulator will load the code and run it.

### frontend simulator

The frontend simulator is based heavily on [an ammo.js code example](https://github.com/kripken/ammo.js/tree/master/examples/webgl_demo_vehicle), which uses a [three.js](https://threejs.org) Canvas to draw components of the simulated world. The benefits of this environment are that there is an actual physics engine running, so interactions between objects inside the environment feel more realistic. The downsides of this environment are that there is an actual physics engine running, so doing things like "make the robot move at X speed" are harder.

One key feature in three.js is the ability to raycast. This is how most sensors are implemented; e.g. a light sensor will do many raycasts at different angles to a yellow sphere to check if it intersects, and depending on how many rays intersect and at what angles they do so, the measured intensity will change. The resultant sensors are not quite reflective of reality, unfortunately.

### the glue

[Lines 599 and onwards of sim.js](https://github.com/ohnx/fwredit/blob/master/frontend/js/sim.js#L599) contain the bulk of the code that interfaces with the library.js file mentioned above and the simulator itself. Here, the serial console, button/LED I/O, and motors are set up.
