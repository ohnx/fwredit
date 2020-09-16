#include <stdio.h>
#include <stdint.h>
#include "avrvm.h"

/* http://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7766-8-bit-AVR-ATmega16U4-32U4_Datasheet.pdf */
/* https://www.microchip.com/wwwproducts/en/ATmega32U4 */

/* 32KB flash */
static uint8_t flash[32768];

/* 2560B of SRAM */
static uint8_t sram[2560];

/* 64 bytes of I/O */
static uint8_t io[64];

uint16_t flash_reader(uint16_t word_idx) {
    // wrap at 16k words to simulate behavior of atmega88 with 32k flash
    word_idx &= 0x3FFF;

    /* changing from word idx to byte idx, so multiply by 2 */
    word_idx = word_idx << 1;

    printf("reading index %x (n = %x)\n", word_idx, ((flash[word_idx]) << 8) + flash[word_idx + 1]);

    uint16_t opcode;
    /* TODO: big or little endian... */
    opcode = ((flash[word_idx]) << 8) + flash[word_idx + 1];

    return opcode;
}

uint8_t sram_reader(uint16_t addr) {
    return sram[addr];
}

void sram_writer(uint16_t addr, uint8_t byte) {
    sram[addr] = byte;
}

uint8_t io_reader(uint8_t addr) {
    return io[addr];
}

void io_writer(uint8_t addr, uint8_t byte) {
    io[addr] = byte;
}

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <bin to run>\n", argv[0]);
        return -1;
    }

    FILE *f = fopen(argv[1], "rb");
    if (!f) {
        fprintf(stderr, "File not found\n");
        return -1;
    }
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);  /* same as rewind(f); */

    if (fsize > 32768) {
        fprintf(stderr, "File exceeds available flash memory");
        fclose(f);
        return -1;
    }

    fread(flash, 1, fsize, f);
    fclose(f);

    static avrvm_ctx_t vm;
    avrvm_iface_t iface =
    {
      .flash_r = flash_reader,
      .sram_r = sram_reader,
      .sram_w = sram_writer,
      .io_r = io_reader,
      .io_w = io_writer,
    };
    avrvm_init(&vm, &iface, sizeof(sram));

    while (1) {
        int rc = avrvm_exec(&vm);
        if (rc == AVRVM_RC_OK)
            continue;

        if (rc == AVRVM_RC_UNDEF_INSTR) {
            printf("bad instruction");
            return -1;
        } else if (rc == AVRVM_RC_BREAK) {
            printf("end of script");
            return 0;
        } else if (rc == AVRVM_RC_SLEEP) {
            printf("sleep request");
        }
    }

    return 0;
}
