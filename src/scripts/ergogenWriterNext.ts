import type { SExprNode, SExprItem } from './parser';

interface WriterContext {
  current: SExprNode;
  parents: string[];
  getNetName: (padName: string) => string;
  appendOutput: (text: string) => void;
  appendOutputRaw: (text: string) => void;
  writeChildItem: (item: SExprItem) => void;
}

interface NodeWriter {
  readonly name: string;
  match: (context: WriterContext) => boolean;
  write: (context: WriterContext) => void;
}

type NodeWriters = NodeWriter[];

const writers: NodeWriters = [
  {
    name: 'pad',
    match(context: WriterContext) {
      return context.current.type === 'pad';
    },
    write(context: WriterContext) {
      const pad = context.current as SExprNode;
      let padName = pad.items[0];
      if (typeof padName !== 'string') {
        throw new Error(`Pad name is not a string: ${JSON.stringify(padName)}`);
      }
      padName = padName.replace(/^"(.*)"$/, '$1'); // remove quotes
      const netName = context.getNetName(padName);

      context.appendOutputRaw(`(pad "${padName}"`);

      for (let i = 1; i < pad.items.length; i++) {
        const item = pad.items[i];
        context.appendOutputRaw(' ');
        context.writeChildItem(item);
      }
      context.appendOutputRaw(` \${p.${netName}}`);

      context.appendOutputRaw(')');
    }
  },
  {
    name: 'xy',
    match(context: WriterContext) {
      return ['start', 'end', 'mid', 'center', 'xy'].includes(context.current.type);
    },
    write(context: WriterContext) {
      const node = context.current as SExprNode;
      const x = node.items[0] as string;
      const y = node.items[1] as string;
      const flippedX = x.startsWith('-') ? x.slice(1) : `-${x}`;
      context.appendOutputRaw(`(${node.type} \${(flip ? ${flippedX} : ${x})} ${y})`);
    }
  },
  {
    name: 'layer',
    match(context) {
      return context.current.type === 'layer';
    },
    write(context) {
      const node = context.current as SExprNode;
      if (node.items.length !== 1) throw new Error('invalid item in "layer" node');
      let layerName = node.items[0] as string;
      if (typeof layerName !== 'string') throw new Error('invalid item in "layer" node');
      layerName = layerName.replace(/^"(.*)"$/, '$1'); // remove quotes

      const flippable = layerName.startsWith('F.') || layerName.startsWith('B.');
      const flippedLayerName = layerName.replace(/^([FB])\./, (match) => {
        if (match === 'F.') { return 'B.'; }
        else if (match === 'B.') { return 'F.'; }
        else { throw new Error(`Invalid layer name: ${layerName}`); }
      });

      if (flippable) {
        context.appendOutputRaw(`(layer "\${(flip ? "${flippedLayerName}" : "${layerName}")}")`);
      } else {
        context.appendOutputRaw(`(layer "${layerName}")`);
      }
    },
  },
  {
    name: 'layers',
    match(context) {
      return context.current.type === 'layers';
    },
    write(context) {
      const node = context.current as SExprNode;
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
      context.appendOutputRaw(`(layers ${layerNames.join(' ')})`);
    },
  },
  {
    name: 'at',
    match(context) {
      return context.current.type === 'at';
    },
    write(context) {
      const node = context.current as SExprNode;

      if (node.items.length !== 2 && node.items.length !== 3) throw new Error('invalid number of items in "at" node');
      if (node.items.some((item) => typeof item !== 'string')) throw new Error('invalid item in "at" node');

      const x = node.items[0] as string;
      const y = node.items[1] as string;
      const flippedX = x.startsWith('-') ? x.slice(1) : `-${x}`;
      let r = '${p.r}';
      if (node.items.length === 3) {
        r = `\${(p.r + ${node.items[2]}) % 360}`;
      }

      if (/^-?0(?:\.0+)?$/.test(x)) { // if x is 0 or -0
        context.appendOutputRaw(`(at ${x} ${y} ${r})`);
      } else {
        context.appendOutputRaw(`(at \${(flip ? ${flippedX} : ${x})} ${y} ${r})`);
      }
    }
  },
  {
    name: 'effects',
    match(context) {
      return context.current.type === 'effects';
    },
    write(context) {
      context.appendOutputRaw(`(${context.current.type}`);
      for (const item of context.current.items) {
        context.appendOutputRaw(' ');
        context.writeChildItem(item);
      }

      // add `justify` node if there isn't one
      if (!context.current.items.some((item) => typeof item !== 'string' && item.type === 'justify')) {
        context.appendOutputRaw(' ');
        context.writeChildItem({
          type: 'justify',
          items: [],
        });
      }

      context.appendOutputRaw(')');
    },
  },
  {
    name: 'justify',
    match(context) {
      return context.current.type === 'justify';
    },
    write(context) {
      const node = context.current as SExprNode;
      const mirror = node.items.some((item) => item === 'mirror');

      context.appendOutputRaw(`(${node.type}`);
      for (const item of node.items) {
        if (typeof item === 'string' && item !== 'mirror') {
          context.appendOutputRaw(' ');
          context.appendOutputRaw(item);
        }
      }
      if (mirror) {
        context.appendOutputRaw('${ flip ? "" : " mirror"}');
      } else {
        context.appendOutputRaw('${ flip ? " mirror" : ""}');
      }

      context.appendOutputRaw(')');
    }
  },
  // TODO: chamfer?
  {
    name: 'skip', // DO NOT CHANGE NAME, used below to skip adding "fp.push(``);"
    match(context: WriterContext) {
      return [
        'version', // Is required by spec, but causing weird issues.
        'uuid',
        'group',
        'tedit',
        'tstamp',
        'generator', // Required by spec to not be "pcbnew" when generated by third party generators
        'generator_version',
      ].includes(context.current.type);
    },
    write(context: WriterContext) {
      // remove from output
    }
  },
  {
    name: 'property', // DO NOT CHANGE NAME, used below to add "//" to comment out those lines
    match(context: WriterContext) { return context.current.type === 'property' },
    write(context: WriterContext) {
      context.appendOutputRaw(`(${context.current.type}`);
      for (const item of context.current.items) {
        context.appendOutputRaw(' ');
        context.writeChildItem(item);
      }
      context.appendOutputRaw(')');
    },
  },
  {
    name: 'fallback catchall',
    match(context: WriterContext) { return true }, // handles everything
    write(context: WriterContext) {
      context.appendOutputRaw(`(${context.current.type}`);
      for (const item of context.current.items) {
        context.appendOutputRaw(' ');
        context.writeChildItem(item);
      }
      context.appendOutputRaw(')');
    },
  },
];

export type ErgogenFootprintConverterConfig = {
  padPrefix: string;
  prefixNumberPadsOnly: boolean;
  netNameOverride: Record<string, string>;
};

const defaultConfig: ErgogenFootprintConverterConfig = {
  padPrefix: 'P',
  prefixNumberPadsOnly: true,
  netNameOverride: {},
};

export default function convertToErgogenFootprint(
  footprint: SExprNode,
  config: Partial<ErgogenFootprintConverterConfig> = {}
): {
  ergogenCode: string;
  netMap: Record<string, string>;
} {
  const fullConfig = { ...defaultConfig, ...config };
  const footprintCode: string[] = [];
  const pad2net = new Map<string, string>(Object.entries(fullConfig.netNameOverride));


  const baseContext: WriterContext = {
    current: { type: '', items: [] }, // dummy placeholder
    parents: [],
    getNetName: (padName: string): string => {
      if (pad2net.has(padName)) {
        return pad2net.get(padName)!;
      }

      let netName = padName;

      // prefix with "P" if: prefix all pads, OR padName starts with a number
      if (!fullConfig.prefixNumberPadsOnly || /^\d/.test(padName)) {
        netName = `${fullConfig.padPrefix}${padName}`;
      }

      // check for duplicates
      const existingNetNames = Array.from(pad2net.values());
      if (existingNetNames.includes(netName)) {
        let i = 1;
        let dupCheck = `${netName}_${i}`;
        while (existingNetNames.includes(dupCheck)) {
          i++;
          dupCheck = `${netName}_${i}`;
        }
        netName = dupCheck;
      }

      // add to map
      pad2net.set(padName, netName);
      return netName;
    },
    appendOutput: (text: string) => footprintCode.push(text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')),
    appendOutputRaw: (text: string) => footprintCode.push(text),
    writeChildItem(node: SExprItem) {
      if (typeof node === 'string') {
        this.appendOutput(node);
        return;
      }

      const childContext: WriterContext = {
        ...this,
        current: node,
        parents: [...this.parents, this.current.type],
      };

      const writer = writers.find(w => w.match(childContext));
      if (writer) {
        writer.write(childContext);
      } else {
        throw new Error(`No writer found for a node with type ${node.type}, parents: [${this.parents.join(', ')}]`);
      }
    }
  };

  // let defaultSide = 'F';
  const footprintLayerNode = footprint.items.find(i => typeof i !== 'string' && i.type === 'layer') as SExprNode | undefined;
  // if (footprintLayerNode) {
  //   const layerName = footprintLayerNode.items[0] as string;
  //   if (layerName.startsWith('F.')) {
  //     defaultSide = 'F';
  //   } else if (layerName.startsWith('B.')) {
  //     defaultSide = 'B';
  //   }
  // }

  (function writeStart() {
    let defaultSide = 'F';
    let layerName = '';
    if (footprintLayerNode) {
      layerName = footprintLayerNode.items[0] as string;
      if (typeof layerName === 'string') {
        layerName = layerName.replace(/^"(.*)"$/, '$1'); // remove quotes
      }
      if (layerName.startsWith('B.')) {
        defaultSide = 'B';
      }
    }

    let flipSide = defaultSide === 'F' ? 'B' : 'F';

    baseContext.appendOutputRaw(`const flip = p.side === "${flipSide}";\n`);
    baseContext.appendOutputRaw(`if (!flip && p.side !== "${defaultSide}") throw new Error('unsupported side: ' + p.side);\n\n`);

    baseContext.appendOutputRaw(`fp.push(\`(footprint`);
    for (const item of footprint.items) {
      if (typeof item === 'string') {
        baseContext.appendOutputRaw(` `);
        baseContext.appendOutput(item);
      }
    }
    baseContext.appendOutputRaw(`\`);\n`);

    baseContext.appendOutputRaw(`fp.push(p.at);\n`);

    // layer
    if (layerName) {
      baseContext.appendOutputRaw(`fp.push(\`(layer "\${(flip ? "${layerName.replace(defaultSide, flipSide)}" : "${layerName}")}")\`);\n`);
    }
  })();

  const groupedElements = groupElements(footprint);

  for (const group of groupedElements) {
    baseContext.appendOutputRaw('\n');
    if (group.groupName) {
      baseContext.appendOutputRaw(`// ${group.groupName}\n`);
    }

    for (const item of group.items) {
      const newContext: WriterContext = {
        ...baseContext,
        current: item,
      };

      const writer = writers.find(w => w.match(newContext));
      if (writer) {
        if (writer.name === 'skip') {
          continue; // skip this item
        }
        if (writer.name === 'property') {
          newContext.appendOutputRaw('// ');
        }
        newContext.appendOutputRaw('fp.push(`');
        writer.write(newContext);
        newContext.appendOutputRaw('`);\n');
      } else {
        throw new Error(`No writer found for a node with type ${item.type}, parents: [${newContext.parents.join(', ')}]`);
      }
    }
  }

  let result = `module.exports = {
  params: {
    designator: 'XX',
    side: 'F',
${Array.from(pad2net.values())
      .sort()
      .map((netName) => `    ${netName}: { type: 'net', value: undefined },`)
      .join('\n')
    }
  },
  body: p => {
    const fp = [];
    ${footprintCode.join('')}
    fp.push(')');
    return fp.join('\\n');
  }
}
`;

  return {
    ergogenCode: result,
    netMap: Object.fromEntries(pad2net.entries()),
  };
}

/**
 * Groups elements of a footprint into well-known groups.
 * @param footprint The footprint to group.
 * @returns An array of groups, each containing a group name and an array of items.
 */
function groupElements(footprint: SExprNode): { groupName: string; items: SExprNode[] }[] {
  enum GroupType {
    Wellknown = 0,
    Unknown = 1,
    Pad = 2,
    Drawing = 3,
    Zone = 4,
    Model = 5,
    Property = 6,
  }
  // Drawings uses layer name as group names
  const GroupTypeNames = {
    [GroupType.Wellknown]: '',
    [GroupType.Unknown]: 'Unknown to kicad2ergogen',
    [GroupType.Pad]: 'Pads',
    [GroupType.Zone]: 'Zones',
    [GroupType.Model]: '3D Models',
    [GroupType.Property]: 'Properties',
  };

  const groupMap = new Map<GroupType, SExprNode[]>();

  for (const item of footprint.items) {
    let groupType: GroupType;
    if (typeof item === 'string') {
      continue;
    }
    switch (item.type) {
      case 'at':
      case 'layer':
        // skip "layer" node for the footprint as we have special handling for it
        continue;
      case 'attr':
      case 'tags':
      case 'descr':
        groupType = GroupType.Wellknown;
        break;
      case 'pad':
        groupType = GroupType.Pad;
        break;
      case 'fp_text':
      case 'fp_text_box':
      case 'fp_line':
      case 'fp_rect':
      case 'fp_circle':
      case 'fp_arc':
      case 'fp_poly':
      case 'fp_curve':
        groupType = GroupType.Drawing;
        break;
      case 'zone':
        groupType = GroupType.Zone;
        break;
      case 'model':
        groupType = GroupType.Model;
        break;
      case 'property':
        groupType = GroupType.Property;
        break;
      default:
        groupType = GroupType.Unknown;
        break;
    }
    if (!groupMap.has(groupType)) {
      groupMap.set(groupType, []);
    }
    groupMap.get(groupType)?.push(item);
  }

  const groups: {
    groupName: string;
    items: SExprNode[];
  }[] = [];

  for (const [groupType, items] of Array.from(groupMap.entries()).sort((a, b) => a[0] - b[0])) {

    if (groupType === GroupType.Drawing) {
      // group again by drawing layer
      const drawingGroups = new Map<string, SExprNode[]>();
      for (const item of items) {

        const layerNode = item.items.find(i => typeof i !== 'string' && i.type === 'layer') as SExprNode | undefined;
        const layerName = layerNode ? (layerNode.items[0] as string).replace(/^"(.*)"$/, '$1') : 'Unknown Layer';

        if (!drawingGroups.has(layerName)) {
          drawingGroups.set(layerName, []);
        }
        drawingGroups.get(layerName)?.push(item);
      }

      for (const [layerName, layerItems] of Array.from(drawingGroups.entries()).sort((a, b) => {
        const layerA = a[0].split('.').reverse().join('.'); // F.Cu -> Cu.F
        const layerB = b[0].split('.').reverse().join('.');
        return layerA.localeCompare(layerB);
      })) {
        groups.push({
          groupName: `Drawings on ${layerName}`,
          items: layerItems,
        });
      }

    } else {
      groups.push({
        groupName: GroupTypeNames[groupType],
        items,
      });
    }
  }

  return groups;
}
