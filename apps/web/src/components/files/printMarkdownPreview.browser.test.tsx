import { Suspense } from "react";
import { expect, it, vi } from "vite-plus/test";

import "~/index.css";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { render } from "../../../test/render";

import { MarkdownCodeBlock, SuspenseShikiCodeBlock } from "../chat/MarkdownCodeBlock";
import { createMarkdownPrintFrame, printableMarkdown } from "./printMarkdownPreview";

it("prints a dark preview's diagrams, file links and code for paper, without its controls", async () => {
  const code = "const answer = 42;";
  // oxlint-disable-next-line shadcn/no-unknown-classes -- A Markdown fence class, not a style.
  const fence = "language-ts";
  await using screen = await render(
    <div>
      <div>
        <button type="button" aria-label="Add comment on line 1">
          <svg aria-hidden="true" />
        </button>
        <div data-comment-content className="bg-primary/10">
          <p>
            Vocabulary in{" "}
            <button type="button" aria-label="File options for glossary.md">
              glossary.md
            </button>
          </p>
        </div>
        <div data-markdown-comments>Reviewer note</div>
      </div>
      <div className="chat-markdown-mermaid">
        <button type="button" aria-label="Expand diagram">
          <span>
            <svg role="img" aria-label="Flow" />
          </span>
        </button>
      </div>
      <MarkdownCodeBlock
        code={code}
        language="ts"
        fenceTitle={null}
        theme="dark"
        isStreaming={false}
      >
        <Suspense>
          <SuspenseShikiCodeBlock
            className={fence}
            code={code}
            themeName={resolveDiffThemeName("dark")}
            isStreaming={false}
          />
        </Suspense>
      </MarkdownCodeBlock>
      <img alt="Chart" loading="lazy" />
    </div>,
  );
  await vi.waitFor(() =>
    expect(screen.container.querySelector(".chat-markdown-shiki pre")).not.toBeNull(),
  );

  const printed = await printableMarkdown(screen.container, "dark");

  expect(Array.from(printed.querySelectorAll("button"), (button) => button.textContent)).toEqual([
    "glossary.md",
  ]);
  expect(printed.textContent).not.toContain("Reviewer note");
  expect(printed.querySelector("[data-comment-content]")?.hasAttribute("class")).toBe(false);
  expect(printed.querySelector(".chat-markdown-mermaid svg")?.getAttribute("aria-label")).toBe(
    "Flow",
  );
  expect(printed.querySelector("img")?.loading).toBe("eager");
  await using lightPreview = await render(
    <Suspense>
      <SuspenseShikiCodeBlock
        className={fence}
        code={code}
        themeName={resolveDiffThemeName("light")}
        isStreaming={false}
      />
    </Suspense>,
  );
  await vi.waitFor(() => expect(lightPreview.container.querySelector("pre")).not.toBeNull());
  expect(printed.querySelector(".chat-markdown-shiki pre")?.outerHTML).toBe(
    lightPreview.container.querySelector("pre")?.outerHTML,
  );
});

it("titles the print frame and gives it the sprite symbols its icons draw", async () => {
  await using screen = await render(
    <div>
      <svg aria-hidden="true">
        <symbol id="print-test-markdown-icon" viewBox="0 0 16 16">
          <path d="M0 0h16v16H0z" />
        </symbol>
      </svg>
      <p>
        <svg aria-hidden="true">
          <use href="#print-test-markdown-icon" />
        </svg>
        glossary.md
      </p>
    </div>,
  );
  const frame = await createMarkdownPrintFrame(screen.container.querySelector("p")!, "glossary");
  using _frame = { [Symbol.dispose]: () => frame.remove() };

  expect(frame.contentDocument?.title).toBe("glossary");
  expect(frame.contentDocument?.getElementById("print-test-markdown-icon")?.tagName).toBe("symbol");
});
