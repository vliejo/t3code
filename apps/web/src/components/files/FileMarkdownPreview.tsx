import type { ScopedThreadRef } from "@t3tools/contracts";
import { resolvePathLinkTarget } from "@t3tools/shared/fileLinks";
import { maskMarkdownFrontmatter } from "@t3tools/shared/markdownFrontmatter";
import { useEffect, useRef, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Button } from "~/components/ui/button";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { buildFileReviewComment } from "~/reviewCommentContext";

import { DiffCommentAnnotation } from "../diffs/DiffCommentAnnotation";
import { formatFileCommentRange, nextFileCommentId } from "./fileCommentAnnotations";
import { markdownCommentSelection, rehypeCommentBlocks } from "./markdownCommentSelection";

import { MarkdownPreviewEditor } from "./MarkdownPreviewEditor";

const COMMENT_PLUGINS = [rehypeCommentBlocks];

export function FileMarkdownPreview(props: {
  readonly onTextChange?: ((original: string, text: string) => boolean) | undefined;
  readonly composerDraftTarget?: ScopedThreadRef | DraftId;
  readonly cwd: string;
  readonly relativePath: string;
  readonly text: string;
  readonly threadRef: ScopedThreadRef;
  readonly workspaceMutationId: string | null;
  readonly onTaskListChange?:
    | ((input: { readonly markerOffset: number; readonly checked: boolean }) => void)
    | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const targetKey =
    typeof props.composerDraftTarget === "string"
      ? props.composerDraftTarget
      : props.composerDraftTarget
        ? `${props.composerDraftTarget.environmentId}:${props.composerDraftTarget.threadId}`
        : null;
  const [selected, setSelection] = useState<{
    startLine: number;
    endLine: number;
    contents: string;
    targetKey: string;
  } | null>(null);
  const selection =
    selected?.contents === props.text && selected.targetKey === targetKey ? selected : null;
  const [draft, setDraft] = useState<{
    id: string;
    startLine: number;
    endLine: number;
    contents: string;
    targetKey: string;
  } | null>(null);
  const addReviewComment = useComposerDraftStore((store) => store.addReviewComment);
  const removeReviewComment = useComposerDraftStore((store) => store.removeReviewComment);
  const comments = useComposerDraftStore((store) =>
    props.composerDraftTarget
      ? store.getComposerDraft(props.composerDraftTarget)?.reviewComments
      : undefined,
  );
  const activeDraft =
    draft?.contents === props.text && draft.targetKey === targetKey ? draft : null;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !targetKey || editing) return;
    const update = () => {
      const range = markdownCommentSelection(root, document.getSelection());
      setSelection(range ? { ...range, contents: props.text, targetKey } : null);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [props.text, targetKey, editing]);

  const lastSeparator = Math.max(
    props.relativePath.lastIndexOf("/"),
    props.relativePath.lastIndexOf("\\"),
  );
  const imageBaseDir =
    lastSeparator >= 0
      ? resolvePathLinkTarget(props.relativePath.slice(0, lastSeparator), props.cwd)
      : props.cwd;

  if (editing) {
    return (
      <MarkdownPreviewEditor
        readOnly={!props.onTextChange}
        text={props.text}
        cwd={props.cwd}
        imageBaseDir={imageBaseDir}
        threadRef={props.threadRef}
        workspaceMutationId={props.workspaceMutationId}
        onCancel={() => setEditing(false)}
        onSave={(original, text) => {
          if (!props.onTextChange?.(original, text)) return false;
          setEditing(false);
          return true;
        }}
      />
    );
  }

  return (
    <>
      {props.composerDraftTarget || props.onTextChange ? (
        <div className="sticky top-0 z-10 border-b border-border bg-background px-6 py-2">
          {activeDraft ? (
            <DiffCommentAnnotation
              key={activeDraft.id}
              kind="draft"
              rangeLabel={formatFileCommentRange(activeDraft.startLine, activeDraft.endLine)}
              text=""
              onCancel={() => setDraft(null)}
              onComment={(text) => {
                if (!props.composerDraftTarget) return;
                addReviewComment(
                  props.composerDraftTarget,
                  buildFileReviewComment({
                    ...activeDraft,
                    filePath: props.relativePath,
                    text,
                  }),
                );
                setDraft(null);
              }}
            />
          ) : (
            <div className="flex items-center gap-3">
              {props.onTextChange ? (
                <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                  Edit text
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="outline"
                disabled={!selection}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!selection) return;
                  setDraft({ ...selection, id: nextFileCommentId(), contents: props.text });
                }}
              >
                Add comment
              </Button>
              <span className="text-xs text-muted-foreground">
                {selection
                  ? `Comment on ${formatFileCommentRange(selection.startLine, selection.endLine)}`
                  : "Select text to comment on a section."}
              </span>
            </div>
          )}
        </div>
      ) : null}
      <div ref={rootRef}>
        <ChatMarkdown
          text={maskMarkdownFrontmatter(props.text)}
          cwd={props.cwd}
          imageBaseDir={imageBaseDir}
          threadRef={props.threadRef}
          workspaceMutationId={props.workspaceMutationId}
          className="mx-auto max-w-4xl px-6 py-5"
          onTaskListChange={props.onTaskListChange}
          extraRehypePlugins={props.composerDraftTarget ? COMMENT_PLUGINS : []}
        />
      </div>
      {comments
        ?.filter((comment) => comment.sectionId === `file:${props.relativePath}`)
        .map((comment) => (
          <div key={comment.id} className="mx-auto max-w-4xl px-6 pb-2">
            <p className="text-xs text-muted-foreground">{comment.rangeLabel}</p>
            <DiffCommentAnnotation
              kind="comment"
              rangeLabel={comment.rangeLabel}
              text={comment.text}
              onCancel={() => {}}
              onComment={() => {}}
              onDelete={() => {
                if (props.composerDraftTarget)
                  removeReviewComment(props.composerDraftTarget, comment.id);
              }}
            />
          </div>
        ))}
    </>
  );
}
