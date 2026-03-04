# aspire9_bugfix — Investigation Findings & Fix Plan

Branch: `aspire9_bugfix`
Last investigated: 2026-03-04

---

## How we got here

`scripts/trace-tool.js` was run against all four Aspire 9 / Aspire 12 sample files inside
the Docker container. `scripts/probe-binary.js` read the raw bytes of the metric `.tool`
file and queried the Aspire 12 SQLite database to confirm field values. The converter
(`to-millmage.js`) and the route layer (`upload.js` / `convert.js`) were confirmed to be
**correct** — bugs are entirely inside the parsers.

---

## Bug 1 — Aspire 9 metric files: zero tools parsed

### Files affected
- `src/server/parsers/aspire9.js` — `tryParseToolHeader()`
- `test/parsers/aspire9.test.js` — no metric coverage at all

### Root cause (confirmed from binary probe)

The Aspire 9 binary format has **two variants**:

| Field (offset from header start) | Imperial file | Metric file |
|---|---|---|
| `+08` float32 — `radius` | half-diameter in **inches** (e.g. 0.25) | half-diameter in **mm** (e.g. 1.0, 1.5, 3.0 …) |
| `+12` float32 — `tipGeometry` | half-angle denominator | same |
| `+20` byte — `zeroByte` | `0x00` | `0x01` |
| `+21` double64 — `diameter` | inches | **mm** |
| `+29` double64 — `stepdown` | inches | **mm** |
| `+37` double64 — `stepover` | inches | **mm** |
| `+45` double64 — `feedRate` | in/min | **mm/min** |
| `+53` double64 — `plungeRate` | in/min | **mm/min** |

`tryParseToolHeader()` contains this hard rejection:
```js
const zeroByte = buf[pos + 20];
if (zeroByte !== 0) return null;   // ← kills every metric record
```

Additionally, the metric `radius` values (1.0 – 16.0 mm) exceed the current guard:
```js
if (!isFinite(radius) || radius <= 0 || radius >= 10.0) return null;  // ← 12 mm, 16 mm fail
```

And `parseToolRecord()` hard-codes `metricTool: false` and always divides rates by 60 with
a comment `// in/min → in/sec`, which is wrong for metric tools (rates are mm/min → mm/sec).

### Evidence from probe output
```
@0x0026d sub=1 zero=1 radius=1.0000  diam=2.0000  feed=60.0000  plunge=20.0000  nameLen=16
@0x0054a sub=1 zero=1 radius=1.5000  diam=3.0000  feed=60.0000  plunge=20.0000  nameLen=16
@0x085d  sub=1 zero=1 radius=3.0000  diam=6.0000  feed=60.0000  plunge=20.0000  nameLen=16
@0x00b3a sub=1 zero=1 radius=6.0000  diam=12.0000 feed=40.0000  plunge=15.0000  nameLen=17
@0x01010 sub=0 zero=1 radius=1.5000  diam=3.0000  feed=20.0000  plunge=7.0000   nameLen=17
```
Name strings visible at corresponding offsets: `End Mill (2 mm)`, `End Mill (3 mm)`, etc.
Root group header at `0x006c` contains ASCII `Metric Tools`.

### Fix — `src/server/parsers/aspire9.js`

**1. `tryParseToolHeader` — detect metric from `zeroByte` and widen the radius guard:**
```js
// Before
const zeroByte = buf[pos + 20];
if (zeroByte !== 0) return null;

const radius = buf.readFloatLE(pos + 8);
if (!isFinite(radius) || radius <= 0 || radius >= 10.0) return null;
```
```js
// After
const zeroByte = buf[pos + 20];
if (zeroByte !== 0 && zeroByte !== 1) return null;   // 0=imperial, 1=metric
const isMetric = zeroByte === 1;

const radius = buf.readFloatLE(pos + 8);
const radiusMax = isMetric ? 500.0 : 10.0;           // mm vs inches
if (!isFinite(radius) || radius <= 0 || radius >= radiusMax) return null;
```
Return `isMetric` from the header object so `parseToolRecord` can use it.

**2. `parseToolRecord` — use `isMetric` for unit flag and rate conversion:**
```js
// Before
feedRate: feedRate / 60,     // in/min → in/sec
plungeRate: plungeRate / 60, // in/min → in/sec
metricTool: false,           // always imperial
```
```js
// After
feedRate: feedRate / 60,     // both: divide by 60 (in/min→in/sec OR mm/min→mm/sec)
plungeRate: plungeRate / 60,
metricTool: header.isMetric,
```
(The `/60` logic stays identical — it is correct for both. Only the flag changes.)

**3. `parseToolRecord` — widen diameter and stepdown guards for metric values:**
```js
// Before
if (!isFinite(diameter) || diameter <= 0 || diameter >= 100) return null;
```
```js
// After
const dimMax = header.isMetric ? 2000 : 100;
if (!isFinite(diameter) || diameter <= 0 || diameter >= dimMax) return null;
```

**4. `tryParseToolHeader` — return `isMetric` in the header object:**
```js
return { version, subtype, radius, tipGeometry, isMetric };
```

**5. `parseToolRecord` — `tipRadius` should be in native units (already correct — `header.radius` is the float from the file).**  
No change needed; the converter handles mm vs inches via `metricTool`.

---

## Bug 2 — Aspire 12: `rate_units` field not read from DB (CONFIRMED WORKING — no fix needed)

### What we checked

`SELECT DISTINCT rate_units FROM tool_cutting_data` returns `[{rate_units:4},{rate_units:0}]`.
- `rate_units = 4` → in/min (sample rows: `feed_rate: 60` → 60 in/min = 1 in/sec ✓)
- `rate_units = 0` → mm/sec (metric tools)

The converter branch in `aspire12.js`:
```js
} else if (row.rate_units === 4) {
  const feedInPerSec = (row.feed_rate || 0) / 60;
  feedRate = isMetric ? feedInPerSec * MM_PER_INCH : feedInPerSec;
```
…correctly converts 60 in/min → 1 in/sec for imperial tools.  
The trace confirmed `End Mill (1/16")`: `plungeRate=1 in/sec → PlungeRate=25.4 mm/sec`. ✓

**Aspire 12 is correct. No changes required.**

---

## Tests to add — `test/parsers/aspire9.test.js`

The metric `.tool` files were added to `ToolDatabases/` during this branch
(`Aspire9DefaultImperial.tool`, `Aspire9DefaultMetric.tool`, `Aspire9DefaultImperial.tool_db`,
`Aspire9DefaultMetric.tool_db`) but have zero test coverage.

### New test cases to add (append to the existing `describe` block)

```
describe('Aspire9 Metric file', () => {
  let metricTools;

  it('should parse Aspire9DefaultMetric.tool without errors', ...)
  it('should find the expected number of metric tools (≥ 6)', ...)
  it('should mark all metric tools as metricTool = true', ...)
  it('should have mm-scale diameters (2–50 mm range)', ...)
  it('should have mm/sec feed rates (not in/sec)', ...)
    // End Mill (2mm): feedRate in file = 60 mm/min → 60/60 = 1.0 mm/sec
    // End Mill (3mm): feedRate in file = 60 mm/min → 1.0 mm/sec
  it('should have correct category ("Metric Tools")', ...)
  it('should correctly parse .tool_db extension (same result as .tool)', ...)
    // Aspire9DefaultMetric.tool_db is identical content; parser must accept it
})
```

### Existing test to update

`'should mark all tools as imperial (metricTool = false)'` currently iterates over ALL
parsed tools from `aspire9.tool`. That file is all-imperial so the assertion still holds.
**No change needed** — but add a comment noting it is intentionally scoped to that file.

---

## Files to change — summary

| File | Change |
|---|---|
| `src/server/parsers/aspire9.js` | `tryParseToolHeader`: accept `zeroByte=1`, widen radius guard, return `isMetric`; `parseToolRecord`: use `header.isMetric` for `metricTool` flag and diameter guard |
| `test/parsers/aspire9.test.js` | Add `describe('Aspire9 Metric file', ...)` block (6–7 new `it()` cases) |

---

## Files confirmed correct — do not change

| File | Reason |
|---|---|
| `src/server/parsers/aspire12.js` | `rate_units` handled correctly; metric/imperial both verified |
| `src/server/converters/to-millmage.js` | `toMm()` + `metricTool` flag correctly gates conversion |
| `src/server/routes/upload.js` | Full `tools` array stored; all fields survive to convert step |
| `src/server/routes/convert.js` | Passes `upload.tools` straight to `convertToMillMage` |
| `src/public/js/preview.js` | Renders whatever the convert route returns; no field filtering |

---

## Implementation order

1. Fix `src/server/parsers/aspire9.js` (two functions, ~6 line changes)
2. Run existing tests to confirm no regressions: `npm test`
3. Add metric test cases to `test/parsers/aspire9.test.js`
4. Run tests again — all new metric tests should now pass
5. Clean up `scripts/` probe files (or leave for CI reference — author's call)
