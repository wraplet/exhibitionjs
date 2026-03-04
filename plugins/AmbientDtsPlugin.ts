import webpack from "webpack";
import fs from "fs";
import path from "path";

class AmbientDtsPlugin {
  private outputPath: string;
  private dtsDir: string;

  constructor(options: { outputPath: string; dtsDir: string }) {
    this.outputPath = options.outputPath;
    this.dtsDir = options.dtsDir;
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.afterEmit.tapAsync(
      "AmbientDtsPlugin",
      (_compilation, callback) => {
        try {
          const result = this.generate();
          fs.writeFileSync(this.outputPath, result, "utf-8");
          callback();
        } catch (e) {
          callback(e as Error);
        }
      },
    );
  }

  private generate(): string {
    const visited = new Set<string>();
    const lines: string[] = [];

    const allDtsFiles = this.findAllDtsFiles(this.dtsDir);

    for (const file of allDtsFiles) {
      if (visited.has(file)) continue;
      visited.add(file);

      const content = fs.readFileSync(file, "utf-8");
      const processed = this.processFile(content);
      if (processed.trim()) {
        lines.push(processed);
      }
    }

    return lines.join("\n") + "\n";
  }

  private findAllDtsFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.findAllDtsFiles(fullPath));
      } else if (entry.name.endsWith(".d.ts") && entry.name !== "ambient.d.ts") {
        results.push(fullPath);
      }
    }
    return results;
  }

  private removeDeclareGlobalBlocks(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let depth = 0;
    let inDeclareGlobal = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!inDeclareGlobal && /^declare\s+global\s*\{/.test(trimmed)) {
        inDeclareGlobal = true;
        depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        if (depth <= 0) inDeclareGlobal = false;
        continue;
      }
      if (inDeclareGlobal) {
        depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        if (depth <= 0) inDeclareGlobal = false;
        continue;
      }
      result.push(line);
    }
    return result.join("\n");
  }

  private processFile(content: string): string {
    content = this.removeDeclareGlobalBlocks(content);
    return content
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        // Remove import lines
        if (trimmed.startsWith("import ")) return false;
        // Remove pure re-export lines (export { ... } from "..." or export * from "...")
        if (/^export\s+\{[^}]*\}\s+from\s+["']/.test(trimmed)) return false;
        if (/^export\s+\*\s+from\s+["']/.test(trimmed)) return false;
        // Remove "export type { ... } from ..."
        if (/^export\s+type\s+\{[^}]*\}\s+from\s+["']/.test(trimmed))
          return false;
        return true;
      })
      .map((line) => {
        // Remove "export" keyword from declarations
        // "export declare ..." -> "declare ..."
        line = line.replace(/^export\s+declare\s/, "declare ");
        // "export type X = ..." -> "type X = ..."
        line = line.replace(/^export\s+type\s+(\w)/, "type $1");
        // "export interface X" -> "interface X"
        line = line.replace(/^export\s+interface\s/, "interface ");
        // "export enum X" -> "enum X"
        line = line.replace(/^export\s+enum\s/, "enum ");
        // "export abstract class" -> "declare abstract class"
        line = line.replace(/^export\s+abstract\s+class\s/, "declare abstract class ");
        // "export class" -> "declare class"
        line = line.replace(/^export\s+class\s/, "declare class ");
        // "export function" -> "declare function"
        line = line.replace(/^export\s+function\s/, "declare function ");
        // "export const" -> "declare const"
        line = line.replace(/^export\s+const\s/, "declare const ");
        // "export default class" -> "declare class"
        line = line.replace(/^export\s+default\s+class\s/, "declare class ");
        // "export default function" -> "declare function"
        line = line.replace(/^export\s+default\s+function\s/, "declare function ");
        // "export default abstract class" -> "declare abstract class"
        line = line.replace(/^export\s+default\s+abstract\s+class\s/, "declare abstract class ");
        // "export { X }" (local, no "from") -> remove
        line = line.replace(/^export\s+\{[^}]*\}\s*;\s*$/, "");
        return line;
      })
      .filter((line) => line.trim() !== "")
      .join("\n");
  }
}

export default AmbientDtsPlugin;
