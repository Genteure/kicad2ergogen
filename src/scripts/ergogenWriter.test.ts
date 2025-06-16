import { describe, test, expect } from 'vitest';
import * as parser from './parser';
import { ErgogenFootprintWriter } from './ergogenWriter';

describe('Ergogen Footprint Writer', () => {
  describe('Footprint', () => {
    test('should write basic footprint', () => {
      const ast = parser.parseKiCadSexp(`
(footprint "TestFootprint")
      `);

      const writer = new ErgogenFootprintWriter();
      const output = writer.write(ast);
      // console.log(output);
    });
  });
});
