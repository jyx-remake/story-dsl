export const IDENTIFIER_START_SOURCE = "[a-z_\\u3007\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]";
export const IDENTIFIER_PART_SOURCE = "[a-z0-9_\\u3007\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]";

export const IDENTIFIER_PATTERN = new RegExp(
  `^${IDENTIFIER_START_SOURCE}${IDENTIFIER_PART_SOURCE}*$`,
  "u",
);

const IDENTIFIER_START_CHARACTER_PATTERN = new RegExp(`^${IDENTIFIER_START_SOURCE}$`, "u");
const IDENTIFIER_PART_CHARACTER_PATTERN = new RegExp(`^${IDENTIFIER_PART_SOURCE}$`, "u");

export function isIdentifierStart(character: string): boolean {
  return IDENTIFIER_START_CHARACTER_PATTERN.test(character);
}

export function isIdentifierPart(character: string): boolean {
  return IDENTIFIER_PART_CHARACTER_PATTERN.test(character);
}
