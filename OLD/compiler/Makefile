# Makefile for arduino core library & helper

# Directory for arduino libraries
ARDUINO_DIR="ArduinoCore-avr/cores/arduino/"

# Directory for Polulu libraries
POLOLU_DIR="romi-32u4-arduino-library/"

# use the AVR version of tools
CC="avr-gcc"
CPP="avr-g++"
AR="avr-ar"
OBJ_COPY="avr-objcopy"

# compile flags for g++ and gcc

# may need to change these
F_CPU=16000000
MCU=atmega32u4

# compile flags
CFLAGS=-Os -Wall -ffunction-sections -fdata-sections -mmcu=$(MCU)
CFLAGS+=-DF_CPU=$(F_CPU)L -MMD -DUSB_VID=null -DUSB_PID=null -DARDUINO=106
CPP_FLAGS=$(CFLAGS) -fno-exceptions
LDFLAGS=-Wl,-gc-sections -Wl,-relax

# location of include files
INCLUDE_FILES="-I$(ARDUINO_DIR)hardware/arduino/cores/arduino" "-I$(ARDUINO_DIR)hardware/arduino/variants/standard"

# library sources
LIBRARY_DIR="$(ARDUINO_DIR)hardware/arduino/cores/arduino/"

build:

	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(MAIN_SKETCH) -o $(MAIN_SKETCH).o
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)avr-libc/malloc.c -o malloc.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)avr-libc/realloc.c -o realloc.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)WInterrupts.c -o WInterrupts.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)wiring.c -o wiring.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)wiring_analog.c -o wiring_analog.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)wiring_digital.c -o wiring_digital.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)wiring_pulse.c -o wiring_pulse.c.o 
	$(CC) $(CC_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)wiring_shift.c -o wiring_shift.c.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)CDC.cpp -o CDC.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)HardwareSerial.cpp -o HardwareSerial.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)HID.cpp -o HID.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)IPAddress.cpp -o IPAddress.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)main.cpp -o main.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)new.cpp -o new.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)Print.cpp -o Print.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)Stream.cpp -o Stream.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)Tone.cpp -o Tone.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)USBCore.cpp -o USBCore.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)WMath.cpp -o WMath.cpp.o 
	$(CPP) $(CPP_FLAGS) $(INCLUDE_FILES) $(LIBRARY_DIR)WString.cpp -o WString.cpp.o 
	rm core.a
	$(AR) rcs core.a malloc.c.o 
	$(AR) rcs core.a realloc.c.o 
	$(AR) rcs core.a WInterrupts.c.o 
	$(AR) rcs core.a wiring.c.o 
	$(AR) rcs core.a wiring_analog.c.o 
	$(AR) rcs core.a wiring_digital.c.o 
	$(AR) rcs core.a wiring_pulse.c.o 
	$(AR) rcs core.a wiring_shift.c.o 
	$(AR) rcs core.a CDC.cpp.o 
	$(AR) rcs core.a HardwareSerial.cpp.o 
	$(AR) rcs core.a HID.cpp.o 
	$(AR) rcs core.a IPAddress.cpp.o 
	$(AR) rcs core.a main.cpp.o 
	$(AR) rcs core.a new.cpp.o 
	$(AR) rcs core.a Print.cpp.o 
	$(AR) rcs core.a Stream.cpp.o 
	$(AR) rcs core.a Tone.cpp.o 
	$(AR) rcs core.a USBCore.cpp.o 
	$(AR) rcs core.a WMath.cpp.o 
	$(AR) rcs core.a WString.cpp.o 
	$(CC) -Os -Wl,--gc-sections -mmcu=$(MCU) -o $(MAIN_SKETCH).elf $(MAIN_SKETCH).o core.a -lm 
	$(OBJ_COPY) -O ihex -j .eeprom --set-section-flags=.eeprom=alloc,load --no-change-warnings --change-section-lma .eeprom=0 $(MAIN_SKETCH).elf $(MAIN_SKETCH).eep 
	$(OBJ_COPY) -O ihex -R .eeprom $(MAIN_SKETCH).elf $(MAIN_SKETCH).hex 
