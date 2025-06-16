const fs = require('fs');
const ergogen = require('ergogen');

const FOOTPRINT_NAME = 'k2e_generated_footprint';

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error('Usage: node buildpcb.js <input-file> <output-file>');
    process.exit(1);
  }

  try {
    const footprintCode = fs.readFileSync(inputPath, 'utf8');
    // invoke the footprint as a function and get the exported object
    const footprint = new Function('const module = {};\n\n' + footprintCode + '\n\nreturn module.exports;')();

    if (!footprint || typeof footprint !== 'object' || !footprint.params) {
      throw new Error('Invalid footprint format. Expected an object with a params property.');
    }

    const nets = [];
    for ([netName, value] of Object.entries(footprint.params)) {
      if (typeof value === 'object' && value.type === 'net') {
        nets.push(netName);
      }
    }

    ergogen.inject('footprint', FOOTPRINT_NAME, footprint);

    const paramsTemplate = Object.fromEntries(nets.map(net => [net, net]));

    const ergogenConfig = {
      points: {
        zones: {
          m: {
            anchor: { shift: [50, -100] },
            columns: {
              vert: null,
              angle: { key: { adjust: { rotate: 43 } } }
            },
            rows: {
              one: null,
              two: null
            }
          }
        }
      },
      pcbs: {
        testing: {
          template: 'kicad8',
          footprints: {
            one: {
              where: 'm_vert_one',
              what: FOOTPRINT_NAME,
              params: {
                ...paramsTemplate,
                side: 'F',
              }
            },
            two: {
              where: 'm_vert_two',
              what: FOOTPRINT_NAME,
              params: {
                ...paramsTemplate,
                side: 'B',
              }
            },
            three: {
              where: 'm_angle_one',
              what: FOOTPRINT_NAME,
              params: {
                ...paramsTemplate,
                side: 'F',
              }
            },
            four: {
              where: 'm_angle_two',
              what: FOOTPRINT_NAME,
              params: {
                ...paramsTemplate,
                side: 'B',
              }
            }
          }
        }
      }
    };

    const result = await ergogen.process(ergogenConfig);
    const pcbContent = result.pcbs.testing;
    fs.writeFileSync(outputPath, pcbContent, 'utf8');
    console.log(`Generated PCB written to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
