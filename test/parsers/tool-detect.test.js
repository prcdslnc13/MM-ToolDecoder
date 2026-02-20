const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { detectToolFormat, detectAspire9 } = require('../../src/server/parsers/tool-detect');

const ASPIRE9_PATH = path.join(__dirname, '../../ToolDatabases/aspire9.tool');
const JERE_PATH = path.join(__dirname, '../../ToolDatabases/Aspire_jere tools.tool');

describe('Tool Format Detection', () => {
  it('should identify aspire9.tool as Aspire 9 format', () => {
    const result = detectToolFormat(ASPIRE9_PATH);
    assert.ok(result, 'Should detect a format');
    assert.strictEqual(result.format, 'aspire9');
    assert.strictEqual(result.name, 'Aspire 9');
  });

  it('should identify "Aspire_jere tools.tool" as Aspire 9 format', () => {
    const result = detectToolFormat(JERE_PATH);
    assert.ok(result, 'Should detect a format');
    assert.strictEqual(result.format, 'aspire9');
    assert.strictEqual(result.name, 'Aspire 9');
  });

  it('should return valid parser info with parse function', () => {
    const result = detectToolFormat(ASPIRE9_PATH);
    assert.ok(result);
    assert.strictEqual(typeof result.parse, 'function');
    assert.strictEqual(typeof result.name, 'string');
  });

  it('should return null for a non-Aspire .tool file (wrong header)', () => {
    // Construct a buffer with wrong magic bytes
    const fakeHeader = Buffer.alloc(256, 0);
    fakeHeader.writeInt32LE(99, 0); // wrong file version
    const result = detectAspire9(fakeHeader);
    assert.strictEqual(result, null);
  });

  it('should return null for a buffer too small to contain signature', () => {
    const tinyBuffer = Buffer.alloc(16, 0);
    const result = detectAspire9(tinyBuffer);
    assert.strictEqual(result, null);
  });

  it('should return null for correct version but wrong marker string', () => {
    const fakeHeader = Buffer.alloc(256, 0);
    fakeHeader.writeInt32LE(3, 0);     // correct file_version
    fakeHeader[8] = 0xFF;             // correct record marker
    fakeHeader[9] = 0xFF;
    fakeHeader[10] = 0x01;            // correct record type
    fakeHeader[11] = 0x00;
    fakeHeader.writeInt16LE(17, 12);   // correct name length
    fakeHeader.write('notAToolMarker!!', 14, 'ascii'); // wrong marker string (16 chars + extra)
    const result = detectAspire9(fakeHeader);
    assert.strictEqual(result, null);
  });
});
