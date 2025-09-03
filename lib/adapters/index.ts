import pc from 'picocolors';

import type { Adapter, Config } from '@/lib/shared/types';
import { getSpinner } from '@/lib/shared/prompts';

import msw from './msw';

export const adapters = {
  msw,
};

export default async function getAdapter(adapter: Adapter): Promise<(config: Config, isESM: boolean) => Promise<void>> {
  const spinner = getSpinner();

  if (!adapter || !Object.keys(adapters).includes(adapter)) {
    throw new Error(`Adapter ${adapter} not found`);
  }

  spinner.succeed(pc.bold(`Generating files for ${adapter}...`));

  return adapters[adapter];
}
