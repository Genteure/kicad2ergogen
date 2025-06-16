import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as parser from './parser';
import converter from './ergogenWriterNext';
import { spawn } from 'node:child_process';

const PATH_VERIFY_PY = join(__dirname, '../../test/bin/verify.py');
const PATH_BUILDPCB_CJS = join(__dirname, '../../test/bin/buildpcb.cjs');

const PATH_CASES = join(__dirname, '../../test/cases');

describe.sequential('Ergogen Footprint Rotation & Flip', async () => {

  let tempDir = '';
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'k2e-test-'));
    console.log(`Temporary directory created at: ${tempDir}`);
  });
  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
    console.log(`Temporary directory removed: ${tempDir}`);
  });

  // Load test cases from disk
  const caseFilePaths = (await readdir(PATH_CASES)).filter(f => f.endsWith('.kicad_mod'));
  const cases: { name: string, footprint: string }[] = await Promise.all(caseFilePaths.map(async (fname) => {
    const content = await readFile(join(PATH_CASES, fname), 'utf8');
    return {
      name: fname.replace(/\.kicad_mod$/, ''),
      footprint: content,
    };
  }));

  test.for(cases)(
    'Testing $name',
    async ({ name, footprint }, { expect }) => {
      const PATH_Footprint = join(tempDir, `${name}.js`);
      const PATH_PCB = join(tempDir, `${name}.kicad_pcb`);

      const ast = parser.parseKiCadSexp(footprint);
      const output = converter(ast, {});

      console.log(`Writing footprint to ${PATH_Footprint}`);
      await writeFile(PATH_Footprint, output.ergogenCode, { encoding: 'utf8' });

      // Build PCB using the generated footprint
      await new Promise((resolve, reject) => {
        const proc = spawn('node', [PATH_BUILDPCB_CJS, PATH_Footprint, PATH_PCB], { stdio: 'inherit' });
        proc.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`buildpcb.cjs exited with code ${code}`));
        });
        proc.on('error', reject);
      });

      // Verify the PCB using the Python script
      await new Promise((resolve, reject) => {
        const proc = spawn('python', [PATH_VERIFY_PY, PATH_PCB], { stdio: 'inherit' });
        proc.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`verify.py exited with code ${code}`));
        });
        proc.on('error', reject);
      });
    }
  );
});
