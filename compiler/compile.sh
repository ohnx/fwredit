#!/bin/bash

avr-g++ code.c -I romi-32u4-arduino-library/ -D__AVR_ATmega32U4__ -mmcu=atmega32u4

