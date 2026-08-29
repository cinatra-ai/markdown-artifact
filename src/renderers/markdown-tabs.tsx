"use client";

// THE MARKDOWN DISPLAY'S TWO TABS, ITS EDITABLE CODE VIEW AND ITS SAVING
// INDICATOR (enabler 0.20 of `PLAN: Agents Lifecycle (C)`, cinatra#3026).
//
// THE DRAWING, IN ITS OWN WORDS:
//   "Two tabs, and only one of them on screen … Only the ACTIVE tab's view is
//    shown: Code shows the markdown as it is written — syntax-highlighted,
//    never plain text … Preview renders it."
//   "Editable where the artifact lives, read-only where it is reviewed. On the
//    artifact's own page the Code view takes an edit IN PLACE: there is no edit
//    mode to enter and no Save button to find … On a review target the same
//    display is drawn read-only — both tabs, neither editable."
//   "The saving indicator says where the change is. BESIDE THE TABS — ALONE WITH
//    THEM IN THE HEADER — sits one indicator with two readings while all is
//    well: a spinner from the moment the reader starts editing, and a check once
//    the latest change is stored."
//   "The reason is a TOAST, never a note inside the display."
//
// TABS ARE TABS. The header is a real `tablist` of real `tab` buttons over a
// real `tabpanel`: `aria-selected`, `aria-controls`, roving focus with the arrow
// keys, Home and End — the pattern the application uses everywhere, not a toggle
// wearing tab paint. The class lists mirror the design system's own Tabs (the
// 13px label, the slate inactive, the 2px primary underline on the active one),
// so this display and the host's tabs read as one component.
//
// NOTHING ELSE IS IN THE HEADER. No renderer name, no package, no "runtime"
// label, no pill: the drawing removed that chrome from every artifact rendering,
// and what sits beside the tabs is the indicator and nothing else — and on a
// read-only surface, not even that, because there is no save to report.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { cinatraToast } from "@cinatra-ai/sdk-ui/toast";
import { saveArtifactEdit } from "@cinatra-ai/sdk-extensions/artifact-edit-channel";

import {
  ARTIFACT_EDIT_IDLE_PAUSE_MS,
  isArtifactEditGranted,
  type ArtifactEditCapability,
  type ArtifactEditOutcome,
} from "../artifact-edit-channel";
import { MarkdownBody, MarkdownTruncationNote } from "./markdown-document";
import { createChangeSetQueue, type ChangeSetQueue } from "./markdown-change-set-queue";
import { highlightMarkdown, type MarkdownTokenKind } from "./markdown-code-highlight";
import { renderMarkdownHtml } from "./markdown-view";
import type { MarkdownView } from "./markdown-view-contract";

export type MarkdownTab = "code" | "preview";

/** What the indicator is saying. `null` is "nothing to say yet" — before the
 *  first edit there is no save to report, and an indicator that read "Saved"
 *  on open would be claiming something no save has established. */
export type SavingIndicator = null | "saving" | "saved" | "not-saved";

const TAB_LABELS: Record<MarkdownTab, string> = { code: "Code", preview: "Preview" };
const TAB_ORDER: MarkdownTab[] = ["code", "preview"];

/** The design system's own tab classes, mirrored so both read as one component. */
const TAB_BASE =
  "relative inline-flex items-center gap-1.5 whitespace-nowrap px-1 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
const TAB_ACTIVE =
  "text-primary after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-primary";
const TAB_INACTIVE = "text-muted-foreground hover:text-foreground";

/** The token colours of the code view, in the application's own palette — the
 *  same tokens in light and dark, so the highlighter follows the theme rather
 *  than carrying colours of its own. */
const TOKEN_CLASSES: Record<MarkdownTokenKind, string> = {
  text: "",
  heading: "text-primary font-semibold",
  strong: "text-foreground font-semibold",
  emphasis: "text-foreground italic",
  code: "text-[color:var(--rust,#a2542a)]",
  link: "text-[color:var(--green,#2f7d54)]",
  marker: "text-muted-foreground",
};

/** ONE font metric for the overlay and the textarea. They must agree exactly or
 *  the caret drifts away from the letters underneath it. */
const CODE_TEXT = "font-mono text-[12.5px] leading-6 whitespace-pre-wrap break-words";

function SpinnerIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-3.5 animate-spin text-primary"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** The indicator, in its three readings. Absent when there is nothing to say. */
function SavingIndicatorView({ state }: { state: SavingIndicator }): ReactElement | null {
  if (state === null) return null;
  const saved = state === "saved";
  return (
    <span
      role="status"
      aria-live="polite"
      data-saving-indicator={state}
      className={`ml-auto inline-flex items-center gap-1.5 text-[11.5px] ${
        saved ? "text-[color:var(--green,#2f7d54)]" : "text-muted-foreground"
      }`}
    >
      {saved ? <CheckIcon /> : <SpinnerIcon />}
      {saved ? "Saved" : state === "saving" ? "Saving…" : "Not saved"}
    </span>
  );
}

/** The highlighted markdown, drawn under the textarea (and alone, read-only). */
function CodeText({
  source,
  alignWithEditor,
}: {
  source: string;
  /** True when this text sits UNDER a textarea and must match its box exactly. */
  alignWithEditor: boolean;
}): ReactElement {
  const tokens = useMemo(() => highlightMarkdown(source), [source]);
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} className={TOKEN_CLASSES[token.kind]} data-token={token.kind}>
          {token.text}
        </span>
      ))}
      {/* A trailing newline is not rendered by the browser, so the overlay would
          end one line short of the textarea, and the caret on that last empty
          line would sit over nothing. A zero-width character gives that line
          something to be. It is drawn ONLY under an editor: a read-only reading
          has no caret to keep aligned and no reason to carry it. */}
      {alignWithEditor && source.endsWith("\n") ? "​" : null}
    </>
  );
}

export function MarkdownTabbedDisplay({
  view,
  edit,
  slot = "detail",
}: {
  /** The resolved DOCUMENT view: the pinned markdown, its sanitized rendering,
   *  the revision it was read from, and whether the channel had to cut it. */
  view: Extract<MarkdownView, { kind: "document" }>;
  /** The host's edit capability: a grant, or a named refusal. */
  edit: ArtifactEditCapability | null | undefined;
  slot?: "detail" | "preview";
}): ReactElement {
  const source = view.source;
  const revisionId = view.revisionId;
  const granted = isArtifactEditGranted(edit) ? edit : null;
  const [tab, setTab] = useState<MarkdownTab>("code");
  const [text, setText] = useState(source);
  /**
   * THE DOCUMENT AS IT IS ON SCREEN, readable from a save's callback without
   * making that callback depend on a render. An outcome describes the change set
   * that was SENT; whether it is also the latest thing the person typed is a
   * comparison against this.
   */
  const textRef = useRef(source);
  const [indicator, setIndicator] = useState<SavingIndicator>(null);
  const baseRef = useRef(granted?.baseRevisionId ?? revisionId);
  const idPrefix = useId();
  const tabRefs = useRef<Partial<Record<MarkdownTab, HTMLButtonElement | null>>>({});

  // The document the host handed us changed under our feet (a fresh page render
  // on a newer revision): take it, and forget any indicator from the last one.
  useEffect(() => {
    setText(source);
    textRef.current = source;
    setIndicator(null);
    baseRef.current = granted?.baseRevisionId ?? revisionId;
  }, [source, revisionId, granted?.baseRevisionId]);

  const applyOutcome = useCallback(
    (outcome: ArtifactEditOutcome, sentText: string, queue: ChangeSetQueue | null) => {
    // THE CHECK MEANS "THE LATEST CHANGE IS STORED", and nothing weaker. A save
    // that settles while the person has already typed past it stored an OLDER
    // document, so the spinner stays until the change set that is on screen has
    // been stored too.
    const storedTheLatest = sentText === textRef.current;
    if (outcome.outcome === "saved") {
      baseRef.current = outcome.revisionId;
      setIndicator(storedTheLatest ? "saved" : "saving");
      return;
    }
    if (outcome.outcome === "unchanged") {
      setIndicator(storedTheLatest ? "saved" : "saving");
      return;
    }
    if (outcome.outcome === "stale") {
      // REFUSED, NEVER WRITTEN OVER. The editor RELOADS: the newer revision's
      // own text replaces what is on screen, and the next change set is made
      // against that revision.
      // WHAT WAS WAITING TO BE SENT IS FORGOTTEN FIRST. Anything typed while the
      // refused save was in flight belongs to the document that has just been
      // replaced; sending it against the newer revision would write it over the
      // very revision this refusal protected, and over text the person can no
      // longer see.
      queue?.cancelPending();
      baseRef.current = outcome.latestRevisionId;
      setText(outcome.text);
      textRef.current = outcome.text;
      setIndicator("not-saved");
      cinatraToast.warning(
        "This artifact moved to a newer revision while you were editing, so the save was refused rather than written over it. The newer revision is loaded here.",
      );
      return;
    }
    setIndicator("not-saved");
    cinatraToast.error(editFailureSentence(outcome));
  },
    [],
  );

  // ONE QUEUE PER EDITOR, living as long as the capability it saves under.
  const queue = useMemo(() => {
    if (!granted) return null;
    // The queue is handed to its own outcome callback so a refusal can drop the
    // change set waiting behind it (see `applyOutcome`); it is assigned before
    // any save can settle, so the read is never null there.
    let created: ChangeSetQueue | null = null;
    created = createChangeSetQueue<ArtifactEditOutcome>({
      idlePauseMs: granted.idlePauseMs || ARTIFACT_EDIT_IDLE_PAUSE_MS,
      save: (next) =>
        saveArtifactEdit(
          { ...granted, baseRevisionId: baseRef.current },
          next,
        ) as Promise<ArtifactEditOutcome>,
      onOutcome: (outcome, sentText) => applyOutcome(outcome, sentText, created),
    });
    return created;
  }, [granted, applyOutcome]);

  // LEAVING THE VIEW, in every way a person leaves it: the component going away
  // (navigating off the page), and the tab or window being hidden (switching
  // away, closing). Both flush whatever the pause has not sent yet.
  useEffect(() => {
    if (!queue) return;
    const flush = (): void => queue.flush();
    const onVisibility = (): void => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", flush);
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", flush);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      queue.dispose();
    };
  }, [queue]);

  const onEdited = (next: string): void => {
    setText(next);
    textRef.current = next;
    // THE SPINNER STARTS AT THE EDIT, not at the send: "a spinner appears when
    // the person starts editing and turns into a check when the latest change is
    // stored", so the seconds of the idle pause are covered too.
    setIndicator("saving");
    queue?.edited(next);
  };

  const selectTab = (next: MarkdownTab): void => {
    // Leaving the Code view is one of the two things that bounds a change set.
    if (tab === "code" && next !== "code") queue?.flush();
    setTab(next);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const index = TAB_ORDER.indexOf(tab);
    let next: MarkdownTab | null = null;
    if (event.key === "ArrowRight") next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    else if (event.key === "ArrowLeft") next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    else if (event.key === "Home") next = TAB_ORDER[0];
    else if (event.key === "End") next = TAB_ORDER[TAB_ORDER.length - 1];
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  const html = useMemo(() => (tab === "preview" ? renderMarkdownHtml(text) : ""), [tab, text]);

  return (
    <article
      className="soft-panel rounded-card overflow-hidden"
      data-artifact-renderer="markdown"
      data-slot={slot}
      data-revision={revisionId}
      data-editable={granted ? "true" : "false"}
      {...(view.truncated ? { "data-truncated": "true" } : {})}
      {...(granted ? {} : { "data-read-only-reason": edit?.kind === "read-only" ? edit.reason : "no-capability" })}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3">
        <div role="tablist" aria-label="Markdown views" className="inline-flex items-center gap-4">
          {TAB_ORDER.map((name) => (
            <button
              key={name}
              ref={(node) => {
                tabRefs.current[name] = node;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`${idPrefix}-panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => selectTab(name)}
              onKeyDown={onTabKeyDown}
              className={`${TAB_BASE} ${tab === name ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </div>
        {/* Beside the tabs, ALONE with them: the indicator, and only where there
            is a save to report. */}
        {granted ? <SavingIndicatorView state={indicator} /> : null}
      </div>

      {/* ONLY THE ACTIVE TAB'S VIEW IS SHOWN. The inactive panel is not hidden
          with a class — it is not rendered at all, so "the two are never shown
          side by side" is a property of the tree rather than of a stylesheet. */}
      {tab === "code" ? (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-code`}
          aria-labelledby={`${idPrefix}-tab-code`}
          data-panel="code"
          className="p-3"
        >
          {granted ? (
            <div className="relative">
              <pre aria-hidden="true" className={`m-0 ${CODE_TEXT} text-foreground`}>
                <CodeText source={text} alignWithEditor />
              </pre>
              {/* The caret and the letters are two layers of one view: a
                  transparent textarea over the highlighted text, sharing every
                  font metric. The highlighter's spans concatenate back to the
                  text character for character, which is what keeps them aligned. */}
              <textarea
                aria-label="Markdown source"
                data-code-editor=""
                spellCheck={false}
                value={text}
                onChange={(event) => onEdited(event.target.value)}
                onBlur={() => queue?.flush()}
                className={`absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-0 text-transparent caret-foreground outline-none ${CODE_TEXT}`}
              />
            </div>
          ) : (
            <pre className={`m-0 ${CODE_TEXT} text-foreground`} data-code-readonly="">
              <CodeText source={text} alignWithEditor={false} />
            </pre>
          )}
          {view.truncated ? (
            <MarkdownTruncationNote
              byteLength={view.byteLength}
              projectedByteLength={view.projectedByteLength}
            />
          ) : null}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-preview`}
          aria-labelledby={`${idPrefix}-tab-preview`}
          data-panel="preview"
          className="p-6"
        >
          <MarkdownBody html={html} compact={false} />
          {view.truncated ? (
            <MarkdownTruncationNote
              byteLength={view.byteLength}
              projectedByteLength={view.projectedByteLength}
            />
          ) : null}
        </div>
      )}
    </article>
  );
}

/** The sentence a failed or refused save is explained with. */
function editFailureSentence(outcome: ArtifactEditOutcome): string {
  if (outcome.outcome === "refused") {
    switch (outcome.reason) {
      case "no-write-rights":
        return "This change has not been saved — you do not have rights to edit this artifact.";
      case "over-cap":
        return "This change has not been saved — the document is larger than the editor can store.";
      case "unsupported-form":
        return "This change has not been saved — this artifact is not a text document the editor can store.";
      case "no-representation":
        return "This change has not been saved — this artifact has no stored revision to save over.";
      case "unknown-base":
        return "This change has not been saved — the revision it was made against is no longer stored.";
      default:
        return "This change has not been saved — the change set could not be read.";
    }
  }
  if (outcome.outcome === "failed" && outcome.reason === "transport") {
    return "This change has not been saved — the store could not be reached.";
  }
  if (outcome.outcome === "failed" && outcome.reason === "malformed-answer") {
    return "This change has not been saved — the store's answer could not be read.";
  }
  return "This change has not been saved — the store could not store it.";
}
