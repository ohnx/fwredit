MCU=atmega32u4
CFLAGS=-g -Wall -mcall-prologues -mmcu=$(MCU) -Os -DF_CPU=16000000 -ffreestanding
LDFLAGS=-Wl,-gc-sections -Wl,-relax
CC=avr-gcc
TARGET=main
OBJECT_FILES=main.o

all: $(TARGET).bin

clean:
	rm -f *.o *.hex *.obj *.hex *.bin

%.hex: %.obj
	avr-objcopy -R .eeprom -O ihex $< $@

%.bin: %.obj
	avr-objcopy -R .eeprom -O binary $< $@

%.obj: $(OBJECT_FILES)
	$(CC) $(CFLAGS) $(OBJECT_FILES) $(LDFLAGS) -o $@

.PRECIOUS: %.o %.obj
