import { describe, expect, it } from "vite-plus/test";
import { unified } from "unified";
import remarkParse from "remark-parse";

import { applyMarkdownPreviewTextEdits, rehypeEditablePreviewText } from "./markdownPreviewEditing";

describe("preview text edits", () => {
  it("preserves formatting, link destinations, line endings and untouched blocks", () => {
    const source =
      "# Title\r\n\r\nA **bold** [label](./target.md).\r\n\r\n```ts\r\nconst x = 1;\r\n```\r\n";
    const result = applyMarkdownPreviewTextEdits(source, [
      { start: source.indexOf("bold"), end: source.indexOf("bold") + 4, text: "longer words" },
      { start: source.indexOf("label"), end: source.indexOf("label") + 5, text: "short" },
    ]);
    expect(result).toBe(
      "# Title\r\n\r\nA **longer words** [short](./target.md).\r\n\r\n```ts\r\nconst x = 1;\r\n```\r\n",
    );
  });

  it("treats inserted Markdown and HTML punctuation as literal text", () => {
    const text = "**literal** <img src=x> & [link](url)";
    const result = applyMarkdownPreviewTextEdits("original", [{ start: 0, end: 8, text }]);
    const tree = unified().use(remarkParse).parse(result);
    expect(tree.children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: text }] },
    ]);
  });

  it("removes empty inline formatting and links without leaving visible delimiters", () => {
    const source = "A **_bold_** [label](./target.md).";
    expect(
      applyMarkdownPreviewTextEdits(source, [
        { start: source.indexOf("bold"), end: source.indexOf("bold") + 4, text: "" },
        { start: source.indexOf("label"), end: source.indexOf("label") + 5, text: "" },
      ]),
    ).toBe("A  .");
  });

  it("keeps pasted newlines inside the edited table cell", () => {
    expect(
      applyMarkdownPreviewTextEdits("| old | other |", [{ start: 2, end: 5, text: "a\nb" }]),
    ).toBe("| a&#10;b | other |");
  });

  it("supports deleting text and rejects invalid or overlapping ranges", () => {
    expect(applyMarkdownPreviewTextEdits("before after", [{ start: 0, end: 7, text: "" }])).toBe(
      "after",
    );
    expect(() => applyMarkdownPreviewTextEdits("abc", [{ start: 0, end: 4, text: "x" }])).toThrow();
    expect(() =>
      applyMarkdownPreviewTextEdits("abc", [
        { start: 0, end: 2, text: "x" },
        { start: 1, end: 3, text: "y" },
      ]),
    ).toThrow();
  });

  it("leaves code fences and inline code out of text editing", () => {
    const code = {
      type: "element",
      tagName: "code",
      children: [
        {
          type: "text",
          value: "const x = 1",
          position: { start: { offset: 3 }, end: { offset: 14 } },
        },
      ],
    };
    const tree = { type: "root", children: [code] };
    rehypeEditablePreviewText()(tree);
    expect(tree.children[0]).toBe(code);
    expect(code.children[0]?.type).toBe("text");
  });
});
