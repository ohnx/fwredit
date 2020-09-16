#!/bin/bash

# git clone https://github.com/emscripten-core/emsdk.git
# cd emsdk
# ./emsdk install latest
# ./emsdk activate latest
# source ./emsdk_env.sh

emcc minimal.cpp -Iutil/ -O3 -s ASYNCIFY --bind -o minimal.js

