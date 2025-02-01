import { describe, test, expect } from 'vitest';
import { parseKiCadSexp, tokenize } from './parser';

describe('KiCad S-Expression Parser', () => {
  describe('Tokenizer', () => {
    test('should handle basic tokenization', () => {
      const input = '(hello world)';
      const result = tokenize(input);
      expect(result).toEqual(['(', 'hello', 'world', ')']);
    });

    test('should handle strings with spaces', () => {
      const input = '(name "John Doe")';
      const result = tokenize(input);
      expect(result).toEqual(['(', 'name', '"John Doe"', ')']);
    });

    test('should skip comments', () => {
      const input = `
        ; This is a comment
        (component ; Inline comment
          "value" ; Another comment
        )
      `;
      const result = tokenize(input);
      expect(result).toEqual(['(', 'component', '"value"', ')']);
    });

    test('should handle nested structures', () => {
      const input = '(a (b c) (d (e f)))';
      const result = tokenize(input);
      expect(result).toEqual(['(', 'a', '(', 'b', 'c', ')', '(', 'd', '(', 'e', 'f', ')', ')', ')']);
    });

    test('should handle escaped quotes in strings', () => {
      const input = '(msg "He said \\"Hello\\"")';
      const result = tokenize(input);
      expect(result).toEqual(['(', 'msg', '"He said \\"Hello\\""', ')']);
    });
  });

  describe('Parser', () => {
    test('should parse simple expression', () => {
      const input = '(root a b c)';
      const ast = parseKiCadSexp(input);
      expect(ast).toEqual({
        type: 'root',
        items: ['a', 'b', 'c']
      });
    });

    test('should parse nested structures', () => {
      const input = '(a (b c) (d (e f)))';
      const ast = parseKiCadSexp(input);
      expect(ast).toEqual({
        type: 'a',
        items: [
          {
            type: 'b',
            items: ['c']
          },
          {
            type: 'd',
            items: [
              {
                type: 'e',
                items: ['f']
              }
            ]
          }
        ]
      });
    });

    test('should handle mixed node types', () => {
      const input = '(parent "child1" (child2 "value") 42)';
      const ast = parseKiCadSexp(input);
      expect(ast).toEqual({
        type: 'parent',
        items: [
          '"child1"',
          {
            type: 'child2',
            items: ['"value"']
          },
          '42'
        ]
      });
    });

    test('should parse basic footprint', () => {
      const input = `
        (footprint "R_0805"
          (layer F.Cu)
          (at 1 2)
          (pad "1" smd (rect (at 0 0) (size 1.6 0.8)))
        )
      `;

      const ast = parseKiCadSexp(input);

      expect(ast).toEqual({
        type: 'footprint',
        items: [
          '"R_0805"',
          {
            type: 'layer',
            items: ['F.Cu']
          },
          {
            type: 'at',
            items: ['1', '2']
          },
          {
            type: 'pad',
            items: [
              '"1"',
              'smd',
              {
                type: 'rect',
                items: [
                  {
                    type: 'at',
                    items: ['0', '0']
                  },
                  {
                    type: 'size',
                    items: ['1.6', '0.8']
                  }
                ]
              }
            ]
          }
        ]
      });
    });

    test('should throw error for mismatched parentheses', () => {
      const input = '(open (nested)';
      expect(() => parseKiCadSexp(input)).toThrow("Expected ')'");
    });

    test('should throw error for unexpected format', () => {
      const input = ')missing open(';
      expect(() => parseKiCadSexp(input)).toThrow("Expected '('");
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty node', () => {
      const input = '()';
      expect(() => parseKiCadSexp(input)).toThrow();
    });

    test('should handle node with only type', () => {
      const input = '(type)';
      const ast = parseKiCadSexp(input);
      expect(ast).toEqual({
        type: 'type',
        items: []
      });
    });

    test('should handle numbers and symbols', () => {
      const input = '(data 42 3.14 +5 -0.1 _sym@)';
      const ast = parseKiCadSexp(input);
      expect(ast.items).toEqual(['42', '3.14', '+5', '-0.1', '_sym@']);
    });
  });

  describe('Manual Tests', () => {
    test.skipIf(false)('parsing file', () => {
      const path = '/home/genteure/maker/keyboard/swoop/pcbs/swoop-mx/swoop-mx.kicad_pcb';
      const fs = require('fs');
      const input = fs.readFileSync(path, 'utf-8');
      const ast = parseKiCadSexp(input);
      expect(ast).toBeDefined();
      console.log(ast);
    });
  });
});
