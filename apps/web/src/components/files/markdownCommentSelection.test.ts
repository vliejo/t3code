import { describe, expect, it } from "vite-plus/test";

import { buildFileReviewComment } from "~/reviewCommentContext";
import { rehypeCommentBlocks } from "./markdownCommentSelection";

describe("Markdown comment source anchors", () => {
  it("sends original Markdown for selections in formatted prose and code fences", () => {
    const contents =
      "# Heading\n\nA **bold**\nparagraph with\na [link](https://example.com).\n\n```ts\nconst x = 1;\nx;\n```";
    const tree: Parameters<ReturnType<typeof rehypeCommentBlocks>>[0] = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          position: { start: { line: 3 }, end: { line: 5 } },
          children: [{ type: "element", tagName: "strong" }],
        },
        {
          type: "element",
          tagName: "pre",
          position: { start: { line: 7 }, end: { line: 10 } },
          children: [{ type: "element", tagName: "code" }],
        },
      ],
    };
    rehypeCommentBlocks()(tree);
    const comments = tree.children?.map((block) =>
      buildFileReviewComment({
        id: "comment",
        filePath: "README.md",
        startLine: Number(block.properties?.["data-comment-start"]),
        endLine: Number(block.properties?.["data-comment-end"]),
        contents,
        text: "Please clarify",
      }),
    );
    expect(comments?.map(({ rangeLabel, diff }) => ({ rangeLabel, diff }))).toEqual([
      {
        rangeLabel: "L3 to L5",
        diff: "A **bold**\nparagraph with\na [link](https://example.com).",
      },
      { rangeLabel: "L7 to L10", diff: "```ts\nconst x = 1;\nx;\n```" },
    ]);
  });

  it("does not invent source positions for generated elements or whitespace", () => {
    const children = [
      { type: "text", value: "\n" },
      { type: "element", tagName: "div" },
    ];
    const tree = { type: "root", children };
    rehypeCommentBlocks()(tree);
    expect(tree.children).toEqual(children);
  });
});
