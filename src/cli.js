#!/usr/bin/env node
import {flatcut} from './index.js';

const args = process.argv.slice(2);
const [input, output] = args.filter(a => !a.startsWith('--'));
const tol = Number(args.find(a => a.startsWith('--tolerance='))?.split('=')[1]);

if (!input || !output) {
  console.error(`flatcut — cut the background out of a flat illustration

  flatcut in.png out.png [--tolerance=34] [--no-trim]`);
  process.exit(1);
}

const img = await flatcut(input, {
  tolerance: Number.isFinite(tol) ? tol : undefined,
  trim: !args.includes('--no-trim'),
});
const {width, height} = await img.toFile(output);
console.log(`${output}  ${width}x${height}`);
