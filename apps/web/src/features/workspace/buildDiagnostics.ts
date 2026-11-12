import type { LocalProjectResult } from "../../api";

export type EditorDiagnostic = {
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
  severity: "error" | "warning";
};

const DIAGNOSTIC_SOURCE_EXTENSIONS =
  "(?:tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|java|c|cc|cpp|h|hpp|css|json|html)";

export function normalizeDiagnosticPath(value: string) {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .toLowerCase();
}

export function parseBuildDiagnostics(result: LocalProjectResult | null) {
  if (!result) return [];
  const diagnostics: EditorDiagnostic[] = [];
  const seen = new Set<string>();
  const patterns = [
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS})\\((\\d+),(\\d+)\\):\\s*(error|warning)(?:\\s+TS\\d+)?:\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS}):(\\d+):(\\d+):\\s*(error|warning):\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS}):(\\d+):\\s*(error|warning):\\s*(.+)$`,
      "i",
    ),
    new RegExp(
      `^(.+?\\.${DIAGNOSTIC_SOURCE_EXTENSIONS})\\s+(\\d+):(\\d+)\\s+(error|warning)\\s+(.+)$`,
      "i",
    ),
  ];

  for (const stage of result.stages) {
    if (stage.code === 0) continue;
    const output = `${stage.stdout}\n${stage.stderr}`.replace(
      /\u001b\[[0-9;]*m/g,
      "",
    );
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      let diagnostic: EditorDiagnostic | null = null;
      const unresolvedImport = line.match(
        /Could not resolve import ["']([^"']+)["'] from ["']([^"']+)["']/i,
      );
      if (unresolvedImport) {
        diagnostic = {
          file: unresolvedImport[2],
          line: null,
          column: null,
          message: `Cannot resolve import "${unresolvedImport[1]}".`,
          severity: "error",
        };
      } else {
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (!match) continue;
          const hasColumn = pattern !== patterns[2];
          const severityGroup = hasColumn ? 4 : 3;
          diagnostic = {
            file: match[1],
            line: Number(match[2]),
            column: hasColumn ? Number(match[3]) : null,
            severity: match[severityGroup].toLowerCase() as "error" | "warning",
            message: match[severityGroup + 1],
          };
          break;
        }
      }
      if (
        !diagnostic &&
        /\b(error|failed to compile|build failed)\b/i.test(line)
      ) {
        diagnostic = {
          file: null,
          line: null,
          column: null,
          severity: "error",
          message: line.slice(0, 500),
        };
      }
      if (!diagnostic) continue;
      const key = `${diagnostic.file ?? ""}:${diagnostic.line ?? ""}:${diagnostic.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics.slice(0, 100);
}
