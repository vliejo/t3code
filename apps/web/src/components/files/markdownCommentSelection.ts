type MarkdownNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: { start: { line: number }; end: { line: number } };
  children?: MarkdownNode[];
};

// Wrap whole blocks so custom renderers (code fences, alerts, tables) retain
// their source anchor even when they replace the original element.
export function rehypeCommentBlocks() {
  return (tree: MarkdownNode) => {
    if (!tree.children) return;
    tree.children = tree.children.map((node) =>
      node.type === "element" && node.position
        ? {
            type: "element",
            tagName: "div",
            properties: {
              "data-comment-start": node.position.start.line,
              "data-comment-end": node.position.end.line,
            },
            children: [node],
          }
        : node,
    );
  };
}

export function markdownCommentSelection(root: HTMLElement, selection: Selection | null) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-comment-start]")).filter(
    (block) => range.intersectsNode(block),
  );
  const first = blocks[0];
  const last = blocks.at(-1);
  if (!first || !last || !selection.toString().trim()) return null;
  return {
    startLine: Number(first.dataset.commentStart),
    endLine: Number(last.dataset.commentEnd),
  };
}
