import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compileScript, parseStory } = require("../packages/core/dist/index.js");

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument || !outputArgument) {
  console.error("用法: node scripts/compile-story-ir.mjs <input.story> <output.story.json>");
  process.exit(1);
}

const inputPath = path.resolve(inputArgument);
const outputPath = path.resolve(outputArgument);
const source = await fs.readFile(inputPath, "utf8");
const parsed = parseStory(source);
const compiled = compileScript(parsed.ast);
const errors = [...parsed.diagnostics, ...compiled.diagnostics]
  .filter((item) => item.severity === "error" && item.code !== "unreachable");
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${error.span.start.line}:${error.span.start.column} ${error.message}`);
  }
  process.exit(2);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
// IR is a reproducible build artifact.  Rebuild it when the source story or
// compiler changes instead of silently leaving a stale file in place.
await fs.writeFile(outputPath, `${JSON.stringify(compiled.ir, null, 2)}\n`, { encoding: "utf8", flag: "w" });
console.log(`${inputPath} -> ${outputPath}`);
