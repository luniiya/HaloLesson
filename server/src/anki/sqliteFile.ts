// Reads every row of a WITHOUT ROWID table straight from a SQLite file's
// b-tree pages. Anki's templates and fields tables use its own "unicase"
// collation, which bun:sqlite can't register, so SQLite refuses to query them.
// The tables are small, and this reader needs nothing but the file bytes.

import { closeSync, openSync, readSync } from "node:fs";

export type Value = number | string | Uint8Array | null;

function varint(bytes: Uint8Array, pos: number): [value: number, next: number] {
  let value = 0;
  for (let index = 0; index < 8; index++) {
    const byte = bytes[pos + index]!;
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return [value, pos + index + 1];
  }
  return [value * 256 + bytes[pos + 8]!, pos + 9];
}

function decodeRecord(payload: Uint8Array): Value[] {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const [headerSize, first] = varint(payload, 0);
  const types: number[] = [];
  for (let pos = first; pos < headerSize;) {
    const [type, next] = varint(payload, pos);
    types.push(type);
    pos = next;
  }
  const values: Value[] = [];
  let pos = headerSize;
  const int = (size: number) => {
    let value = 0;
    for (let index = 0; index < size; index++) value = value * 256 + payload[pos + index]!;
    // Two's complement for negatives.
    if (payload[pos]! & 0x80) value -= 2 ** (8 * size);
    pos += size;
    return value;
  };
  for (const type of types) {
    if (type === 0) values.push(null);
    else if (type >= 1 && type <= 4) values.push(int(type === 3 ? 3 : type === 4 ? 4 : type));
    else if (type === 5) values.push(int(6));
    else if (type === 6) values.push(int(8));
    else if (type === 7) {
      values.push(view.getFloat64(pos));
      pos += 8;
    } else if (type === 8) values.push(0);
    else if (type === 9) values.push(1);
    else if (type >= 12) {
      const length = Math.floor((type - (type % 2 ? 13 : 12)) / 2);
      const slice = payload.subarray(pos, pos + length);
      values.push(type % 2 ? new TextDecoder().decode(slice) : slice.slice());
      pos += length;
    } else throw new Error(`Unsupported record type ${type}`);
  }
  return values;
}

// Reads every row of the WITHOUT ROWID table rooted at rootPage. Pages are
// read on demand, so large collections are never loaded whole. The file must
// not have pending WAL content (the mirror runs in rollback-journal mode).
export function readWithoutRowidTable(path: string, rootPage: number): Value[][] {
  const fd = openSync(path, "r");
  try {
    const header = Buffer.alloc(100);
    readSync(fd, header, 0, 100, 0);
    if (header.toString("latin1", 0, 15) !== "SQLite format 3") throw new Error("Not a SQLite file");
    const rawSize = header.readUInt16BE(16);
    const pageSize = rawSize === 1 ? 65536 : rawSize;
    const usable = pageSize - header[20]!;
    const maxLocal = Math.floor(((usable - 12) * 64) / 255) - 23;
    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;
    const page = (number: number) => {
      const bytes = new Uint8Array(pageSize);
      if (readSync(fd, bytes, 0, pageSize, (number - 1) * pageSize) !== pageSize) throw new Error("Truncated SQLite file");
      return bytes;
    };
    const rows: Value[][] = [];
    const u32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0);
    const u16 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset + at, 2).getUint16(0);

    const payloadAt = (bytes: Uint8Array, pos: number): Uint8Array => {
      const [size, start] = varint(bytes, pos);
      if (size <= maxLocal) return bytes.subarray(start, start + size);
      const k = minLocal + ((size - minLocal) % (usable - 4));
      const local = k <= maxLocal ? k : minLocal;
      const out = new Uint8Array(size);
      out.set(bytes.subarray(start, start + local));
      let filled = local;
      let next = u32(bytes, start + local);
      while (filled < size && next) {
        const overflow = page(next);
        const take = Math.min(usable - 4, size - filled);
        out.set(overflow.subarray(4, 4 + take), filled);
        filled += take;
        next = u32(overflow, 0);
      }
      return out;
    };

    const visit = (number: number, depth: number) => {
      if (depth > 40) throw new Error("SQLite b-tree too deep");
      const bytes = page(number);
      const offset = number === 1 ? 100 : 0;
      const type = bytes[offset]!;
      const cells = u16(bytes, offset + 3);
      const interior = type === 2;
      if (type !== 2 && type !== 10) throw new Error(`Unexpected page type ${type}`);
      const pointers = offset + (interior ? 12 : 8);
      for (let index = 0; index < cells; index++) {
        const cell = u16(bytes, pointers + index * 2);
        if (interior) {
          visit(u32(bytes, cell), depth + 1);
          rows.push(decodeRecord(payloadAt(bytes, cell + 4)));
        } else rows.push(decodeRecord(payloadAt(bytes, cell)));
      }
      if (interior) visit(u32(bytes, offset + 8), depth + 1);
    };
    visit(rootPage, 0);
    return rows;
  } finally {
    closeSync(fd);
  }
}
