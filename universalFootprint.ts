import { readFileSync } from 'fs';
import { parseKiCadSexp } from './src/scripts/parser';
import { ErgogenFootprintWriter, type ErgogenFootprintWriterConfig } from './src/scripts/ergogenWriter';

export default function generateErgogenFootprint(path: string, config: ErgogenFootprintWriterConfig): ({ params: any, body: any }) {
  const ast = parseKiCadSexp(readFileSync(path, 'utf8'));
  const rawcode = new ErgogenFootprintWriter(config).write(ast);
  const m = {} as any;
  new Function('module', rawcode)(m);
  return m.exports;
}

// NOTE: not working
