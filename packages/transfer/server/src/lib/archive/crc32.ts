/**
 * CRC-32 (IEEE 802.3), which every ZIP entry carries.
 *
 * Table-driven and incremental, because the writer streams an asset it never
 * holds whole: the checksum has to be accumulated chunk by chunk and written
 * afterwards, in the entry's data descriptor.
 */

/** Lazily built so importing this module costs nothing until a transfer runs. */
let table: Uint32Array | undefined;

function crcTable(): Uint32Array {
    if (table) return table;
    const built = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let value = i;
        for (let bit = 0; bit < 8; bit += 1) {
            // 0xedb88320 is the reversed IEEE 802.3 polynomial.
            value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
        }
        built[i] = value >>> 0;
    }
    table = built;
    return built;
}

/** Running CRC-32 over a byte stream. */
export class Crc32 {
    private state = 0xffffffff;

    update(chunk: Uint8Array): void {
        const lookup = crcTable();
        let state = this.state;
        for (let i = 0; i < chunk.length; i += 1) {
            state = lookup[(state ^ chunk[i]) & 0xff] ^ (state >>> 8);
        }
        this.state = state >>> 0;
    }

    /** The finished checksum, as an unsigned 32-bit value. */
    get value(): number {
        return (this.state ^ 0xffffffff) >>> 0;
    }
}

/** One-shot CRC-32 of a buffer. */
export function crc32(data: Uint8Array): number {
    const crc = new Crc32();
    crc.update(data);
    return crc.value;
}
