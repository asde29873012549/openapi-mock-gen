import path from "path";
import fs from "fs";

import { format } from "prettier";

import { loadSpec } from "../lib/core/specs";
import {
  extractRelevantFields,
  processApiSpec,
} from "../lib/core/openapi-parser";
import { generateMock } from "../lib/core/mock-generator";
import { autoGroup } from "../lib/core/endpoint-organizor";
import { generateMockDataFileContent } from "../lib/shared/writer";
import type { Config, MockGeneratorInfo } from "../lib/shared/types";
import { executeCode } from "../lib/shared/utils";
import { EXPORT_LANGUAGE } from "../lib/shared/constants";
import { TemplateGenerator } from "../lib/shared/templates";

const fixturesDir = path.resolve(__dirname, "fixtures");
const isESM = true;
const formatCode = (code: string) => format(code, { parser: "babel" });

const getTestDefaultConfig = (specPath: string) => ({
  specPath,
  outputDir: "",
  baseUrl: "",
  arrayLength: 1,
  useExample: true,
  dynamic: true,
  fakerMap: {},
  endpoints: {},
});

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

jest.mock("../lib/shared/prompts", () => ({
  getSpinner: jest.fn(() => ({
    start: jest.fn(() => ({
      info: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    })),
  })),
}));

describe("fixtures", () => {
  fs.readdirSync(fixturesDir).forEach((caseName) => {
    const fixtureDir = path.resolve(fixturesDir, caseName);
    if (!fs.statSync(fixtureDir).isDirectory()) {
      return;
    }

    test(`should generate correct mock for ${caseName}`, async () => {
      const configPath = path.resolve(fixtureDir, "config.cjs");
      const inputPath = path.resolve(fixtureDir, "input.json");
      const outputPath = path.resolve(fixtureDir, "output.js");

      const baseConfig = getTestDefaultConfig(inputPath);

      const config: Config = fs.existsSync(configPath)
        ? { ...baseConfig, ...(await import(configPath)) }
        : baseConfig;

      const document = await loadSpec(config);

      if (!document.paths) {
        throw new Error("No paths found in the loaded OpenAPI spec.");
      }

      const apiInfoByEndpoints = extractRelevantFields(document.paths);
      const groupedEndpoints = autoGroup(apiInfoByEndpoints);
      const selectedEndpoints = Object.values(groupedEndpoints).flat();

      const organizedApiData = processApiSpec(selectedEndpoints, document);

      const generatedOutput = organizedApiData.map((endpoint) => {
        const { path, method, responses } = endpoint;

        const generatedMocks = responses.map((res) => {
          const schema = res.response?.["application/json"];
          const info: MockGeneratorInfo = { schema, config, path, method };

          const mockCode = generateMock(info);

          return config.dynamic ? mockCode : executeCode(mockCode);
        });

        const templateGenerator = new TemplateGenerator(
          EXPORT_LANGUAGE.JS,
          isESM
        );

        return generateMockDataFileContent(
          generatedMocks,
          templateGenerator,
          endpoint,
          EXPORT_LANGUAGE.JS
        );
      });

      const expectedOutput = fs.readFileSync(outputPath, "utf-8");

      const formattedGeneratedOutput = await formatCode(
        generatedOutput.join("\n").trim()
      );
      const formattedExpectedOutput = await formatCode(expectedOutput.trim());

      expect(formattedGeneratedOutput).toEqual(formattedExpectedOutput);
    });
  });
});
