import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHistory, fetchBuildArchive, fetchDiscussionArchive } from '../../hooks/useHistory';
import { markdownComponents } from '../shared/markdownComponents';
import { Panel } from '../shared/Panel';
import type { BuildArchive, DiscussionArchive } from '../../types';

type Selection =
  | { kind: 'build'; slug: string }
  | { kind: 'discussion'; slug: string }
  | null;

type LoadedContent =
  | { kind: 'build'; slug: string; data: BuildArchive | null }
  | { kind: 'discussion'; slug: string; data: DiscussionArchive | null };

function formatDate(mtime: number): string {
  return new Date(mtime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function HistoryView() {
  const { builds, discussions, loading } = useHistory();
  const [selected, setSelected] = useState<Selection>(null);
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const fetcher =
      selected.kind === 'build'
        ? fetchBuildArchive(selected.slug).then(
            (data): LoadedContent => ({ kind: 'build', slug: selected.slug, data }),
          )
        : fetchDiscussionArchive(selected.slug).then(
            (data): LoadedContent => ({ kind: 'discussion', slug: selected.slug, data }),
          );
    fetcher.then((result) => {
      if (cancelled) return;
      setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const contentMatchesSelection =
    selected !== null &&
    loaded !== null &&
    loaded.kind === selected.kind &&
    loaded.slug === selected.slug;
  const contentLoading = selected !== null && !contentMatchesSelection;
  const buildContent =
    contentMatchesSelection && loaded!.kind === 'build'
      ? (loaded!.data as BuildArchive | null)
      : null;
  const discussionContent =
    contentMatchesSelection && loaded!.kind === 'discussion'
      ? (loaded!.data as DiscussionArchive | null)
      : null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        background: 'var(--bg)',
        color: 'var(--ink)',
        minHeight: 0,
      }}
    >
      {/* Left rail — builds + discussions */}
      <aside
        style={{
          flexShrink: 0,
          width: 300,
          borderRight: '1px solid var(--rule)',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '22px 22px 14px',
            borderBottom: '1px dashed var(--rule)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-dimmer)',
              letterSpacing: '0.05em',
            }}
          >
            <b style={{ color: 'var(--accent)', fontWeight: 500 }}>archive</b> ~ $
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginTop: 6,
            }}
          >
            archive
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
            }}
          >
            read-only · {builds.length + discussions.length}{' '}
            {builds.length + discussions.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
          <RailSection
            title="builds"
            entries={builds}
            kind="build"
            selected={selected}
            onSelect={setSelected}
            empty={loading ? 'loading…' : 'no builds yet.'}
          />
          <RailSection
            title="discussions"
            entries={discussions}
            kind="discussion"
            selected={selected}
            onSelect={setSelected}
            empty={loading ? 'loading…' : 'no discussions yet.'}
          />
        </div>
      </aside>

      {/* Right pane */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!selected ? (
          <EmptyState />
        ) : contentLoading ? (
          <LoadingState />
        ) : selected.kind === 'build' ? (
          <BuildArchiveView slug={selected.slug} archive={buildContent} />
        ) : (
          <DiscussionArchiveView slug={selected.slug} archive={discussionContent} />
        )}
      </main>
    </div>
  );
}

/* ────────────────────────────── left rail ────────────────────────────── */

function RailSection({
  title,
  entries,
  kind,
  selected,
  onSelect,
  empty,
}: {
  title: string;
  entries: { slug: string; mtime: number }[];
  kind: 'build' | 'discussion';
  selected: Selection;
  onSelect: (s: Selection) => void;
  empty: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          padding: '14px 22px 6px',
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span style={{ color: 'var(--rule-hot)' }}>//</span>
        {title}
      </div>
      {entries.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-dimmer)',
            padding: '4px 22px 12px',
            fontStyle: 'italic',
          }}
        >
          {empty}
        </div>
      ) : (
        entries.map((entry) => {
          const isActive = selected?.kind === kind && selected.slug === entry.slug;
          return (
            <button
              key={`${kind}:${entry.slug}`}
              onClick={() => onSelect({ kind, slug: entry.slug } as Selection)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 22px',
                background: isActive ? 'var(--bg-2)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-2)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? 'var(--ink)' : 'var(--ink)',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.slug}
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  color: isActive ? 'var(--accent)' : 'var(--ink-dimmer)',
                  textTransform: 'uppercase',
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDate(entry.mtime)}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

/* ────────────────────────────── right pane ────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        padding: 40,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}
      >
        select an entry to view
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
        }}
      >
        archived plans, build logs, feedback, and discussions
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: '0.15em',
          color: 'var(--ink-dim)',
          textTransform: 'uppercase',
        }}
      >
        loading…
      </span>
    </div>
  );
}

function ErrorState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--warn)' }}>failed to load archive.</span>
    </div>
  );
}

function ArchiveHeader({
  slug,
  kind,
  sublabel,
}: {
  slug: string;
  kind: 'build' | 'discussion';
  sublabel: string;
}) {
  return (
    <div
      style={{
        padding: '22px 26px',
        borderBottom: '1px solid var(--rule)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
          color: 'var(--ink-dimmer)',
          letterSpacing: '0.06em',
          marginBottom: 10,
        }}
      >
        <span style={{ color: 'var(--ink)' }}>archive</span>
        <span style={{ color: 'var(--rule-hot)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>{kind}</span>
        <span style={{ color: 'var(--ink-dim)', fontSize: 10, marginLeft: 'auto' }}>
          {sublabel}
        </span>
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            padding: '2px 8px',
          }}
        >
          {slug}
        </span>
      </h1>
    </div>
  );
}

function BuildArchiveView({ slug, archive }: { slug: string; archive: BuildArchive | null }) {
  if (!archive) return <ErrorState />;
  return (
    <>
      <ArchiveHeader slug={slug} kind="build" sublabel={`Build-History/${slug}/`} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px 26px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <ArchiveSection label="Plan.md" body={archive.plan} />
        <ArchiveSection label="Build-Log.md" body={archive.buildLog} />
        <ArchiveSection label="Build-Feedback.md" body={archive.buildFeedback} />
      </div>
    </>
  );
}

function DiscussionArchiveView({
  slug,
  archive,
}: {
  slug: string;
  archive: DiscussionArchive | null;
}) {
  if (!archive) return <ErrorState />;
  return (
    <>
      <ArchiveHeader slug={slug} kind="discussion" sublabel={`WarZone-History/${slug}/WarZone.md`} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px 26px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <ArchiveSection label="WarZone.md" body={archive.warzone} />
      </div>
    </>
  );
}

function ArchiveSection({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(true);
  const isEmpty = !body.trim();
  return (
    <Panel
      headLabel={label}
      headRight={isEmpty ? 'not present' : open ? 'expanded' : 'collapsed'}
    >
      <div style={{ padding: 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 22px',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-dim)',
            cursor: 'pointer',
            borderBottom: open && !isEmpty ? '1px dashed var(--rule)' : 'none',
          }}
        >
          {open ? '▾' : '▸'} toggle {label}
        </button>
        {open && (
          <div
            className="markdown-body"
            style={{
              padding: '16px 22px 22px',
              color: 'var(--ink)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {isEmpty ? (
              <p style={{ fontSize: 12, color: 'var(--ink-dimmer)', fontStyle: 'italic' }}>
                (file not present in this archive)
              </p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {body}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
