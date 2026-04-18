import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { clsx } from "clsx";
import type { BuildState, OutputLine } from "../../types";

interface BuildViewProps {
  state: BuildState;
  task: string | null;
  iteration: number;
  grade?: string;
  lines: OutputLine[];
  droppedLineCount: number;
  projects: string[];
  onSubmit: (
    description: string,
    opts?: { mode: "new" | "continue"; slug?: string },
  ) => void;
  onApprove: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onAbort: () => void;
}

const STATE_LABELS: Record<BuildState, string> = {
  idle: "Ready",
  planning: "Planning",
  building: "Building",
  auditing: "Auditing",
  awaiting_approval: "Awaiting Review",
  paused: "Paused",
  done: "Complete",
};

function ProgressStrip({ state }: { state: BuildState }) {
  const steps: { key: BuildState | string; label: string }[] = [
    { key: "planning", label: "Plan" },
    { key: "building", label: "Build" },
    { key: "auditing", label: "Audit" },
    { key: "awaiting_approval", label: "Review" },
    { key: "done", label: "Done" },
  ];
  const stateOrder = [
    "idle",
    "planning",
    "building",
    "auditing",
    "awaiting_approval",
    "paused",
    "done",
  ];
  const currentIdx = stateOrder.indexOf(state);

  return (
    <div className="w-full">
      <div className="flex w-full">
        {steps.map((step) => {
          const stepIdx = stateOrder.indexOf(step.key as BuildState);
          const done = currentIdx > stepIdx;
          const active =
            state === step.key ||
            (state === "paused" && step.key === "building");
          return (
            <div
              key={step.key}
              className="flex-1"
              style={{
                height: done || active ? 2 : 1,
                background:
                  done || active ? "var(--color-accent)" : "var(--color-ink-3)",
                marginRight: 2,
              }}
            />
          );
        })}
      </div>
      <div className="flex w-full" style={{ marginTop: 8 }}>
        {steps.map((step) => {
          const stepIdx = stateOrder.indexOf(step.key as BuildState);
          const done = currentIdx > stepIdx;
          const active =
            state === step.key ||
            (state === "paused" && step.key === "building");
          return (
            <span
              key={step.key}
              className="flex-1 uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color:
                  done || active ? "var(--color-fg-0)" : "var(--color-fg-2)",
              }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OutputLog({
  lines,
  droppedLineCount,
}: {
  lines: OutputLine[];
  droppedLineCount: number;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const totalLines = lines.length + droppedLineCount;

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0"
      style={{
        background: "var(--color-ink-2)",
        color: "var(--color-fg-0)",
        border: "1px solid var(--color-ink-3)",
        padding: 24,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {droppedLineCount > 0 && (
        <div
          className="uppercase"
          style={{
            color: "#bbbbbb",
            fontSize: 11,
            letterSpacing: "0.15em",
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: "1px solid #3a3a3a",
          }}
        >
          Showing last {lines.length} of {totalLines} lines · {droppedLineCount}{" "}
          earlier {droppedLineCount === 1 ? "line" : "lines"} dropped from view
        </div>
      )}
      {lines.length === 0 ? (
        <p style={{ color: "var(--color-fg-2)" }}>Output will appear here.</p>
      ) : (
        lines.map((l, i) => (
          <div key={i}>
            <span style={{ color: "var(--color-accent)" }}>[{l.agent}]</span>{" "}
            <span style={{ color: "var(--color-fg-2)" }}>·</span>{" "}
            <span style={{ color: "var(--color-fg-0)" }}>{l.line}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export function BuildView({
  state,
  task,
  iteration,
  grade,
  lines,
  droppedLineCount,
  projects,
  onSubmit,
  onApprove,
  onSkip,
  onRetry,
  onAbort,
}: BuildViewProps) {
  const [input, setInput] = useState("");
  // 'new' or an existing project slug to continue. Reset to 'new' whenever the project
  // list changes (e.g. user manually deleted the folder backing the current selection).
  const [projectSel, setProjectSel] = useState<string>("new");
  useEffect(() => {
    if (projectSel !== "new" && !projects.includes(projectSel)) {
      setProjectSel("new");
    }
  }, [projects, projectSel]);
  const busy = ["planning", "building", "auditing"].includes(state);
  const showForm = state === "idle" || state === "done";
  const showApproval = state === "awaiting_approval";
  const showPaused = state === "paused";
  const continueSlug = projectSel === "new" ? null : projectSel;

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    if (continueSlug) {
      onSubmit(text, { mode: "continue", slug: continueSlug });
    } else {
      onSubmit(text);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--color-ink-0)",
        color: "var(--color-fg-0)",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          padding: "40px 60px 28px",
          borderBottom: "1px solid var(--color-ink-3)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color: "var(--color-accent)",
                marginBottom: 10,
              }}
            >
              Build pipeline
            </p>
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 44,
                fontWeight: 400,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "var(--color-fg-0)",
              }}
            >
              Build
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-fg-1)",
                marginTop: 8,
              }}
            >
              Claude plans · Gemini builds · Codex audits
            </p>
          </div>
          <div
            className="flex flex-col items-end"
            style={{ gap: 8, paddingTop: 18 }}
          >
            <span
              className={clsx("uppercase")}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color: busy
                  ? "var(--color-accent)"
                  : state === "done"
                    ? "var(--color-fg-0)"
                    : "var(--color-fg-2)",
              }}
            >
              {STATE_LABELS[state]}
            </span>
            {iteration > 0 && (
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-fg-2)",
                  letterSpacing: "0.15em",
                }}
              >
                Iteration {iteration}
              </span>
            )}
          </div>
        </div>

        {(busy || state === "awaiting_approval" || state === "done") && (
          <div style={{ marginTop: 28 }}>
            <ProgressStrip state={state} />
          </div>
        )}

        {task && (
          <p
            className="truncate"
            style={{
              marginTop: 24,
              fontSize: 14,
              fontWeight: 400,
              color: "var(--color-fg-1)",
              lineHeight: 1.3,
              fontFamily: "var(--font-mono)",
            }}
          >
            › {task}
          </p>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 flex flex-col min-h-0"
        style={{ padding: "32px 60px", gap: 28 }}
      >
        {lines.length > 0 && (
          <OutputLog lines={lines} droppedLineCount={droppedLineCount} />
        )}

        {/* Approval panel */}
        {showApproval && (
          <div
            className="shrink-0"
            style={{
              background: "var(--color-ink-1)",
              border: "1px solid var(--color-ink-3)",
              padding: 28,
            }}
          >
            <div
              className="flex items-end justify-between"
              style={{ marginBottom: 20 }}
            >
              <h2
                className="uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.15em",
                  color: "var(--color-fg-1)",
                  margin: 0,
                }}
              >
                Audit complete
              </h2>
              {grade && (
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 56,
                    fontWeight: 500,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color:
                      grade === "A"
                        ? "var(--color-accent)"
                        : "var(--color-fg-0)",
                  }}
                >
                  {grade}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: 15,
                color: "var(--color-fg-1)",
                lineHeight: 1.5,
                margin: 0,
                marginBottom: 24,
              }}
            >
              Codex flagged issues. Revise to continue with another iteration,
              or skip to mark done.
            </p>
            <div className="flex items-center" style={{ gap: 16 }}>
              <PrimaryButton onClick={onApprove}>Revise →</PrimaryButton>
              <SecondaryButton onClick={onSkip}>Skip</SecondaryButton>
              <div className="ml-auto">
                <GhostButton onClick={onAbort}>Abort</GhostButton>
              </div>
            </div>
          </div>
        )}

        {/* Paused panel */}
        {showPaused && (
          <div
            className="shrink-0"
            style={{
              background: "var(--color-ink-1)",
              border: "1px solid var(--color-ink-3)",
              padding: 28,
            }}
          >
            <h2
              className="uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color: "var(--color-fg-1)",
                margin: 0,
                marginBottom: 10,
              }}
            >
              Paused after retry
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "var(--color-fg-1)",
                lineHeight: 1.5,
                margin: 0,
                marginBottom: 24,
              }}
            >
              Agent failed twice. Retry manually or abort.
            </p>
            <div className="flex items-center" style={{ gap: 16 }}>
              <PrimaryButton onClick={onRetry}>Retry →</PrimaryButton>
              <GhostButton onClick={onAbort}>Abort</GhostButton>
            </div>
          </div>
        )}

        {/* Task input */}
        {showForm && (
          <div className="shrink-0">
            <div style={{ marginBottom: 24 }}>
              <label
                className="uppercase"
                htmlFor="project-selector"
                style={{
                  fontSize: 12,
                  color: "#757575",
                  letterSpacing: "0.15em",
                  marginRight: 16,
                }}
              >
                Project
              </label>
              <select
                id="project-selector"
                value={projectSel}
                onChange={(e) => setProjectSel(e.target.value)}
                className="bg-transparent outline-none"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#262626",
                  letterSpacing: "0.05em",
                  padding: "8px 0",
                  borderBottom: "1px solid #262626",
                  minWidth: 240,
                }}
              >
                <option value="new">New project</option>
                {projects.map((slug) => (
                  <option key={slug} value={slug}>
                    Continue: {slug}
                  </option>
                ))}
              </select>
              <p
                style={{
                  fontSize: 12,
                  color: "#757575",
                  marginTop: 8,
                  lineHeight: 1.3,
                }}
              >
                {continueSlug
                  ? `New work appends to the existing ${continueSlug}/ folder.`
                  : "Claude picks a slug and Gemini creates a new <slug>/ folder for the deliverables."}
              </p>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                continueSlug
                  ? `What changes do you want to make to ${continueSlug}?`
                  : "Describe what you want to build..."
              }
              rows={3}
              className="w-full outline-none resize-none"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 400,
                color: "var(--color-fg-0)",
                lineHeight: 1.5,
                padding: "14px 0 12px",
                background: "transparent",
                borderBottom: "1px solid var(--color-ink-3)",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                transition: "border-color 150ms ease-out",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderBottom =
                  "2px solid var(--color-accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderBottom =
                  "1px solid var(--color-ink-3)";
              }}
            />
            <div
              className="flex items-center justify-between"
              style={{ marginTop: 20 }}
            >
              <p
                className="uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-fg-2)",
                  letterSpacing: "0.15em",
                  margin: 0,
                }}
              >
                Shift + Enter for new line · Enter to submit
              </p>
              <PrimaryButton onClick={handleSubmit} disabled={!input.trim()}>
                {continueSlug ? "Continue Build →" : "Start Build →"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        padding: "12px 22px",
        background: disabled ? "transparent" : "var(--color-accent)",
        color: disabled ? "var(--color-fg-2)" : "var(--color-ink-0)",
        border: `1px solid ${disabled ? "var(--color-ink-3)" : "var(--color-accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 150ms ease-out, border-color 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--color-accent-dim)";
          e.currentTarget.style.borderColor = "var(--color-accent-dim)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--color-accent)";
          e.currentTarget.style.borderColor = "var(--color-accent)";
        }
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.2,
        padding: "12px 0 10px",
        color: "var(--color-fg-0)",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--color-fg-0)",
        cursor: "pointer",
        transition: "color 150ms ease-out, border-color 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--color-accent)";
        e.currentTarget.style.borderColor = "var(--color-accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--color-fg-0)";
        e.currentTarget.style.borderColor = "var(--color-fg-0)";
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="uppercase"
      style={{
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: "0.15em",
        fontFamily: "var(--font-mono)",
        padding: "10px 0 8px",
        color: "var(--color-danger)",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--color-danger)",
        cursor: "pointer",
        opacity: 0.8,
        transition: "opacity 150ms ease-out",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
    >
      {children}
    </button>
  );
}
