import cac from 'cac';

import { main } from './main';
import { initializeConfig } from './core/config';
import { GenerateCLIOptions, InitCLIOptions, Adapter } from './shared/types';

const cli = cac('openapi-mock-gen');

cli
  .command('init', 'Initialize the mock config file.')
  .option('-p, --specPath <specPath>', `Path to the OpenAPI spec file.`)
  .option('-o, --outputDir <directory>', `Output to a folder.`)
  .option('-b, --baseUrl <baseUrl>', `Base URL for the mock server.`)
  .option('-t, --typescript', `Should generate files in ts.`)
  .example('openapi-mock-gen init -o ./.mocks')
  .action(async (options: InitCLIOptions) => {
    await initializeConfig(options);
  });

cli
  .command('[adapter]', 'Generating msw mock definitions with random fake data.')
  .option('-c, --clean', `Generate brand new mock data and remove all existing mocked data and manifest file.`)
  .action(async (adapterName: Adapter, options: GenerateCLIOptions) => {
    await main(adapterName, options);
  });

cli.help();
cli.parse();
