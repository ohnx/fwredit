HOST_SRC :=
HOST_SRC += testvm.c
HOST_SRC += ../avr_op_decoder.c
HOST_SRC += ../avrvm.c

HOST_TGT := testvm

all: $(HOST_TGT).js

$(HOST_TGT).js: $(HOST_SRC)
	$(CC) -std=c99 -O2 -DDEBUG_AVRVM=1 -I. -I../ $^ -o $@ --embed-file tests/

clean:
	rm -f $(HOST_TGT).exe
