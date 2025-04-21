import type { SExprNode, SExprItem } from './parser';

export type ErgogenFootprintWriterConfig = {
  padPrefix: string;
  prefixNumberPadsOnly: boolean;
};

export class ErgogenFootprintWriter {
  private config: ErgogenFootprintWriterConfig;

  constructor(config: Partial<ErgogenFootprintWriterConfig> = {}) {
    this.config = {
      padPrefix: 'P',
      prefixNumberPadsOnly: true,
      ...config
    };
  }

  public write(node: SExprNode): string {
    if (node.type !== 'footprint') throw new Error('Only footprints are supported');

    const { layer, wellknown, pads, drawings, other } = groupNodes(node);
    const { defaultSide, flipSide, layerSuffix } = parseLayerInfo(layer);

    const bodySection: string[] = [];

    // define "flip"
    bodySection.push(`const flip = p.side === "${flipSide}";\n`);
    bodySection.push(`if (!flip && p.side !== "${defaultSide}") throw new Error('unsupported side: ' + p.side);\n\n`);

    bodySection.push(`fp.push(\`(footprint`);
    for (const text of node.items) {
      if (typeof text === 'string') {
        appendToken(bodySection, text);
      }
    }
    bodySection.push(`\`);\n`);

    // at
    bodySection.push(`fp.push(p.at);\n`);

    // layer
    bodySection.push(`fp.push(\`(layer \${(flip ? "${flipSide}" : "${defaultSide}")}${layerSuffix})\`);\n`);

    for (const item of wellknown) {
      simpleAppend(bodySection, item);
    }
    bodySection.push('\n');

    // reference
    bodySection.push(`fp.push(\`(property "Reference" "\${p.ref}" \${p.ref_hide} (at 0 0 \${p.r}) (layer "\${p.side}.SilkS") (effects (font (size 1 1) (thickness 0.15))\${ p.side === "B" ? " (justify mirror)" : ""}))\`);\n\n`);
    // TODO: bring back other properties?

    // pads
    bodySection.push('\n// Pads\n');
    const padNumbers = appendPads(pads, bodySection, this.config);

    // drawings
    appendDrawings(drawings, bodySection);

    for (const item of other) {
      simpleAppend(bodySection, item);
    }

    bodySection.push('\nfp.push(`)`);\n');
    // body function done

    const removePattern = /\s*\((?:uuid|tstamp) "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"\)/g;

    let ergogenFootprint = `module.exports = {
  params: {
    designator: 'XX',
    side: 'F',
${Array.from(padNumbers)
        .map((padNumber) => padNameToNetName(this.config, padNumber))
        .sort()
        .map((padNumber) => `    ${padNumber}: { type: 'net', value: undefined },`)
        .join('\n')
      }
  },
  body: p => {
    const fp = [];
    ${bodySection.join('').replace(removePattern, '')}
    return fp.join('\\n');
  }
}
`
    return ergogenFootprint;
  }
}

function appendDrawings(drawings: SExprNode[], bodySection: string[]) {
  // group drawings by layer
  const drawingsByLayer: Map<string, SExprNode[]> = new Map();

  for (const drawing of drawings) {
    const layer = drawing.items.find((item) => typeof item === 'object' && item.type === 'layer') as SExprNode | undefined;
    if (!layer || layer.items.length === 0 || typeof layer.items[0] !== 'string') continue; // ignore drawings without a valid layer
    const layerName = (layer.items[0] as string).replace(/^"|"$/g, '');

    if (!drawingsByLayer.has(layerName)) {
      drawingsByLayer.set(layerName, []);
    }
    drawingsByLayer.get(layerName)!.push(drawing);
  }

  for (const [layerName, drawings] of drawingsByLayer) {
    bodySection.push(`// ${layerName}\n`);
    const layerFlipable = layerName.startsWith('F.') || layerName.startsWith('B.');
    const flippedLayerName = !layerFlipable
      ? ''
      : (
        (layerName.startsWith('F.')
          ? `B${layerName.slice(1)}`
          : `F${layerName.slice(1)}`)
      );

    const appendDrawingTokens = {
      'at': appendAt,
      'start': appendFlipableXY,
      'end': appendFlipableXY,
      'mid': appendFlipableXY,
      'center': appendFlipableXY,
      'xy': appendFlipableXY,
      'pts': (to: string[], node: SExprNode) => {
        to.push(' (pts');
        for (const xy of node.items) {
          if (typeof xy !== 'object') throw new Error('expected xy node');
          appendFlipableXY(to, xy);
        }
        to.push(')');
      },
      'layer': (to: string[], node: SExprNode) => {
        if (layerFlipable) {
          to.push(` (layer \${(flip ? "${flippedLayerName}" : "${layerName}")})`);
        } else {
          to.push(` (layer "${layerName}")`);
        }
      },
      'effects': (to: string[], node: SExprNode) => {
        to.push(' (effects');

        const hasJustify = node.items.some((item) => typeof item === 'object' && item.type === 'justify');

        if (hasJustify) {
          for (const justify of node.items) {
            if (typeof justify === 'object' && justify.type === 'justify') {
              // find the current mirror state
              const currentlyMirrored = justify.items.some((item) => item === 'mirror');

              to.push(' (justify');
              justify.items.forEach((item) => {
                if (item !== 'mirror') {
                  appendToken(to, item);
                }
              });

              // add the correct mirror state
              if (currentlyMirrored) {
                to.push('${ flip ? "" : " mirror"}');
              } else {
                to.push('${ flip ? " mirror" : ""}');
              }

              to.push(')');
            } else {
              // not justify
              appendToken(to, justify);
            }
          }
        } else {
          // no justify
          node.items.forEach((item) => appendToken(to, item));
          to.push('${ p.side === "B" ? " (justify mirror)" : ""}');
        }

        to.push(')');
      },
    } as { [key: string]: (to: string[], node: SExprNode) => void; };

    for (const drawing of drawings) {
      bodySection.push('fp.push(`(');
      bodySection.push(drawing.type);
      for (const item of drawing.items) {
        if (typeof item === 'string') {
          appendToken(bodySection, item);
        } else {
          const appendTokenCustom = appendDrawingTokens[item.type];
          if (!appendTokenCustom) {
            appendToken(bodySection, item);
          } else {
            appendTokenCustom(bodySection, item);
          }
        }
      }
      bodySection.push(')`);\n');
    }

    bodySection.push('\n');
  }
}

function appendPads(pads: SExprNode[], bodySection: string[], config: ErgogenFootprintWriterConfig): Set<string> {
  const padNumbers = new Set<string>();

  for (const pad of pads) {
    if (pad.items.length === 0) throw new Error('pad has no attributes');
    if (typeof pad.items[0] !== 'string') throw new Error('pad name is not a string');
    const padName = pad.items[0];

    padNumbers.add(padName);

    bodySection.push('fp.push(`(pad');
    for (const item of pad.items) {
      if (typeof item === 'string') {
        appendToken(bodySection, item);
      } else {
        switch (item.type) {
          case "at":
            // TODO: verify if custom shaped pads are flipped correctly
            // TODO: verify rotation after flipping is correct
            appendAt(bodySection, item);
            break;
          case "layers":
            appendLayers(bodySection, item);
          case "net":
            // remove
            break;
          default:
            appendToken(bodySection, item);
            break;
        }
      }
    }
    if (padName !== '""') {
      bodySection.push(` \${p.${padNameToNetName(config, padName)}}`);
    }
    bodySection.push(')`);\n');
  }

  padNumbers.delete('""');
  bodySection.push('\n');
  return padNumbers;
}

function groupNodes(node: SExprNode) {
  let layer: SExprNode | null = null;
  const wellknown: SExprNode[] = [];
  const pads: SExprNode[] = [];
  const drawings: SExprNode[] = [];
  const other: SExprNode[] = [];

  for (const item of node.items) {
    if (typeof item !== 'object') continue;

    switch (item.type) {
      case 'layer':
        if (!layer) layer = item;
        break;
      case 'attr':
      case 'tags':
      case 'descr':
        wellknown.push(item);
        break;
      case 'pad':
        pads.push(item);
        break;
      case 'fp_text':
      case 'fp_text_box':
      case 'fp_line':
      case 'fp_rect':
      case 'fp_circle':
      case 'fp_arc':
      case 'fp_poly':
      case 'fp_curve':
        drawings.push(item);
        break;
      case 'property':
      case 'uuid':
      case 'version':
        // ignore
        break;
      default:
        other.push(item);
        break;
    }
  }
  return { layer, wellknown, pads, drawings, other };
}

function parseLayerInfo(layer: SExprNode | null) {
  let layerSuffix = '.Cu';
  let defaultSide = '';
  let flipSide = '';

  if (layer && layer.items.length > 0) {
    let layerName = layer.items[0];
    if (typeof layerName !== 'string') throw new Error('layer name is not a string');
    layerName = layerName.replace(/^"|"$/g, '');
    if (layerName.startsWith('F.')) {
      defaultSide = 'F';
      flipSide = 'B';
    } else if (layerName.startsWith('B.')) {
      defaultSide = 'B';
      flipSide = 'F';
    } else {
      throw new Error('failed to parse layer name');
    }
    const dotIndex = layerName.indexOf('.');
    if (dotIndex !== -1) {
      layerSuffix = layerName.slice(dotIndex);
    } else {
      throw new Error('failed to parse layer name');
    }
  } else {
    defaultSide = 'F';
    flipSide = 'B';
  }
  return { defaultSide, flipSide, layerSuffix };
}

function simpleAppend(to: string[], node: SExprNode): void {
  to.push(`fp.push(\`(`);
  to.push(node.type);
  for (const item of node.items) {
    appendToken(to, item);
  }
  to.push(`)\`);\n`);
}

function padNameToNetName(config: ErgogenFootprintWriterConfig, padName: string): string {
  padName = padName.replace(/^"|"$/g, '');
  if (config.prefixNumberPadsOnly && isNaN(Number(padName))) {
    return padName;
  } else {
    return `${config.padPrefix}${padName}`;
  }
}

/**
 * Append flipable XY token like `start`, `end`, `mid`, `xy`
 * @param target
 * @param node
 */
function appendFlipableXY(target: string[], node: SExprNode): void {
  if (!['start', 'end', 'mid', 'center', 'xy'].includes(node.type)) throw new Error('expected "start", "end", "mid", "center", or "xy" node');
  if (node.items.length !== 2) throw new Error('invalid number of items in "start", "end", "mid", or "xy" node');
  if (node.items.some((item) => typeof item !== 'string')) throw new Error('invalid item in "start", "end", "mid", or "xy" node');

  const x = node.items[0] as string;
  const y = node.items[1] as string;
  const flippedX = x.startsWith('-') ? x.slice(1) : `-${x}`;
  target.push(` (${node.type} \${(flip ? ${flippedX} : ${x})} ${y})`);
}

/**
 * Append bare token
 * @param to
 * @param token
 */
function appendToken(to: string[], token: SExprItem): void {
  if (typeof token === 'string') {
    to.push(" ");
    to.push(token.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${'));
  } else {
    to.push(" (");
    to.push(token.type);
    for (const item of token.items) {
      appendToken(to, item);
    }
    to.push(")");
  }
}

/**
 * Append `layers` with flip support
 * @param to
 * @param node
 */
function appendLayers(to: string[], node: SExprNode): void {
  if (node.type !== 'layers') throw new Error('expected "layers" node');
  if (node.items.some((item) => typeof item !== 'string')) throw new Error('invalid item in "layers" node');

  const layerNames = node.items
    .map((layer) => (layer as string).replace(/^"|"$/g, ''))
    .map((layer) => {
      if (layer.startsWith('F.')) {
        return `"\${(flip ? "B" : "F")}${layer.slice(1)}"`;
      } else if (layer.startsWith('B.')) {
        return `"\${(flip ? "F" : "B")}${layer.slice(1)}"`;
      } else {
        return `"${layer}"`;
      }
    });
  to.push(` (layers ${layerNames.join(' ')})`);
}

/**
 * Append a `at` with `flip` check in a string interpolation
 * @param target
 * @param node
 */
function appendAt(target: string[], node: SExprNode): void {
  // assume we are in the middle of a `fp.push` call with string interpolation
  // fp.push(`(pad "1" smd rect (at ${x} ${y} ${r}) ...)`);
  //                            ^^^^^^^^^^^^^^^^^^^ this part
  if (node.type !== 'at') throw new Error('expected "at" node');
  if (node.items.length !== 2 && node.items.length !== 3) throw new Error('invalid number of items in "at" node');
  if (node.items.some((item) => typeof item !== 'string')) throw new Error('invalid item in "at" node');

  const x = node.items[0] as string;
  const y = node.items[1] as string;
  const flippedX = x.startsWith('-') ? x.slice(1) : `-${x}`;
  let r = '${p.r}';
  if (node.items.length === 3) {
    r = `\${p.r + ${node.items[2]}}`;
  }

  if (x === '0') {
    target.push(` (at ${x} ${y} ${r})`);
  } else {
    target.push(` (at \${(flip ? ${flippedX} : ${x})} ${y} ${r})`);
  }
}

/**
 * Extracts pad names from a footprint node
 * @param node Footprint node
 * @returns Array of pad names
 */
export function scanPadNames(node: SExprNode): string[] {
  if (node.type !== 'footprint') throw new Error('Only extracting nets from footprints is supported');

  const names: string[] = [];
  for (const pad of node.items) {
    if (typeof pad === 'object' && pad.type === 'pad') {
      if (pad.items.length === 0) throw new Error('pad has no attributes');
      if (typeof pad.items[0] !== 'string') throw new Error('pad name is not a string');

      // strip quotes
      let name = pad.items[0];
      if (name.startsWith('"')) name = name.slice(1);
      if (name.endsWith('"')) name = name.slice(0, -1);
      names.push(name);
    }
  }

  return Array.from(new Set(names));
}
