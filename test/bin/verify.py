import sys
import os
from kigadgets.board import Board
from kigadgets.item import HasLayer, HasPosition, HasOrientation, TextEsque

SPACING = 19
ANGLE = 43.0

if len(sys.argv) < 2:
    print("Error: Missing PCB file path", file=sys.stderr)
    sys.exit(1)

file_path = sys.argv[1]
if not os.path.isfile(file_path):
    print(f"Error: File '{file_path}' does not exist", file=sys.stderr)
    sys.exit(1)

def diff_items(fp1, fp2):
    hashes1 = [shape.geohash() for shape in fp1]
    hashes2 = [shape.geohash() for shape in fp2]

    set1 = set(hashes1)
    set2 = set(hashes2)

    diff1 = [shape for shape, h in zip(fp1, hashes1) if h not in set2]
    diff2 = [shape for shape, h in zip(fp2, hashes2) if h not in set1]

    return diff1, diff2

def print_shape_info(shape):
    print(f"  {type(shape).__name__}")
    if isinstance(shape, HasPosition):
        print(f"    Position: {shape.position}")
    if isinstance(shape, HasOrientation):
        print(f"    Orientation: {shape.orientation}")
    if isinstance(shape, HasLayer):
        print(f"    Layer: {shape.layer}")
    if isinstance(shape, TextEsque):
        print(f"    Text: O:{shape.orientation} J:{shape.justification} S:{shape.size} T:{shape.thickness}")
        print(f"          {shape.text}")

def print_diff(fp1, fp2):
    print(f"FP1: {fp1.reference} at {fp1.position} rot {fp1.orientation} on {fp1.layer}")
    print(f"FP2: {fp2.reference} at {fp2.position} rot {fp2.orientation} on {fp2.layer}")

    items1 = fp1.pads + fp1.graphical_items
    items2 = fp2.pads + fp2.graphical_items
    diff1, diff2 = diff_items(items1, items2)

    if diff1:
        print(f"Shapes in first but not in second ({len(diff1)}/{len(items1)})")
        for shape in diff1:
            print_shape_info(shape)

    if diff2:
        print(f"Shapes in second but not in first ({len(diff2)}/{len(items2)})")
        for shape in diff2:
            print_shape_info(shape)

    if not diff1 and not diff2:
        print("No differences found.")

pcb = Board.load(file_path)

references = [fp.reference for fp in pcb.footprints]
if references != ['XX1', 'XX2', 'XX3', 'XX4']:
    print(f"Error: Expected footprint references ['XX1', 'XX2', 'XX3', 'XX4'] but got {references}", file=sys.stderr)
    sys.exit(1)

baseHash = pcb.geohash()
baseFpHash = [fp.geohash() for fp in pcb.footprints]
# print(f"baseHash={baseHash} baseFpHash={baseFpHash}")

# If there is a third argument, save the PCB before modification
if len(sys.argv) > 3:
    pcb.save(sys.argv[3])

# delete all footprints except the first one
for fp in pcb.footprints:
    if fp.reference != 'XX1':
        # print(f"Removing footprint {fp.reference} at {fp.position} with orientation {fp.orientation}")
        pcb.remove(fp)

# copy the first footprint
# XX1: Point(50, 100), R: 0.0, Flip: False
# XX2: Point(50, 81), R: 0.0, Flip: True
# XX3: Point(69, 100), R: 43.0, Flip: False
# XX4: Point(69, 81), R: 43.0, Flip: True

XX1 = pcb.footprints[0]

XX2 = XX1.copy('XX2', pos=XX1.position + (0, -SPACING))
pos = XX2.position
XX2.flip()
XX2.position = pos # make sure it stays in the same position

XX3 = XX1.copy('XX3', pos=XX1.position + (SPACING, 0))
XX3.orientation = ANGLE

XX4 = XX1.copy('XX4', pos=XX1.position + (SPACING, -SPACING))
pos = XX4.position
XX4.orientation = ANGLE
XX4.flip()
XX4.position = pos # make sure it stays in the same position

newHash = pcb.geohash()
newFpHash = [XX1.geohash(), XX2.geohash(), XX3.geohash(), XX4.geohash()]
# print(f"newHash={newHash} newFpHash={newFpHash}")

if baseHash == newHash:
    sys.exit(0)

compare = [a == b for a, b in zip(baseFpHash, newFpHash)]
print(f"compare={compare}")

# Load the original PCB file again
refpcb = Board.load(file_path)
ref_footprints = refpcb.footprints
print("\nDiffing footprint instance 1")
print_diff(ref_footprints[0], XX1)
print("\nDiffing footprint instance 2")
print_diff(ref_footprints[1], XX2)
print("\nDiffing footprint instance 3")
print_diff(ref_footprints[2], XX3)
print("\nDiffing footprint instance 4")
print_diff(ref_footprints[3], XX4)

# If there is a second argument, save the PCB to that file
if len(sys.argv) > 2:
    pcb.save(sys.argv[2])

sys.exit(1)
