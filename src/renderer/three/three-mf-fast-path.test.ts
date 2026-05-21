import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extract3MFEmbeddedThumbnail } from './three-mf-fast-path';

const MANTICORE = resolve(__dirname, '../../../testfiles/manticore.3mf');

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe.runIf(existsSync(MANTICORE))('extract3MFEmbeddedThumbnail against real slicer-exported 3MF', () => {
  it('returns a real PNG buffer (slicer fast-path saves a full GL render)', () => {
    const buf = readFileSync(MANTICORE);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const png = extract3MFEmbeddedThumbnail(ab);
    expect(png).not.toBeNull();
    expect(png!.byteLength).toBeGreaterThan(1000);
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      expect(png![i]).toBe(PNG_MAGIC[i]);
    }
  });

  it('returns null for a buffer that is not a zip', () => {
    const notAZip = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    expect(extract3MFEmbeddedThumbnail(notAZip)).toBeNull();
  });
});
