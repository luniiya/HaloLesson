// Minimal protobuf reader for the config blobs in Anki's schema 18 tables
// (decks.kind/common, deck_config.config, notetypes.config, templates.config).
// Only reads; haloLesson never writes these tables.

export type Field = { wire: 0; value: number } | { wire: 1; value: DataView } | { wire: 2; value: Uint8Array } | { wire: 5; value: DataView };

export class Message {
  private fields = new Map<number, Field[]>();

  constructor(bytes: Uint8Array | null | undefined) {
    if (!bytes) return;
    let pos = 0;
    const varint = () => {
      let result = 0;
      let shift = 1;
      for (;;) {
        if (pos >= bytes.length) throw new Error("Truncated protobuf");
        const byte = bytes[pos++]!;
        result += (byte & 0x7f) * shift;
        if (!(byte & 0x80)) return result;
        shift *= 128;
      }
    };
    while (pos < bytes.length) {
      const tag = varint();
      const number = Math.floor(tag / 8);
      const wire = tag % 8;
      let field: Field;
      if (wire === 0) field = { wire, value: varint() };
      else if (wire === 1) {
        field = { wire, value: new DataView(bytes.buffer, bytes.byteOffset + pos, 8) };
        pos += 8;
      } else if (wire === 2) {
        const length = varint();
        field = { wire, value: bytes.subarray(pos, pos + length) };
        pos += length;
      } else if (wire === 5) {
        field = { wire, value: new DataView(bytes.buffer, bytes.byteOffset + pos, 4) };
        pos += 4;
      } else throw new Error(`Unsupported protobuf wire type ${wire}`);
      const list = this.fields.get(number);
      if (list) list.push(field);
      else this.fields.set(number, [field]);
    }
  }

  has(number: number) {
    return this.fields.has(number);
  }

  private last(number: number) {
    return this.fields.get(number)?.at(-1);
  }

  uint(number: number, fallback = 0): number {
    const field = this.last(number);
    return field?.wire === 0 ? field.value : fallback;
  }

  int(number: number, fallback = 0): number {
    const value = this.uint(number, fallback);
    // int32 negatives are sign-extended to 64 bits.
    return value >= 2 ** 63 ? value - 2 ** 64 : value;
  }

  bool(number: number, fallback = false): boolean {
    const field = this.last(number);
    return field?.wire === 0 ? field.value !== 0 : fallback;
  }

  float(number: number, fallback = 0): number {
    const field = this.last(number);
    if (field?.wire === 5) return field.value.getFloat32(0, true);
    if (field?.wire === 1) return field.value.getFloat64(0, true);
    return fallback;
  }

  string(number: number, fallback = ""): string {
    const field = this.last(number);
    return field?.wire === 2 ? new TextDecoder().decode(field.value) : fallback;
  }

  message(number: number): Message | null {
    const field = this.last(number);
    return field?.wire === 2 ? new Message(field.value) : null;
  }

  // Repeated float, packed (wire 2) or not (wire 5).
  floats(number: number): number[] {
    const out: number[] = [];
    for (const field of this.fields.get(number) ?? []) {
      if (field.wire === 5) out.push(field.value.getFloat32(0, true));
      else if (field.wire === 2) {
        const view = new DataView(field.value.buffer, field.value.byteOffset, field.value.byteLength);
        for (let offset = 0; offset + 4 <= field.value.byteLength; offset += 4) out.push(view.getFloat32(offset, true));
      }
    }
    return out;
  }
}
