import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compileScript, convertXmlToStory, parseStory } = require("../packages/core/dist/index.js");

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument || inputArgument === "--help" || inputArgument === "-h") {
  console.log("用法: npm run convert:xml -- <input.xml> [output.story]");
  console.log("未指定输出时写入 <input>.converted.story；指定输出路径时会覆盖已有生成文件。");
  process.exit(inputArgument ? 0 : 1);
}

const inputPath = path.resolve(inputArgument);
const outputPath = outputArgument
  ? path.resolve(outputArgument)
  : await nextAvailableOutput(inputPath);
const xml = await fs.readFile(inputPath, "utf8");
const story = convertXmlToStory(xml);
const parsed = parseStory(story);
const compiled = compileScript(parsed.ast);
// The legacy XML frequently places result entries after an unconditional jump.
// The compiler reports those as `unreachable` errors because they are useful
// during authoring, but conversion can safely omit those IR nodes and retain
// the reachable path. Other parser/compiler errors still block the write.
const errors = [...parsed.diagnostics, ...compiled.diagnostics]
  .filter((item) => item.severity === "error" && item.code !== "unreachable");

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${error.span.start.line}:${error.span.start.column} ${error.message}`);
  }
  throw new Error("转换结果未通过 Story v3 parser/compiler，未写入文件。");
}

// Conversion outputs are reproducible build artifacts.  Overwrite an
// explicitly requested output so fixes to the converter and source updates
// cannot be masked by a stale file from an earlier run.
await fs.writeFile(outputPath, story, { encoding: "utf8", flag: "w" });
console.log(`${inputPath} -> ${outputPath}`);

async function nextAvailableOutput(input) {
  const parsed = path.parse(input);
  const first = path.join(parsed.dir, `${parsed.name}.converted.story`);
  if (!(await exists(first))) return first;

  for (let index = 2; ; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}.converted-${index}.story`);
    if (!(await exists(candidate))) return candidate;
  }
}

async function exists(filename) {
  try {
    await fs.access(filename);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}
