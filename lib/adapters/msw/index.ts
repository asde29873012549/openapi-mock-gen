import path from 'path';

import type { Config } from '@/lib/shared/types';
import { ADAPTERS } from '@/lib/shared/constants';

import { writeHandlersFile, writeMSWFiles, writeIndexFile, writeMSWTypesFile } from './writers';
import { mswFileNames } from './templates';

export default async function main(config: Config, isESM: boolean) {
  const { outputDir, ...rest } = config;
  const mswConfig = { ...rest, outputDir: path.join(outputDir, ADAPTERS.MSW) };
  const fileNameGenerator = mswFileNames(config.language);

  await writeHandlersFile(mswConfig, fileNameGenerator, isESM);
  await writeMSWFiles(mswConfig, fileNameGenerator, isESM);
  await writeIndexFile(mswConfig, fileNameGenerator, isESM);
  await writeMSWTypesFile(mswConfig, fileNameGenerator, isESM);
}
