export function replaceMermaidFence(
  source: string,
  start: number,
  end: number,
  code: string,
): string | null {
  if (start < 0 || end > source.length || end <= start) return null;
  const prefix = source.slice(source.lastIndexOf("\n", start - 1) + 1, start);
  // Nested list and quote prefixes need their own Markdown continuation rules.
  if (!/^ {0,3}$/.test(prefix)) return null;
  const block = source.slice(start, end);
  const opening = /^(`{3,}|~{3,})(mermaid[^\r\n]*)(\r?\n)/.exec(block);
  if (!opening) return null;
  const marker = opening[1]!;
  const newline = opening[3]!;
  const closingStart = block.lastIndexOf("\n") + 1;
  const closing = block.slice(closingStart);
  const closingMatch = /^( {0,3})(`{3,}|~{3,})([ \t]*)$/.exec(closing);
  if (!closingMatch || closingMatch[2]![0] !== marker[0] || closingMatch[2]!.length < marker.length)
    return null;
  const normalized = code.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const runs = normalized.match(marker[0] === "`" ? /`+/g : /~+/g) ?? [];
  const fence = marker[0]!.repeat(Math.max(marker.length, ...runs.map((run) => run.length + 1)));
  const body = normalized
    .split("\n")
    .map((line) => prefix + line)
    .join(newline);
  return (
    source.slice(0, start) +
    fence +
    opening[2] +
    newline +
    body +
    newline +
    closingMatch[1] +
    (fence.length > marker.length ? fence : closingMatch[2]) +
    closingMatch[3] +
    source.slice(end)
  );
}
