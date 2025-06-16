# KiCad footprints for testing

## Files

### `SKRHADE010.kicad_mod`

<https://github.com/jusdisgi/KiCad_Footprints/blob/b5b9189cec0c31a0c8c53949ddad101da201205b/SKRHADE010.kicad_mod>

With `(unlocked yes)` on line 72 removed.

### `ezmate.kicad_mod`

<https://github.com/ebastler/marbastlib/blob/ab4e65abbd7d910332ad5d273b00c57a6961a522/footprints/marbastlib-various.pretty/Molex_Pico-EZmate_78171-0004_1x04-1MP_P1.20mm_Vertical.kicad_mod>

### `e73.kicad_mod`

<https://github.com/ebastler/marbastlib/blob/ab4e65abbd7d910332ad5d273b00c57a6961a522/footprints/marbastlib-various.pretty/nRF52840_E73-2G4M08S1C.kicad_mod>

With `(unlocked yes)` on line 187 removed.

### `ws2812.kicad_mod`

<https://github.com/ebastler/marbastlib/blob/ab4e65abbd7d910332ad5d273b00c57a6961a522/footprints/marbastlib-various.pretty/LED_WS2812_2020.kicad_mod>

With the following removed:

- `(unlocked yes)` on line 193
- `(justify left bottom)` on line 202

Without those modifications, test fails with:

```txt
Diffing footprint instance 4
FP1: XX4 at Point(69, 81) rot 137.0 on B.Cu
FP2: XX4 at Point(69, 81) rot 137.0 on B.Cu
Shapes in first but not in second (1/17)
  TextPCB
    Position: Point(70.6209, 81.8278)
    Layer: B.Fab
    Text: O:137.0 J:('top', 'bottom') S:Size(0.6, 0.6) T:0.1
          1
Shapes in second but not in first (1/17)
  TextPCB
    Position: Point(70.6209, 81.8278)
    Layer: B.Fab
    Text: O:317.0 J:('top', 'bottom') S:Size(0.6, 0.6) T:0.1
          1
```

OR

```txt
Diffing footprint instance 4
FP1: XX4 at Point(69, 81) rot 137.0 on B.Cu
FP2: XX4 at Point(69, 81) rot 137.0 on B.Cu
Shapes in first but not in second (1/17)
  TextPCB
    Position: Point(70.6209, 81.8278)
    Layer: B.Fab
    Text: O:137.0 J:('top', 'bottom') S:Size(0.6, 0.6) T:0.1
          1
Shapes in second but not in first (1/17)
  TextPCB
    Position: Point(70.6209, 81.8278)
    Layer: B.Fab
    Text: O:137.0 J:('bottom', 'top') S:Size(0.6, 0.6) T:0.1
          1
```

### `jumper2.kicad_mod`

<https://gitlab.com/kicad/libraries/kicad-footprints/-/blob/c998f41287f301c889debfd1c41e6846cda60194/Jumper.pretty/SolderJumper-2_P1.3mm_Open_TrianglePad1.0x1.5mm.kicad_mod>

### `jumper3.kicad_mod`

<https://gitlab.com/kicad/libraries/kicad-footprints/-/blob/c998f41287f301c889debfd1c41e6846cda60194/Jumper.pretty/SolderJumper-3_P2.0mm_Open_TrianglePad1.0x1.5mm.kicad_mod>

### `hdmi.kicad_mod`

<https://gitlab.com/kicad/libraries/kicad-footprints/-/blob/c998f41287f301c889debfd1c41e6846cda60194/Connector_Video.pretty/HDMI_Micro-D_Molex_46765-2x0x.kicad_mod>
