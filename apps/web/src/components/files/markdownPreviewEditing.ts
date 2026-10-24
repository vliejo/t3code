import type { RootContent } from "mdast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";

interface MarkdownNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
}

export interface MarkdownPreviewTextEdit {
  start: number;
  end: number;
  text: string;
}

export function rehypeEditablePreviewText() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children || node.tagName === "pre" || node.tagName === "code") return;
      node.children = node.children.map((child) => {
        const start = child.position?.start.offset;
        const end = child.position?.end.offset;
        if (child.type === "text" && start !== undefined && end !== undefined) {
          return {
            type: "element",
            tagName: "span",
            properties: {
              "data-edit-start": start,
              "data-edit-end": end,
            },
            children: [child],
          };
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
  };
}

export function applyMarkdownPreviewTextEdits(
  source: string,
  edits: readonly MarkdownPreviewTextEdit[],
) {
  const tree = edits.some((edit) => edit.text === "")
    ? unified().use(remarkParse).use(remarkGfm).parse(source)
    : null;
  const replacements = edits.map((edit) => {
    if (edit.text || !tree) return edit;
    let range = edit;
    const visit = (node: RootContent): boolean => {
      if (node.type === "text")
        return node.position?.start.offset === edit.start && node.position.end.offset === edit.end;
      if (!("children" in node)) return false;
      const matches = node.children.map(visit);
      if (
        matches.length === 1 &&
        matches[0] &&
        ["strong", "emphasis", "delete", "link", "linkReference"].includes(node.type)
      ) {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (start !== undefined && end !== undefined) range = { ...edit, start, end };
        return true;
      }
      return false;
    };
    tree.children.forEach(visit);
    return range;
  });
  let result = source;
  let boundary = source.length;
  for (const edit of replacements.sort((a, b) => b.start - a.start)) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > boundary) {
      throw new Error("Markdown text edits overlap or fall outside the source.");
    }
    // Entities keep typed punctuation literal in Markdown and embedded HTML.
    // Only the edited text changes; delimiters, link targets and other blocks stay byte-for-byte intact.
    const text = edit.text.replace(
      /[!-/:-@[-`{-~\r\n]/g,
      (character) => `&#${character.charCodeAt(0)};`,
    );
    result = result.slice(0, edit.start) + text + result.slice(edit.end);
    boundary = edit.start;
  }
  return result;
}
