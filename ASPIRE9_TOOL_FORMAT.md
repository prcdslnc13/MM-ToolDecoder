# Aspire 9 .tool Binary File Format Specification

**Reverse-engineered from:**
- `aspire9.tool` (22,422 bytes, default Aspire 9 imperial tool database)
- `Aspire_jere tools.tool` (27,345 bytes, user-customized imperial database)
- `Aspire9DefaultMetric.tool` (18,147 bytes, default Aspire 9 metric tool database)
- `Aspire9DefaultImperial.tool` (default Aspire 9 imperial tool database, alternate filename)

All files use **the same format version** (file_version=3, record_version=2). Imperial and metric variants differ only in the `zero_byte` field and the unit system used for all numeric measurements.

---

## 1. File Header

| Offset | Type      | Value       | Description                              |
|--------|-----------|-------------|------------------------------------------|
| 0x0000 | int32 LE  | 3           | File format version                      |
| 0x0004 | int32 LE  | varies      | Total record count (30 in aspire9, 38 in jere) |
| 0x0008 | bytes     | `FF FF`     | Record start marker                      |
| 0x000A | bytes     | `01 00`     | Record type indicator                    |
| 0x000C | int16 LE  | 17          | Marker name length                       |
| 0x000E | ASCII     | `mcToolGroupMarker` | Root group marker string          |

The `file_param` at offset 0x0004 equals the total count of all records in the file:
tool entries + group opens + group closes + parameter records + 1 (top-level group).

---

## 2. Record Framing

All records use one of these prefixes:

### Type Marker Records (first tool of each type, group markers)
```
FF FF 01 00 [int16: name_length] [ASCII: marker_name]
```
Examples: `mcEndMillTool`, `mcBallNoseTool`, `mcVBitTool`, `mcFormTool`, `mcEngravingTool`, `mcDiamondDragTool`, `mcDrillTool`, `mcRadiusedEndMillTool`, `mcToolGroupMarker`, `utParameter`

### Sub-group Records (group open/close)
```
01 80 02 00 00 00 ...group_data...
```
- Followed by int32 param: **11** = group OPEN, **12** = group CLOSE (`ToolGroup - End`)

### Tool Continuation Records (2nd+ tool within a type)
```
[16 bytes: GUID] [00 00] [int32: 1] [XX 80] 02 00 00 00 ...tool_header...
```
- `XX` is a file-specific record tag byte (NOT the tool type)
- The GUID uniquely identifies each tool entry
- After `XX 80`, the standard 21-byte tool header follows

### Parameter Records
```
[03|04] 80 02 00 00 00 ...parameter_data...
```
- `03 80` and `04 80` introduce toolpath parameter blocks (e.g., `ToolIsLocked`)

---

## 3. Tool Record Structure (CORE - Critical for Parsing)

Each tool record has a fixed layout. The **tool header** is 21 bytes, followed by 5 float64 fields, 4 int32 fields, and a name string.

### Tool Header (21 bytes)

| Offset | Type     | Field          | Description                                      |
|--------|----------|----------------|--------------------------------------------------|
| +0     | int32 LE | version        | Always `2`                                       |
| +4     | int32 LE | tool_subtype   | Tool shape identifier (see table below)          |
| +8     | float32 LE | radius       | Tool radius = diameter / 2                       |
| +12    | float32 LE | tip_geometry | Calculated geometric depth (see below)           |
| +16    | int32 LE | constant_6     | Always `6` (format indicator)                    |
| +20    | byte     | zero_byte      | `0` = imperial units, `1` = metric units         |

### Tool Subtype Values

| Value | Type                  | Marker Name             | tip_geometry meaning                             |
|-------|-----------------------|-------------------------|--------------------------------------------------|
| 0     | Ball Nose             | `mcBallNoseTool`        | = radius (full hemisphere)                       |
| 1     | End Mill (flat)       | `mcEndMillTool`         | = 0.0 (flat bottom)                              |
| 2     | Radiused End Mill     | `mcRadiusedEndMillTool` | = corner/tip radius                              |
| 3     | V-Bit                 | `mcVBitTool`            | = radius / tan(half_angle)                       |
| 4     | Engraving (V + flat tip) | `mcEngravingTool`    | = (radius - tip_radius) / tan(half_angle)        |
| 6     | Drill                 | `mcDrillTool`           | = radius / tan(half_angle) [typ. 118-deg point]  |
| 8     | Form Tool             | `mcFormTool`            | = cutting depth                                  |
| 9     | Diamond Drag          | `mcDiamondDragTool`     | = radius (= radius / tan(45) for 90-deg)         |

**Note:** Subtypes 11 and 12 are group open/close markers, not tool types. They share the same 21-byte header layout but carry no tool data.

### Cutting Parameters (5 x float64 = 40 bytes, immediately after header)

| Offset from header start | Type       | Field        | Units (imperial) | Units (metric)  |
|--------------------------|------------|--------------|------------------|-----------------|
| +21                      | float64 LE | diameter     | inches           | mm              |
| +29                      | float64 LE | stepdown     | inches (pass depth) | mm           |
| +37                      | float64 LE | stepover     | inches           | mm              |
| +45                      | float64 LE | feed_rate    | inches/minute    | mm/minute       |
| +53                      | float64 LE | plunge_rate  | inches/minute    | mm/minute       |

The unit system for all five fields is determined solely by the `zero_byte` in the tool header.

### Machine Parameters (4 x int32 = 16 bytes)

| Offset from header start | Type      | Field          | Units/Notes      |
|--------------------------|-----------|----------------|------------------|
| +61                      | int32 LE  | num_flutes     | count            |
| +65                      | int32 LE  | spindle_speed  | RPM              |
| +69                      | int32 LE  | tool_number    | tool holder slot |
| +73                      | int32 LE  | name_length    | bytes incl. null |

### Tool Name

| Offset from header start | Type       | Field    | Notes                |
|--------------------------|------------|----------|----------------------|
| +77                      | ASCII+null | name     | Length from name_length field |

**Total core record size:** 21 (header) + 40 (f64s) + 16 (int32s) + name_length = **77 + name_length** bytes.

### Relative to Tool Name Position (N) -- Quick Reference

For quick parsing, if you know the tool name offset `N`:

| Offset | Type       | Field          |
|--------|------------|----------------|
| N - 77 | ...        | header start   |
| N - 56 | float64 LE | **diameter**   |
| N - 48 | float64 LE | **stepdown**   |
| N - 40 | float64 LE | **stepover**   |
| N - 32 | float64 LE | **feed_rate**  |
| N - 24 | float64 LE | **plunge_rate**|
| N - 16 | int32 LE   | **num_flutes** |
| N - 12 | int32 LE   | **spindle_speed** |
| N - 8  | int32 LE   | **tool_number**|
| N - 4  | int32 LE   | **name_length**|
| N      | ASCII      | **name**       |

---

## 4. Post-Name Data

After each tool name (at offset N + name_length):

| Offset          | Type      | Field             | Notes                              |
|-----------------|-----------|-------------------|------------------------------------|
| N + name_length | float64 LE| stepover_display  | Alternative stepover/display value |
| +8              | int32 LE  | unknown1          | Always 1                           |
| +12             | int32 LE  | unknown2          | Always 1                           |
| +16             | int32 LE  | is_locked         | 0 = unlocked, 1 = locked           |

If `is_locked == 1`, a `04 80 02 00 00 00` parameter block follows with a UTF-16LE `ToolIsLocked` string.

Then:
- `FF FE FF 00` (empty UTF-16 string marker)
- `FF FE FF [byte: char_count]` followed by UTF-16LE breadcrumb path (e.g., "Imperial Tools | End Mills")
- `float64 = 100.0` (speed override percentage)
- Extended toolpath settings block (~500+ bytes of toolpath configuration data)

---

## 5. Deriving Included Angle

For V-shaped tools (V-Bit, Engraving, Drill, Diamond Drag), the included angle is calculated from the header:

### V-Bit (subtype 3) and Drill (subtype 6):
```
half_angle = atan(radius / tip_geometry)
included_angle = 2 * half_angle
```

**Verified examples:**
- V-Bit 60-deg: radius=0.125, tip_geom=0.216506 -> `2 * atan(0.125/0.2165) = 60.0 deg`
- V-Bit 90-deg: radius=0.250, tip_geom=0.250000 -> `2 * atan(0.250/0.250) = 90.0 deg`
- Drill 118-deg: radius=0.125, tip_geom=0.075108 -> `2 * atan(0.125/0.0751) = 118.0 deg`

### Engraving (subtype 4):
The same formula gives an **approximate** angle (ignoring the flat tip):
```
approx_angle = 2 * atan(radius / tip_geometry)
```
This overestimates the angle because `tip_geometry = (radius - tip_radius) / tan(half_angle)`.

To get the **exact** angle, you need the tip_radius:
```
exact_half_angle = atan((radius - tip_radius) / tip_geometry)
```
The tip_radius is not stored in the core record fields; it may be in the extended settings block or derivable from the tool name.

### Diamond Drag (subtype 9):
```
angle = 2 * atan(radius / tip_geometry)
```
(Same as V-Bit formula; for 90-deg drag, tip_geometry = radius.)

---

## 6. Group/Sub-Group Structure

### Group Header (after marker/01 80 prefix)

| Offset | Type      | Value    | Description             |
|--------|-----------|----------|-------------------------|
| +0     | int32 LE  | 2        | Version                 |
| +4     | int32 LE  | 11 or 12 | 11=group open, 12=group close |
| +8     | int32 LE  | 0        | Reserved                |
| +12    | int32 LE  | 0        | Reserved                |
| +16    | int32 LE  | 6        | Constant                |
| +20    | bytes     | zeros    | 53 bytes reserved       |
| +73    | int32 LE  | n        | Group name length       |
| +77    | ASCII     | name     | Group name string       |

After the name: optional UTF-16LE description, f64=100.0 override, and reserved bytes.

### Hierarchy Example (aspire9.tool)
```
[file_version=3, total_records=30]
mcToolGroupMarker "Imperial Tools"
  [01 80 param=11] "End Mills"
    [ff ff 01 00] mcEndMillTool
      Tool: "End Mill (0.125 inch)"
      [GUID + XX 80] Tool: "End Mill (0.25 inch)"
      [GUID + XX 80] Tool: "End Mill (0.5 inch)"
  [01 80 param=12] "ToolGroup - End"
  [01 80 param=11] "Ball Nose"
    [ff ff 01 00] mcBallNoseTool
      Tool: "Ball Nose (0.0625 inch)"
      [GUID + XX 80] Tool: "Ball Nose (0.125 inch)"
      [GUID + XX 80] Tool: "Ball Nose (0.25 inch)"
  [01 80 param=12] "ToolGroup - End"
  ...
  [01 80 param=11] "Drills"
    [ff ff 01 00] mcDrillTool
      Tool: "Drill (0.250\")"
  [01 80 param=12] "ToolGroup - End"
[01 80 param=12] "ToolGroup - End"  (closes root)
```

---

## 7. UTF-16LE String Format

UTF-16 strings use the marker pattern:
```
FF FE FF [byte: char_count] [char_count * 2 bytes: UTF-16LE data]
```
- `FF FE FF 00` = empty string
- `FF FE FF 1A` followed by 26 UTF-16LE characters = "Imperial Tools | End Mills"

These appear as:
- Group descriptions (e.g., "Default tool set, defined using imperial units.")
- Breadcrumb paths (e.g., "Imperial Tools | V-Bits")
- Parameter names (e.g., "ToolIsLocked")

---

## 8. Unit System

The format supports both imperial and metric variants. The active unit system is encoded in the `zero_byte` field of each tool header and also described in the root group's UTF-16 description string.

| zero_byte | Unit system | Description string example                              |
|-----------|-------------|--------------------------------------------------------|
| `0`       | Imperial    | `"Default tool set, defined using imperial units."`    |
| `1`       | Metric      | `"Default tool set, defined using metric units."`      |

| Measurement      | Imperial unit   | Metric unit |
|------------------|-----------------|-------------|
| diameter         | inches          | mm          |
| stepdown         | inches          | mm          |
| stepover         | inches          | mm          |
| feed_rate        | inches/minute   | mm/minute   |
| plunge_rate      | inches/minute   | mm/minute   |
| spindle_speed    | RPM             | RPM         |
| radius (header)  | inches          | mm          |
| tip_geometry     | inches          | mm          |

**spindle_speed is always RPM regardless of unit system.**

### Confirmed metric values (Aspire9DefaultMetric.tool)

| Name              | diameter (mm) | feed_rate (mm/min) | plunge_rate (mm/min) | stepdown (mm) |
|-------------------|---------------|--------------------|----------------------|---------------|
| End Mill (2 mm)   | 2.0           | 60                 | 20                   | 9.0           |
| End Mill (3 mm)   | 3.0           | 60                 | 20                   | 9.0           |
| End Mill (6 mm)   | 6.0           | 60                 | 20                   | 3.0           |
| End Mill (12 mm)  | 12.0          | 40                 | 15                   | 4.0           |
| Ball Nose (3 mm)  | 3.0           | 20                 | 7                    | 1.5           |
| Ball Nose (6 mm)  | 6.0           | 40                 | 15                   | 3.0           |

---

## 9. Parser Algorithm

To extract all tools from a .tool file:

1. **Read file header:** int32 file_version at offset 0, int32 total_records at offset 4.
2. **Find tool type markers:** Search for `FF FF 01 00 [len] mc*Tool` patterns.
3. **For each type marker:** The first tool record starts immediately after the marker string (21-byte header at marker_end).
4. **Parse tool header:** Read version(4) + subtype(4) + radius_f32(4) + tip_geom_f32(4) + const_6(4) + zero_byte(1) = 21 bytes.
5. **Parse f64 fields:** Read 5 consecutive float64 LE values (diameter, stepdown, stepover, feed_rate, plunge_rate).
6. **Parse int32 fields:** Read 4 consecutive int32 LE values (num_flutes, spindle_speed, tool_number, name_length).
7. **Read name:** ASCII string of name_length bytes (including null terminator).
8. **Find continuation tools:** After each tool's extended data block, look for a 16-byte GUID followed by `00 00 [int32] [XX 80] 02 00 00 00`, then parse from the version field using steps 4-7.
9. **Alternative approach (used by current parser):** Scan for all positions where bytes 0-3 = `02 00 00 00` (version=2) AND bytes 16-19 = `06 00 00 00` (constant_6=6). At each candidate, check `zero_byte` (offset +20): `0` = imperial, `1` = metric. Apply radius ceiling accordingly (imperial: < 10.0 in; metric: < 500.0 mm). This finds tool headers directly regardless of record framing and handles both unit systems.

---

## 10. Complete Decoded Tool Data (aspire9.tool)

| Type        | Name                                          | Diameter | Stepdown | Stepover | Feed IPM | Plunge IPM | Spindle | Flutes | Angle  |
|-------------|-----------------------------------------------|----------|----------|----------|----------|------------|---------|--------|--------|
| EndMill     | End Mill (0.125 inch)                         | 0.125    | 0.125    | 0.050    | 50       | 20         | 12000   | 4      | -      |
| EndMill     | End Mill (0.25 inch)                          | 0.250    | 0.260    | 0.100    | 120      | 30         | 18000   | 4      | -      |
| EndMill     | End Mill (0.5 inch)                           | 0.500    | 0.400    | 0.200    | 100      | 30         | 12000   | 4      | -      |
| BallNose    | Ball Nose (0.0625 inch)                       | 0.125*   | 0.031    | 0.013    | 25       | 15         | 12000   | 4      | -      |
| BallNose    | Ball Nose (0.125 inch)                        | 0.125    | 0.063    | 0.013    | 50       | 20         | 12000   | 4      | -      |
| BallNose    | Ball Nose (0.25 inch)                         | 0.250    | 0.125    | 0.025    | 100      | 30         | 12000   | 4      | -      |
| VBit        | V-Bit (60 deg 0.25")                          | 0.250    | 0.200    | 0.010    | 100      | 30         | 16000   | 4      | 60.0   |
| VBit        | V-Bit (90 deg 0.5")                           | 0.500    | 0.250    | 0.010    | 100      | 30         | 16000   | 4      | 90.0   |
| VBit        | V-Bit (90 deg 1.25")                          | 1.250    | 0.500    | 0.016    | 100      | 30         | 12000   | 4      | 90.0   |
| FormTool    | Ogee - 1/4" Rads 1 1/4" Dia 1/2" Deep        | 1.250    | 0.200    | 0.250    | 2        | 1          | 12000   | 3      | -      |
| FormTool    | Roundover - 3/8" Rad 1" Dia x 1/2" Deep      | 1.000    | 0.250    | 0.200    | 2        | 1          | 12000   | 4      | -      |
| Engraving   | Engrave (20' 0.02" Tip Dia)                   | 0.250    | 0.040    | 0.008    | 40       | 10         | 12000   | 4      | ~43.2  |
| DiamondDrag | Diamond Drag (90 deg 0.020" Line Width)       | 0.125    | 0.062    | 0.010    | 100      | 30         | 16000   | 4      | 90.0   |
| Drill       | Drill (0.250")                                | 0.250    | 0.250    | 0.002    | 3.1      | 1          | 12000   | 3      | 118.0  |

\* Ball Nose (0.0625 inch) stores diameter=0.125 in binary; the name may refer to the ball radius.

---

## 11. File Format Comparison

| Feature              | aspire9.tool           | Aspire_jere tools.tool | Aspire9DefaultMetric.tool | Aspire9DefaultImperial.tool |
|----------------------|------------------------|------------------------|---------------------------|-----------------------------|
| File version         | 3                      | 3                      | 3                         | 3                           |
| Record version       | 2                      | 2                      | 2                         | 2                           |
| Tool count           | 14                     | 30                     | ≥ 6 (confirmed)           | same as aspire9.tool        |
| Tool types present   | EM, BN, VBit, Form, Engr, DD, Drill | EM, Drill, RadEM, BN, VBit, Engr | EM, BN, VBit, Form, DD, Drill | EM, BN, VBit, Form, Engr, DD, Drill |
| Unit system          | Imperial (inches)      | Imperial (inches)      | **Metric (mm)**           | Imperial (inches)           |
| Root group name      | "Imperial Tools"       | "small drills"         | **"Metric Tools"**        | "Imperial Tools"            |
| zero_byte value      | `0`                    | `0`                    | **`1`**                   | `0`                         |
| Header constant_6    | 6                      | 6                      | 6                         | 6                           |
| File size (bytes)    | 22,422                 | 27,345                 | 18,147                    | similar to aspire9.tool     |

**Note on `.tool_db` extension:** Aspire 9 also writes files with a `.tool_db` extension. These are byte-for-byte identical in format to `.tool` files. The parser accepts both extensions.

The continuation marker byte (XX in `XX 80`) is file-specific and should NOT be used to determine tool type. Use the `tool_subtype` field (int32 at header offset +4) instead.
