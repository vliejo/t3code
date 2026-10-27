import { createContext, useState } from "react";
import { Button } from "../ui/button";
import { handlePreviewSaveShortcut } from "../files/previewSaveShortcut";
import { Textarea } from "../ui/textarea";

export const MermaidEditingContext = createContext<{
  source: string;
  onChange: ((original: string, text: string) => boolean) | undefined;
} | null>(null);

export function MarkdownMermaidEditor({
  code,
  version,
  onSave,
  onCancel,
}: {
  code: string;
  version: string;
  onSave: ((code: string) => boolean) | undefined;
  onCancel: () => void;
}) {
  const [original] = useState(version);
  const [draft, setDraft] = useState(code);
  const [rejected, setRejected] = useState(false);
  const stale = original !== version;
  const canSave = !!onSave && !stale && draft !== code;
  const save = () => {
    if (!canSave) return;
    if (!onSave?.(draft)) setRejected(true);
  };
  return (
    <div
      className="space-y-2 p-3"
      data-preview-save-editor
      onKeyDownCapture={(event) => handlePreviewSaveShortcut(event, save)}
    >
      <Textarea
        aria-label="Mermaid source"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={Math.max(6, Math.min(20, draft.split("\n").length))}
        spellCheck={false}
      />
      {stale || rejected || !onSave ? (
        <p role="alert">
          The file changed or is no longer writable. Copy your edits, then cancel and reopen the
          source.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" disabled={!canSave} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
