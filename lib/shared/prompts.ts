import Enquirer from 'enquirer';
import ora, { Color, Ora } from 'ora';

import { GroupedEndpoints, ApiInfoByEndpoints, PromptConfig } from './types';
import { EXPORT_LANGUAGE } from './constants';

// @ts-expect-error Enquirer does have a MultiSelect type, but it's not properly exported.
const { MultiSelect, Input, prompt } = Enquirer;

const ALL = 'All';

async function selectApiGroups(groupedEndpoints: GroupedEndpoints): Promise<string[]> {
  const allChoices = Object.keys(groupedEndpoints);
  const multiSelect = new MultiSelect({
    name: 'apiGroups',
    message: 'Select the API groups you want to mock (press space to select, enter to confirm)',
    choices: [ALL, ...allChoices],
    validate(value: string[]) {
      if (value.length === 0) return 'Please select at least one API group.';
      return true;
    },
  });

  return multiSelect.run();
}

async function selectIndividualEndpoints(choices: string[]): Promise<string[]> {
  const multiSelect = new MultiSelect({
    name: 'apiEndpoints',
    message: 'Select the API endpoints you want to mock (press space to select, enter to confirm)',
    initial: [ALL],
    choices: [ALL, ...new Set(choices)],
    validate(value: string[]) {
      if (value.length === 0) return 'Please select at least one API endpoint.';
      return true;
    },
  });
  return multiSelect.run();
}

export async function promptForEndpoints(groupedEndpoints: GroupedEndpoints): Promise<ApiInfoByEndpoints[]> {
  const groupNames = Object.keys(groupedEndpoints);
  let selectedGroups = await selectApiGroups(groupedEndpoints);

  if (selectedGroups.includes(ALL) && selectedGroups.length === 1) {
    selectedGroups = groupNames;
  }

  const availableEndpoints = selectedGroups.flatMap((group) => groupedEndpoints[group] || []);
  const availableEndpointPaths = availableEndpoints.map(
    (endpoint) => `${endpoint.method.toUpperCase()} ${endpoint.path}`
  );

  const selectedEndpointPaths = await selectIndividualEndpoints(availableEndpointPaths);

  if (selectedEndpointPaths.includes(ALL) && selectedEndpointPaths.length === 1) {
    return availableEndpoints;
  }

  return availableEndpoints.filter((endpoint) =>
    selectedEndpointPaths.includes(`${endpoint.method.toUpperCase()} ${endpoint.path}`)
  );
}

export async function inputSpecPath(): Promise<string> {
  const input = new Input({
    name: 'specPath',
    message: 'Please enter the URL or local path to your OpenAPI specification:',
    validate(value: string) {
      if (!value) return 'The spec path cannot be empty.';
      return true;
    },
  });
  return input.run();
}

export async function promptForBaseUrl(): Promise<string> {
  const input = new Input({
    name: 'baseUrl',
    message: 'Please enter the base URL for your API:',
    initial: 'http://localhost:3000',
  });
  return input.run();
}

export async function promptForGlobalConfig(): Promise<PromptConfig> {
  const promtSequence = [
    {
      type: 'confirm',
      name: 'useTypeScript',
      message: 'Do you want to generate files in TypeScript?',
      initial: true,
    },
    {
      type: 'input',
      name: 'arrayLength',
      message: 'Default array length for mock data:',
      initial: '5',
      validate(value: string) {
        if (!value) return 'The array length cannot be empty.';
        if (Number.isNaN(Number(value))) return 'The array length must be a number.';
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'useExample',
      message: 'Use "example" if provided in spec?',
      initial: 'true',
    },
    {
      type: 'confirm',
      name: 'dynamic',
      message: 'Generate dynamic data for each request?',
      initial: 'true',
    },
  ];

  const { useTypeScript, ...rest }: Omit<PromptConfig, 'language'> & { useTypeScript: boolean } =
    await prompt(promtSequence);

  return {
    language: useTypeScript ? EXPORT_LANGUAGE.TS : EXPORT_LANGUAGE.JS,
    ...rest,
  };
}

let spinner: Ora;

export const getSpinner = (text?: string, color?: Color) => {
  if (!spinner) {
    spinner = ora();
  }

  if (text) {
    spinner.text = text;
  }
  if (color) {
    spinner.color = color;
  }

  return spinner;
};
