#!/bin/bash

# git clone https://github.com/emscripten-core/emsdk.git
# cd emsdk
# ./emsdk install latest
# ./emsdk activate latest
# source ./emsdk_env.sh

emcc code.cpp -Iutil/ -O3 -s ASYNCIFY --js-library library.js --bind

