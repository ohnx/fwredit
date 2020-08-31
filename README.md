# fwredit

An attempt to make a (mostly) in-browser robot simulator.

Created for virtual teaching of 98-012 Fun with Robots at Carnegie Mellon University.

Real robots break, and unfortunately, in a remote environment, it can be difficult to debug hardware issues.

## TODO: proper description

## Directory structure

* `frontend/` - frontend stuff
* `browsertools/` - misc code that runs in the browser for the simulator world
* `compiler/` - custom forks of various compiler tools & toolchains https://github.com/coolya/mbeddr.arduino, plus Romi-specific library code
* `emscripten/` - Emscripten; used to compile the browser tools into javascript

## Implementation plan

* Get a physics world working where we can have sensor input in some way.
    * Use JS API for this
    * Can start simple. If we can at least maybe do a light sensor or something
      like that, then we will be able to 
* Figure out how to plug-in to emscripten in order to make certain C calls call
  JavaScript parts instead
* Design some sort of 

### Old implementation plan

* Start simple. Make sure that the code can compile to a flashable binary. Make a docker? image with all the tools necessary to do so.

* Look more into AVR VM. Is it what we want?
  * 


* Look into physics engines
  * http://chandlerprall.github.io/Physijs/ looks HIGHLY promising

other less good options:

  * https://github.com/jeromeetienne/microphysics.js
  * http://learningthreejs.com/blog/2011/10/17/lets-make-a-3d-game-microphysics-js/
  * https://github.com/kripken/ammo.js


Once a physics engine is picked, we need to write code to create a completely
virtual world for each test environment, plus all of the sensors & outputs present
in the romi.

After that's done, we can connect it into the AVR VM with https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#embind
or similar, and write some more glue code, etc.

Then, with some tweaks to the frontend, we should be done... hopefully...


TODO: does https://github.com/osrf/gazebo solve all our needs???


