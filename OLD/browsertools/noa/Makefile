CFLAGS+=-Wall -Werror -g -O0 -I../avrvm/ -DDEBUG_AVRVM -std=c99

run: ../avrvm/avrvm.c ../avrvm/avr_op_decoder.c run.c
	$(CC) $(CFLAGS) $^ -o $@
