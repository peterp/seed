import { type Argv } from "yargs";

export function generateCommand(program: Argv) {
  return program.command(
    "generate",
    "Generates the assets needed by @snaplet/seed",
    (y) =>
      y
        .option("connection-string", {
          alias: "c",
          describe:
            "The connection string to use for introspecting your database",
          type: "string",
        })
        .option("output", {
          alias: "o",
          describe: "A custom directory path to output the generated assets to",
          type: "string",
        }),
    async (_args) => {
      const { generateAssets } = await import("#core/codegen/codegen.js");
      console.log(generateAssets());
    },
  );
}