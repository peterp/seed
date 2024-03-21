import { loadConfig } from "c12";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { getRootPath } from "#config/utils.js";
import { adapterConfigSchema } from "./adapterConfig.js";
import { aliasConfigSchema } from "./aliasConfig.js";
import { fingerprintConfigSchema } from "./fingerprintConfig.js";
import { selectConfigSchema } from "./selectConfig.js";

// We place the "seed" config at the root of the config object
const configSchema = z.object({
  alias: aliasConfigSchema.optional(),
  adapter: adapterConfigSchema,
  fingerprint: fingerprintConfigSchema.optional(),
  select: selectConfigSchema.optional(),
  // TODO: add "introspect" config here to enable virtual constraints user defined setup
});

export type SeedConfig = z.infer<typeof configSchema>;

export async function getSeedConfig() {
  const { config } = await loadConfig({
    dotenv: true,
    name: "seed",
  });

  const parsedConfig = configSchema.parse(config ?? {});

  return parsedConfig;
}

export async function getSeedConfigPath() {
  return join(await getRootPath(), "seed.config.ts");
}

export async function seedConfigExists() {
  return existsSync(await getSeedConfigPath());
}

export async function setSeedConfig(template: string) {
  await writeFile(await getSeedConfigPath(), template);
}
