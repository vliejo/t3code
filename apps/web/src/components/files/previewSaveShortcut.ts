import type { KeyboardEvent } from "react";

export function isPreviewSaveShortcut(
  event: Pick<
    globalThis.KeyboardEvent,
    "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "key" | "isComposing"
  >,
) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "s" &&
    !event.isComposing
  );
}

export function handlePreviewSaveShortcut(event: KeyboardEvent, save: () => void) {
  if (!isPreviewSaveShortcut(event.nativeEvent)) return;
  event.preventDefault();
  event.stopPropagation();
  save();
}
