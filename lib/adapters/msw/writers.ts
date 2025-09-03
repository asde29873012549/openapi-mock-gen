import fs from 'fs';
import path from 'path';

import pc from 'picocolors';

import { Config, Manifest } from '@/lib/shared/types';
import { writeFileWithPrettify, shouldOverwriteFile } from '@/lib/shared/writer';
import { getSpinner } from '@/lib/shared/prompts';
import { MANIFEST_FILE_NAME } from '@/lib/shared/constants';

import { MswTemplateGenerator, mswFileNames } from './templates';

type FileNames = ReturnType<typeof mswFileNames>;

export async function writeHandlersFile(config: Config, fileNameGenerator: FileNames, isESM: boolean) {
  const { outputDir, language } = config;

  const spinner = getSpinner();
  const manifestFilePath = path.join(outputDir, '..', MANIFEST_FILE_NAME);

  if (!fs.existsSync(manifestFilePath)) {
    throw new Error(`${MANIFEST_FILE_NAME} not found. Please run 'npx openapi-mock-gen init' first.`);
  }

  const manifestContent = fs.readFileSync(manifestFilePath, 'utf8');
  const manifest: Manifest['manifest'] = JSON.parse(manifestContent).manifest;
  const templateGenerator = new MswTemplateGenerator(language, isESM);
  const { getHandlersFileName } = fileNameGenerator;

  const handlersFilePath = path.join(outputDir, getHandlersFileName());

  if (!shouldOverwriteFile(handlersFilePath)) {
    return Promise.resolve();
  }

  await writeFileWithPrettify(handlersFilePath, templateGenerator.generateHandlers(manifest));
  spinner.succeed(pc.bold(`Generated ${getHandlersFileName()} file.`));
}

export async function writeMSWFiles(config: Config, fileNameGenerator: FileNames, isESM: boolean) {
  const { outputDir, language, baseUrl } = config;

  const spinner = getSpinner();
  const { getServerFileName, getBrowserFileName, getUtilsFileName } = fileNameGenerator;
  const templateGenerator = new MswTemplateGenerator(language, isESM);

  const serverFileName = getServerFileName();
  const browserFileName = getBrowserFileName();
  const utilsFileName = getUtilsFileName();

  const serverFilePath = path.join(outputDir, serverFileName);
  const browserFilePath = path.join(outputDir, browserFileName);
  const utilsFilePath = path.join(outputDir, utilsFileName);

  if (shouldOverwriteFile(serverFilePath)) {
    await writeFileWithPrettify(serverFilePath, templateGenerator.generateServer());
  }

  if (shouldOverwriteFile(browserFilePath)) {
    await writeFileWithPrettify(browserFilePath, templateGenerator.generateBrowser());
  }

  if (shouldOverwriteFile(utilsFilePath)) {
    await writeFileWithPrettify(utilsFilePath, templateGenerator.generateUtils(baseUrl));
  }

  if (shouldOverwriteFile(utilsFilePath)) {
    await writeFileWithPrettify(utilsFilePath, templateGenerator.generateUtils(baseUrl));
  }

  spinner.succeed(pc.bold(`Generated ${serverFileName}, ${browserFileName}, and ${utilsFileName} files.`));
}

export async function writeIndexFile(config: Config, fileNameGenerator: FileNames, isESM: boolean) {
  const { outputDir, language } = config;

  const { getIndexFileName } = fileNameGenerator;
  const templateGenerator = new MswTemplateGenerator(language, isESM);

  const indexFilePath = path.join(outputDir, getIndexFileName());

  if (!shouldOverwriteFile(indexFilePath)) {
    return Promise.resolve();
  }

  return writeFileWithPrettify(indexFilePath, templateGenerator.generateIndex());
}

export async function writeMSWTypesFile(config: Config, fileNameGenerator: FileNames, isESM: boolean) {
  const { outputDir, language } = config;

  const { getTypesFileName } = fileNameGenerator;
  const templateGenerator = new MswTemplateGenerator(language, isESM);

  const typesFilePath = path.join(outputDir, getTypesFileName());

  if (!shouldOverwriteFile(typesFilePath)) {
    return Promise.resolve();
  }

  return writeFileWithPrettify(typesFilePath, templateGenerator.generateTypes());
}
