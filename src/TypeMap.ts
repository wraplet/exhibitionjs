import { IsSingleTag, PreviewValue } from "./types/PreviewValue";

export const typeMap = {
  html: {
    languages: ["html"],
    tag: undefined,
  },
  js: {
    languages: ["javascript", "typescript"],
    tag: "script",
  },
  css: {
    languages: ["css"],
    tag: "style",
  },
} as const;

export type TypeFromLanguage<L extends MonacoEditorLanguages> = {
  [K in ValueTypes]: L extends (typeof typeMap)[K]["languages"][number]
    ? K
    : never;
}[ValueTypes];

export type ValueTypes = keyof typeof typeMap;

export type MonacoEditorLanguages =
  (typeof typeMap)[ValueTypes]["languages"][number];

export function getTypeFromLanguage<T extends MonacoEditorLanguages>(
  language: T,
): TypeFromLanguage<T> {
  for (const [key, value] of Object.entries(typeMap)) {
    if (value.languages.includes(language as never)) {
      return key as TypeFromLanguage<T>;
    }
  }

  throw new Error("Unknown language");
}

export function getTagFromType<T extends ValueTypes>(
  type: T,
): (typeof typeMap)[T]["tag"] {
  return typeMap[type].tag;
}

export function isSingleTagType(
  type: ValueTypes,
): type is Extract<PreviewValue, IsSingleTag>["type"] {
  return Boolean(getTagFromType(type));
}
