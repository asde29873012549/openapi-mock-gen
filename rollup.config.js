import path from 'path';
import { fileURLToPath } from 'url';

import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import swc from '@rollup/plugin-swc';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { visualizer } from 'rollup-plugin-visualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = 'lib/index.ts';
const DEFAULT_OUTPUTS = [
  {
    file: 'dist/index.cjs',
    format: 'cjs',
    sourcemap: true,
  },
  {
    file: 'dist/index.mjs',
    format: 'esm',
    sourcemap: true,
  },
];

const defaultPlugins = [
  peerDepsExternal(),
  resolve({ extensions: ['.js', '.jsx', '.ts', '.tsx'] }),
  commonjs(),
  json(),
  alias({
    entries: [{ find: '@', replacement: path.resolve(__dirname, './') }],
  }),
  swc({
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
        dynamicImport: true,
      },
      target: 'es2015',
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
    minify: true,
  }),
  ...(process.env.ANALYZE ? [visualizer({ filename: 'bundle-analysis.html', open: true })] : []),
];

export default DEFAULT_OUTPUTS.map((output) => ({
  input: DEFAULT_INPUT,
  output,
  plugins: defaultPlugins,
  external: [
    /node_modules/,
  ],
}));