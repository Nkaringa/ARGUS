import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHistory, fetchBuildArchive, fetchDiscussionArchive } from '../../hooks/useHistory';
import { markdownComponents } from '../shared/markdownComponents';
import type { BuildArchive, DiscussionArchive } from '../../types';

type Selection =
  | { kind: 'build'; slug: string }
  | { kind: 'discussion'; slug: string }
  | null;

function formatDate(mtime: number): string {
  return new Date(mtime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type LoadedContent =
  | { kind: 'build'; slug: string; data: BuildArchive | null }
  | { kind: 'discussion'; slug: string; data: DiscussionArchive | null };

export function HistoryView() {
  const { builds, discussions, loading } = useHistory();
  const [selected, setSelected] = useState<Selection>(null);
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);

  // Fetch content when selection changes. setState runs in the .then() callback
  // (post-await), satisfying react-hooks/set-state-in-effect. Loading state is
  // derived from (selected vs loaded) rather than synced via a separate flag.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const fetcher = selected.kind === 'build'
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
    return () => { cancelled = true; };
  }, [selected]);

  const contentMatchesSelection =
    selected !== null
    && loaded !== null
    && loaded.kind === selected.kind
    && loaded.slug === selected.slug;
  const contentLoading = selected !== null && !contentMatchesSelection;
  const buildContent = contentMatchesSelection && loaded!.kind === 'build'
    ? (loaded!.data as BuildArchive | null) : null;
  const discussionContent = contentMatchesSelection && loaded!.kind === 'discussion'
    ? (loaded!.data as DiscussionArchive | null) : null;

  return (
    <div className="flex h-full bg-white text-[#262626]">
      {/* Left rail */}
      <aside
        className="shrink-0 flex flex-col h-full"
        style={{
          width: 320,
          borderRight: '1px solid #bbbbbb',
        }}
      >
        <div className="shrink-0" style={{ padding: '48px 32px 24px' }}>
          <h1
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 300,
              lineHeight: 1.3,
              letterSpacing: '0.05em',
            }}
          >
            Archive
          </h1>
          <p
            className="uppercase"
            style={{
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.15em',
              color: '#757575',
              marginTop: 8,
            }}
          >
            Read-only · {builds.length + discussions.length} {builds.length + discussions.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 32 }}>
          <RailSection
            title="Builds"
            entries={builds}
            kind="build"
            selected={selected}
            onSelect={setSelected}
            empty={loading ? 'Loading…' : 'No builds yet.'}
          />
          <RailSection
            title="Discussions"
            entries={discussions}
            kind="discussion"
            selected={selected}
            onSelect={setSelected}
            empty={loading ? 'Loading…' : 'No discussions yet.'}
          />
        </div>
      </aside>

      {/* Right pane */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
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
    <div style={{ marginBottom: 24 }}>
      <p
        className="uppercase"
        style={{
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: '#757575',
          padding: '0 32px 8px',
        }}
      >
        {title}
      </p>
      {entries.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: '#bbbbbb',
            padding: '0 32px 16px',
          }}
        >
          {empty}
        </p>
      ) : (
        entries.map((entry) => {
          const isActive = selected?.kind === kind && selected.slug === entry.slug;
          return (
            <button
              key={`${kind}:${entry.slug}`}
              onClick={() => onSelect({ kind, slug: entry.slug } as Selection)}
              className={clsx(
                'block w-full text-left transition-colors',
                isActive ? 'bg-[#f5f5f5]' : 'hover:bg-[#f5f5f5]',
              )}
              style={{
                padding: '12px 32px',
                borderLeft: isActive ? '2px solid #1c69d4' : '2px solid transparent',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#262626',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.slug}
              </div>
              <div
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  letterSpacing: '0.1em',
                  color: '#757575',
                  marginTop: 2,
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

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p
        className="uppercase"
        style={{
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: '#bbbbbb',
        }}
      >
        Select an entry to view
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p
        className="uppercase"
        style={{
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: '#757575',
        }}
      >
        Loading…
      </p>
    </div>
  );
}

function BuildArchiveView({ slug, archive }: { slug: string; archive: BuildArchive | null }) {
  if (!archive) return <ErrorState />;
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '48px 60px' }}>
      <header style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #bbbbbb' }}>
        <h1
          className="uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 48,
            fontWeight: 300,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
          }}
        >
          {slug}
        </h1>
        <p
          className="uppercase"
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '0.15em',
            color: '#757575',
            marginTop: 8,
          }}
        >
          Build archive · Build-History/{slug}/
        </p>
      </header>

      <ArchiveSection label="Plan.md" body={archive.plan} />
      <ArchiveSection label="Build-Log.md" body={archive.buildLog} />
      <ArchiveSection label="Build-Feedback.md" body={archive.buildFeedback} />
    </div>
  );
}

function DiscussionArchiveView({ slug, archive }: { slug: string; archive: DiscussionArchive | null }) {
  if (!archive) return <ErrorState />;
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '48px 60px' }}>
      <header style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #bbbbbb' }}>
        <h1
          className="uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 48,
            fontWeight: 300,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
          }}
        >
          {slug}
        </h1>
        <p
          className="uppercase"
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '0.15em',
            color: '#757575',
            marginTop: 8,
          }}
        >
          Discussion archive · WarZone-History/{slug}/WarZone.md
        </p>
      </header>

      <ArchiveSection label="WarZone.md" body={archive.warzone} />
    </div>
  );
}

function ArchiveSection({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(true);
  const isEmpty = !body.trim();
  return (
    <section style={{ marginBottom: 32 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="block w-full text-left uppercase"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: '#262626',
          padding: '12px 0',
          borderBottom: '1px solid #bbbbbb',
          background: 'transparent',
          marginBottom: 16,
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <div className="markdown-body">
          {isEmpty ? (
            <p style={{ fontSize: 14, color: '#757575', fontStyle: 'italic' }}>
              (file not present in this archive)
            </p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {body}
            </ReactMarkdown>
          )}
        </div>
      )}
    </section>
  );
}

function ErrorState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p style={{ fontSize: 14, color: '#757575' }}>Failed to load archive.</p>
    </div>
  );
}
