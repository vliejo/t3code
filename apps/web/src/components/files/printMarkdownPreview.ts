import { getRenderedAppearance } from "~/hooks/useTheme";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { getSyntaxHighlighterPromise } from "~/lib/syntaxHighlighting";

// The frame leaves out the root's dark class and theme variables, so it prints in the default light palette.
// Paper cannot scroll, so tables drop their scroll area and wrap every cell to fit the page.
const PRINT_STYLES = `
@page { margin: 16mm; }
html, body { height: auto; min-height: 0; overflow: visible; background: #fff; background-image: none; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.chat-markdown { max-width: none; margin: 0; padding: 0; }
.chat-markdown-codeblock, .chat-markdown-mermaid, img, tr { break-inside: avoid; }
:is(h1, h2, h3, h4, h5, h6) { break-after: avoid; }
.chat-markdown-table-container > :first-child,
.chat-markdown-table-container [data-slot="scroll-area-viewport"] { overflow: visible; mask-image: none; }
.chat-markdown-table-container [data-slot="scroll-area-scrollbar"] { display: none; }
.chat-markdown .chat-markdown-table-container table { min-width: 0; }
.chat-markdown .chat-markdown-table-container[data-expanded] :is(th, td) {
  max-width: none; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: break-word;
}
`;

/** Copies a rendered Markdown preview without its controls, with code colored for paper. */
export async function printableMarkdown(
  source: HTMLElement,
  appearance: "light" | "dark",
): Promise<HTMLElement> {
  const content = source.cloneNode(true) as HTMLElement;
  for (const node of content.querySelectorAll("[data-markdown-comments]")) node.remove();
  for (const node of content.querySelectorAll("[data-comment-content]")) {
    node.removeAttribute("class");
  }
  // A rendered diagram sits inside its expand button.
  for (const button of content.querySelectorAll(".chat-markdown-mermaid > button")) {
    button.replaceWith(...button.childNodes);
  }
  // Controls are icon-only; a file chip is a button when it has no primary action.
  for (const button of content.querySelectorAll("button")) {
    if (!button.textContent?.trim()) button.remove();
  }
  // A lazy image outside the hidden frame's viewport would never load.
  for (const image of content.querySelectorAll("img")) image.loading = "eager";
  if (appearance === "dark") {
    await Promise.all(
      Array.from(content.querySelectorAll<HTMLElement>(".chat-markdown-shiki"), highlightForPaper),
    );
  }
  return content;
}

async function highlightForPaper(block: HTMLElement): Promise<void> {
  const language = block.closest("[data-language]")?.getAttribute("data-language") ?? "text";
  const code = block.querySelector("pre")?.textContent ?? "";
  const highlighter = await getSyntaxHighlighterPromise(language);
  const theme = resolveDiffThemeName("light");
  try {
    block.innerHTML = highlighter.codeToHtml(code, { lang: language, theme });
  } catch {
    block.innerHTML = highlighter.codeToHtml(code, { lang: "text", theme });
  }
}

/** Icons reference sprite symbols in the app's document, which the frame does not share. */
function copySpriteSymbols(content: HTMLElement, doc: Document): Element {
  const sprite = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  const ids = new Set(
    Array.from(content.querySelectorAll("use"), (use) => use.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("#"))
      .map((href) => href.slice(1)),
  );
  for (const id of ids) {
    const symbol = document.getElementById(id);
    if (symbol) sprite.append(doc.importNode(symbol, true));
  }
  return sprite;
}

/** Builds a hidden frame holding a print copy of a rendered Markdown preview. */
export async function createMarkdownPrintFrame(
  source: HTMLElement,
  title: string,
): Promise<HTMLIFrameElement> {
  const content = await printableMarkdown(source, getRenderedAppearance());
  const frame = document.createElement("iframe");
  frame.dataset.markdownPrint = "";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Printing is unavailable in this window.");
  }

  // Chromium titles the PDF it writes after the printed frame.
  doc.title = title;
  const base = doc.createElement("base");
  base.href = document.baseURI;
  doc.head.append(base);
  const stylesheetLoads: Promise<void>[] = [];
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const copy = doc.importNode(node, true);
    if (node instanceof HTMLLinkElement) {
      stylesheetLoads.push(
        new Promise((resolve) => {
          copy.addEventListener("load", () => resolve(), { once: true });
          copy.addEventListener("error", () => resolve(), { once: true });
        }),
      );
    }
    doc.head.append(copy);
  }
  const printStyles = doc.createElement("style");
  printStyles.textContent = PRINT_STYLES;
  doc.head.append(printStyles);
  doc.body.append(copySpriteSymbols(content, doc), doc.importNode(content, true));

  await Promise.all(stylesheetLoads);
  // Layout starts the web font loads that fonts.ready waits on.
  void doc.body.offsetHeight;
  await doc.fonts.ready;
  await Promise.all(Array.from(doc.images, (image) => image.decode().catch(() => undefined)));
  return frame;
}

/** Opens the print dialog for a rendered Markdown preview, which can also save it as a PDF. */
export async function printMarkdownPreview(source: HTMLElement, title: string): Promise<void> {
  // Not every browser fires afterprint, so a later print clears an earlier frame.
  document.querySelector("iframe[data-markdown-print]")?.remove();
  const frame = await createMarkdownPrintFrame(source, title);
  const view = frame.contentWindow;
  view?.addEventListener("afterprint", () => frame.remove(), { once: true });
  // Browser print previews suggest a file name from the top-level page, not the frame.
  const appTitle = document.title;
  document.title = title;
  try {
    view?.print();
  } finally {
    document.title = appTitle;
  }
}
