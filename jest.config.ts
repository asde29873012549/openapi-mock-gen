import { pathToFileURL } from "url";

import { createDefaultPreset, type JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  displayName: "openapi-mock-gen",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  ...createDefaultPreset({
    // see https://www.npmjs.com/package/ts-jest-mock-import-meta for more details
    diagnostics: {
      ignoreCodes: [1343],
    },
    astTransformers: {
      before: [
        {
          path: "ts-jest-mock-import-meta",
          options: {
            metaObjectReplacement: { url: pathToFileURL(__filename).href },
          },
        },
      ],
    },
  }),
};

export default config;
