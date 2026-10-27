import { describe, expect, it } from "vite-plus/test";
import { replaceMermaidFence } from "./markdownMermaidEditing";

describe("replaceMermaidFence", () => {
  it("changes only the selected fence, retaining metadata and surrounding prose", () => {
    const fence = "```mermaid title=Flow\ngraph TD\nA --> B\n```";
    const source = `Before\n\n${fence}\n\n${fence}\nAfter`;
    expect(replaceMermaidFence(source, 8, 8 + fence.length, "graph LR\nB --> C")).toBe(
      `Before\n\n\`\`\`mermaid title=Flow\ngraph LR\nB --> C\n\`\`\`\n\n${fence}\nAfter`,
    );
  });
  it("preserves CRLF and indentation", () => {
    const source = "  ~~~mermaid\r\n  graph TD\r\n  ~~~\r\n";
    expect(replaceMermaidFence(source, 2, source.length - 2, "graph LR\nA --> B\n")).toBe(
      "  ~~~mermaid\r\n  graph LR\r\n  A --> B\r\n  ~~~\r\n",
    );
  });
  it("lengthens fences so pasted delimiters cannot terminate the block", () => {
    const source = "```mermaid\ngraph TD\n```";
    expect(replaceMermaidFence(source, 0, source.length, "graph TD\n```\ntext")).toBe(
      "````mermaid\ngraph TD\n```\ntext\n````",
    );
  });
  it("refuses incomplete fences and unsupported nested prefixes", () => {
    expect(replaceMermaidFence("```mermaid\ngraph TD", 0, 19, "new")).toBeNull();
    const source = "> ```mermaid\n> graph TD\n> ```";
    expect(replaceMermaidFence(source, 2, source.length, "new")).toBeNull();
  });
});
