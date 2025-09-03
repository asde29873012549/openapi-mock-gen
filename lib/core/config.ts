import fs from 'fs';
import path from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';

import { DEFAULT_CONFIG, CONFIG_FILE_NAME, JS_EXTENSION, TS_EXTENSION } from '@/lib/shared/constants';
import type { Config, InitCLIOptions } from '@/lib/shared/types';
import { TemplateGenerator } from '@/lib/shared/templates';
import { getIsESM, fileNames } from '@/lib/shared/utils';
import { writeFileWithPrettify } from '@/lib/shared/writer';
import { inputSpecPath, promptForBaseUrl, promptForGlobalConfig, getSpinner } from '@/lib/shared/prompts';

const jiti = createJiti(import.meta.url);

export async function loadConfigFromFile(): Promise<Config> {
  const spinner = getSpinner();
  spinner.info(pc.bold('Loading config file...'));

  const tsConfigPath = path.join(process.cwd(), CONFIG_FILE_NAME + TS_EXTENSION);
  const jsConfigPath = path.join(process.cwd(), CONFIG_FILE_NAME + JS_EXTENSION);

  let configPath = '';

  try {
    if (fs.existsSync(tsConfigPath)) {
      configPath = tsConfigPath;
    } else if (fs.existsSync(jsConfigPath)) {
      configPath = jsConfigPath;
    } else {
      throw new Error(
        `Config file not found at root directory, please run "openapi-mock-gen init" to create a new config file.`
      );
    }

    const configModule: Config = await jiti.import(configPath, { default: true });

    return {
      ...DEFAULT_CONFIG,
      ...(configModule ?? {}),
    };
  } catch (error) {
    spinner.fail(`Error loading config file at ${configPath}`);
    throw error;
  }
}

export async function initializeConfig(cliOptions: InitCLIOptions): Promise<Config> {
  const spinner = getSpinner();

  const specPath = cliOptions.specPath ?? (await inputSpecPath());
  const baseUrl = cliOptions.baseUrl ?? (await promptForBaseUrl());
  const outputDir = cliOptions.outputDir ?? DEFAULT_CONFIG.outputDir;

  spinner.succeed(pc.bold('Prompting for a new config…'));

  const { language, ...rest } = await promptForGlobalConfig();
  const config = { language, specPath, baseUrl, outputDir, ...rest };

  const isESM = await getIsESM();
  const templateGenerator = new TemplateGenerator(language, isESM);

  const configFileName = fileNames(language).getConfigFileName();
  const configPath = path.join(process.cwd(), configFileName);

  const configContent = templateGenerator.generateConfig(config);
  await writeFileWithPrettify(configPath, configContent);
  spinner.succeed(pc.bold(`${configFileName} generated successfully.`));

  return {
    ...config,
    fakerMap: {},
    endpoints: {},
  };
}
