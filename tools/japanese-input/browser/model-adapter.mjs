import { createHash } from 'node:crypto';

// Adapt tokenizer metadata, never weights: alias the pre-tokenizer and use
// BOS=2/EOS=3, verified against the pinned native vocabulary. The original
// GGUF declares 1/2, which stock llama.cpp obeys but the native fork overrides.
export function adaptModel(buffer, expectedHash) {
  if (createHash('sha256').update(buffer).digest('hex') !== expectedHash)
    throw Error('Model checksum mismatch');
  buffer = Buffer.from(buffer);
  let cursor = 24;
  const u32 = () => {
    const v = buffer.readUInt32LE(cursor);
    cursor += 4;
    return v;
  };
  const u64 = () => {
    const v = Number(buffer.readBigUInt64LE(cursor));
    cursor += 8;
    return v;
  };
  const string = () => {
    const size = u64();
    const v = buffer.toString('utf8', cursor, cursor + size);
    cursor += size;
    return v;
  };
  function skip(type) {
    if (type === 8) {
      string();
      return;
    }
    if (type === 9) {
      const subtype = u32();
      const count = u64();
      for (let i = 0; i < count; i++) skip(subtype);
      return;
    }
    const size = [1, 1, 2, 2, 4, 4, 4, 1, 0, 0, 8, 8, 8][type];
    if (!size) throw Error('Unknown GGUF metadata type');
    cursor += size;
  }
  let replacement;
  const count = Number(buffer.readBigUInt64LE(16));
  for (let i = 0; i < count; i++) {
    const key = string();
    const type = u32();
    const start = cursor;
    if (['tokenizer.ggml.eos_token_id', 'tokenizer.ggml.bos_token_id'].includes(key)) {
      if (type !== 4) throw Error('Unexpected token ID type');
      buffer.writeUInt32LE(key.includes('eos') ? 3 : 2, cursor);
      skip(type);
    } else if (key === 'tokenizer.ggml.pre') {
      if (type !== 8 || string() !== 'gpt2-small-japanese-char')
        throw Error('Unexpected tokenizer');
      replacement = { start, end: cursor };
    } else skip(type);
  }
  for (let i = 0; i < Number(buffer.readBigUInt64LE(8)); i++) {
    string();
    const dimensions = u32();
    cursor += dimensions * 8 + 12;
  }
  if (!replacement) throw Error('Tokenizer metadata missing');
  const dataStart = Math.ceil(cursor / 32) * 32;
  const value = Buffer.alloc(13);
  value.writeBigUInt64LE(5n);
  value.write('gpt-2', 8);
  const header = Buffer.concat([
    buffer.subarray(0, replacement.start),
    value,
    buffer.subarray(replacement.end, cursor),
  ]);
  const output = Buffer.concat([
    header,
    Buffer.alloc(dataStart - header.length),
    buffer.subarray(dataStart),
  ]);
  if (!output.subarray(dataStart).equals(buffer.subarray(dataStart)))
    throw Error('Tensor data changed');
  return output;
}
