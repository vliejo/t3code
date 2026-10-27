import type { ScopedThreadRef } from "@t3tools/contracts";
import { resolvePathLinkTarget } from "@t3tools/shared/fileLinks";
import { maskMarkdownFrontmatter } from "@t3tools/shared/markdownFrontmatter";
import { Plus } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Components } from "react-markdown";

import { MermaidEditingContext } from "../chat/MarkdownMermaidEditor";
import ChatMarkdown from "~/components/ChatMarkdown";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { buildFileReviewComment } from "~/reviewCommentContext";

import { DiffCommentAnnotation } from "../diffs/DiffCommentAnnotation";
import { formatFileCommentRange, nextFileCommentId } from "./fileCommentAnnotations";
import { markdownCommentSelection, rehypeCommentBlocks } from "./markdownCommentSelection";

import { MarkdownPreviewEditor } from "./MarkdownPreviewEditor";

const COMMENT_PLUGINS = [rehypeCommentBlocks];

type CommentRange = { startLine: number; endLine: number };

const MarkdownCommentsContext = createContext<{
  selection: CommentRange | null;
  draft: CommentRange | null;
  startComment: (range: CommentRange) => void;
  renderAnnotations: (range: CommentRange) => ReactNode;
} | null>(null);

const COMMENT_COMPONENTS = {
  div: function CommentBlock({ node, children, ...props }) {
    const context = useContext(MarkdownCommentsContext);
    const startLine = Number(node?.properties["data-comment-start"]);
    const endLine = Number(node?.properties["data-comment-end"]);
    if (!context || !startLine || !endLine) return <div {...props}>{children}</div>;
    const range =
      context.selection &&
      startLine <= context.selection.endLine &&
      endLine >= context.selection.startLine
        ? context.selection
        : { startLine, endLine };
    const highlighted = context.draft ?? context.selection;
    const active =
      highlighted && startLine <= highlighted.endLine && endLine >= highlighted.startLine;
    return (
      <div {...props} className="group/markdown-comment relative">
        <button
          type="button"
          aria-label={`Add comment on ${formatFileCommentRange(range.startLine, range.endLine)}`}
          className="absolute -left-5 top-0.5 z-10 flex size-5 cursor-pointer items-center justify-center rounded bg-primary text-primary-foreground opacity-0 hover:bg-primary/90 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/markdown-comment:opacity-100 max-sm:opacity-100"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => context.startComment(range)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <div data-comment-content className={active ? "bg-primary/10" : undefined}>
          {children}
        </div>
        <div data-markdown-comments>{context.renderAnnotations({ startLine, endLine })}</div>
      </div>
    );
  },
} satisfies Components;

export function FileMarkdownPreview(props: {
  readonly editing: boolean;
  readonly onEditingChange: (editing: boolean) => void;
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
  const { editing, onEditingChange } = props;
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
        onCancel={() => onEditingChange(false)}
        onSave={(original, text) => {
          if (!props.onTextChange?.(original, text)) return false;
          onEditingChange(false);
          return true;
        }}
      />
    );
  }

  const startComment = (range: CommentRange) => {
    if (!targetKey) return;
    setDraft({ ...range, id: nextFileCommentId(), contents: props.text, targetKey });
  };

  return (
    <>
      <MarkdownCommentsContext.Provider
        value={{
          selection,
          draft: activeDraft,
          startComment,
          renderAnnotations: ({ startLine, endLine }) => (
            <>
              {activeDraft?.endLine === endLine ? (
                <div className="my-2 border-l-2 border-primary bg-primary/15">
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
                </div>
              ) : null}
              {comments
                ?.filter(
                  (comment) =>
                    comment.sectionId === `file:${props.relativePath}` &&
                    comment.endIndex + 1 >= startLine &&
                    comment.endIndex + 1 <= endLine,
                )
                .map((comment) => (
                  <div key={comment.id} className="my-2">
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
          ),
        }}
      >
        <MermaidEditingContext value={{ source: props.text, onChange: props.onTextChange }}>
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
              extraComponents={props.composerDraftTarget ? COMMENT_COMPONENTS : {}}
            />
          </div>
        </MermaidEditingContext>
      </MarkdownCommentsContext.Provider>
    </>
  );
}
