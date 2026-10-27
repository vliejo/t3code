import { createContext, use, useRef, useState } from "react";
import type { Components } from "react-markdown";
import type { ScopedThreadRef } from "@t3tools/contracts";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Button } from "~/components/ui/button";
import {
  applyMarkdownPreviewTextEdits,
  rehypeEditablePreviewText,
  type MarkdownPreviewTextEdit,
} from "./markdownPreviewEditing";

import { handlePreviewSaveShortcut } from "./previewSaveShortcut";

const EditContext = createContext<(edit: MarkdownPreviewTextEdit | null, start: number) => void>(
  () => {},
);
const EDIT_PLUGINS = [rehypeEditablePreviewText];
const EDIT_COMPONENTS = {
  span: function EditablePreviewSpan({ node, children, ...props }) {
    const onEdit = use(EditContext);
    const original = useRef<string | null>(null);
    const start = Number(node?.properties["data-edit-start"]);
    const end = Number(node?.properties["data-edit-end"]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return <span {...props}>{children}</span>;
    return (
      <span
        {...props}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label="Edit Markdown text"
        onFocus={(event) => {
          original.current ??= event.currentTarget.textContent ?? "";
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onInput={(event) => {
          const text = event.currentTarget.textContent ?? "";
          onEdit(text === original.current ? null : { start, end, text }, start);
        }}
      >
        {children}
      </span>
    );
  },
} satisfies Components;

export function MarkdownPreviewEditor(props: {
  text: string;
  readOnly: boolean;
  cwd: string;
  imageBaseDir: string;
  threadRef: ScopedThreadRef;
  workspaceMutationId: string | null;
  onSave: (original: string, text: string) => boolean;
  onCancel: () => void;
}) {
  const [original] = useState(props.text);
  const edits = useRef(new Map<number, MarkdownPreviewTextEdit>());
  const [dirty, setDirty] = useState(false);
  const [saveRejected, setSaveRejected] = useState(false);
  const changedExternally = props.text !== original;
  const canSave = dirty && !changedExternally && !props.readOnly;
  const save = () => {
    if (!canSave) return;
    const saved = props.onSave(
      original,
      applyMarkdownPreviewTextEdits(original, [...edits.current.values()]),
    );
    setSaveRejected(!saved);
  };
  return (
    <div
      className="contents"
      data-preview-save-editor
      onKeyDownCapture={(event) => handlePreviewSaveShortcut(event, save)}
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-6 py-2">
        <Button size="xs" disabled={!canSave} onClick={save}>
          Save changes
        </Button>
        <Button size="xs" variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          Click text to edit. Use source mode for formatting and code.
        </span>
      </div>
      {changedExternally || saveRejected || props.readOnly ? (
        <p role="alert" className="px-6 py-2 text-sm text-destructive">
          The file changed or is no longer writable. Copy your edits, then cancel and reopen
          editing.
        </p>
      ) : null}
      <EditContext
        value={(edit, start) => {
          if (edit) edits.current.set(start, edit);
          else edits.current.delete(start);
          setDirty(edits.current.size > 0);
        }}
      >
        <ChatMarkdown
          text={original}
          cwd={props.cwd}
          imageBaseDir={props.imageBaseDir}
          threadRef={props.threadRef}
          workspaceMutationId={props.workspaceMutationId}
          className="mx-auto max-w-4xl px-6 py-5"
          extraRehypePlugins={EDIT_PLUGINS}
          extraComponents={EDIT_COMPONENTS}
        />
      </EditContext>
    </div>
  );
}
