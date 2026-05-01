import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHistory, fetchBuildArchive, fetchDiscussionArchive } from '../../hooks/useHistory';
import { markdownComponents } from '../shared/markdownComponents';
import type { BuildArchive, DiscussionArchive, HistoryEntry } from '../../types';

type SectionKind = 'builds' | 'discussions';
type Selection =
  | { kind: 'build'; slug: string }
  | { kind: 'discussion'; slug: string }
  | null;
type LoadedContent =
  | { kind: 'build'; slug: string; data: BuildArchive | null }
  | { kind: 'discussion'; slug: string; data: DiscussionArchive | null };

// Build-archive file tabs. Discussion archives only have the single WarZone.md
// tab so they don't get a per-tab union — handled inline.
type BuildTab = 'plan' | 'buildLog' | 'buildFeedback';

function formatDate(mtime: number): string {
  return new Date(mtime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Compact "Apr 30" / "3h ago" — matches the rail's space budget.
function formatAge(mtime: number): string {
  const diffMs = Date.now() - mtime;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function bytesOf(text: string): number {
  return new Blob([text]).size;
}
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/* ────────────────────────────── main view ────────────────────────────── */

export function HistoryView() {
  const { builds, discussions, loading } = useHistory();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<SectionKind>('builds');
  const [selected, setSelected] = useState<Selection>(null);
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);
  // Active build tab — only meaningful when a build archive is selected.
  // Resets to 'plan' on each new build selection so the user lands on the
  // spec first, not whatever tab they were on for a different slug.
  const [buildTab, setBuildTab] = useState<BuildTab>('plan');

  // Fetch archive content when selection changes. Same pattern as the prior
  // implementation — cancellation guard prevents stale responses from clobbering
  // a fresh selection's content.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    if (selected.kind === 'build') setBuildTab('plan');
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
    return () => { cancelled = true; };
  }, [selected]);

  // Filtered + sorted lists per the search input. Search matches anywhere in
  // the slug substring, case-insensitive. Sort newest-first by mtime.
  const filteredBuilds = useMemo(
    () => filterAndSort(builds, search),
    [builds, search],
  );
  const filteredDiscussions = useMemo(
    () => filterAndSort(discussions, search),
    [discussions, search],
  );

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
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        background: 'var(--bg)',
        color: 'var(--ink)',
        minHeight: 0,
      }}
    >
      {/* Left rail — filter + entry list */}
      <Rail
        loading={loading}
        section={section}
        onSection={setSection}
        search={search}
        onSearch={setSearch}
        builds={filteredBuilds}
        discussions={filteredDiscussions}
        totalBuilds={builds.length}
        totalDiscussions={discussions.length}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Right pane */}
      <main
        style={{
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
          <BuildArchiveView
            slug={selected.slug}
            archive={buildContent}
            mtime={builds.find((b) => b.slug === selected.slug)?.mtime ?? 0}
            tab={buildTab}
            onTab={setBuildTab}
          />
        ) : (
          <DiscussionArchiveView
            slug={selected.slug}
            archive={discussionContent}
            mtime={discussions.find((d) => d.slug === selected.slug)?.mtime ?? 0}
          />
        )}
      </main>
    </div>
  );
}

function filterAndSort(entries: HistoryEntry[], search: string): HistoryEntry[] {
  const q = search.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.slug.toLowerCase().includes(q)) : entries;
  // hooks return oldest→newest; reverse once for newest-first display.
  return [...filtered].reverse();
}

/* ────────────────────────────── rail ────────────────────────────── */

function Rail({
  loading,
  section,
  onSection,
  search,
  onSearch,
  builds,
  discussions,
  totalBuilds,
  totalDiscussions,
  selected,
  onSelect,
}: {
  loading: boolean;
  section: SectionKind;
  onSection: (s: SectionKind) => void;
  search: string;
  onSearch: (q: string) => void;
  builds: HistoryEntry[];
  discussions: HistoryEntry[];
  totalBuilds: number;
  totalDiscussions: number;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const visible = section === 'builds' ? builds : discussions;
  const totalVisible = section === 'builds' ? totalBuilds : totalDiscussions;
  return (
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
      {/* Head */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--rule)' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          // read-only · {totalBuilds + totalDiscussions} archives
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
      </div>

      {/* Filter bar — search + segmented toggle */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px dashed var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>$</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="search slug..."
            style={{
              flex: 1,
              fontSize: 12,
              color: 'var(--ink)',
              background: 'var(--bg-3)',
              border: '1px solid var(--rule)',
              padding: '6px 10px',
              outline: 'none',
            }}
          />
        </div>
        <SegmentedToggle
          value={section}
          onChange={onSection}
          options={[
            { key: 'builds', label: `builds (${totalBuilds})` },
            { key: 'discussions', label: `discussions (${totalDiscussions})` },
          ]}
        />
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        {loading && visible.length === 0 ? (
          <RailMessage>loading…</RailMessage>
        ) : visible.length === 0 ? (
          <RailMessage>
            {search.trim()
              ? 'no matches.'
              : section === 'builds'
                ? 'no builds yet.'
                : 'no discussions yet.'}
          </RailMessage>
        ) : (
          visible.map((entry) => (
            <RailEntry
              key={`${section}:${entry.slug}`}
              entry={entry}
              active={
                selected?.kind === (section === 'builds' ? 'build' : 'discussion') &&
                selected.slug === entry.slug
              }
              onClick={() =>
                onSelect({ kind: section === 'builds' ? 'build' : 'discussion', slug: entry.slug })
              }
            />
          ))
        )}
        {totalVisible > 0 && visible.length > 0 && search.trim() && (
          <div
            style={{
              padding: '8px 18px',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
            }}
          >
            {visible.length} of {totalVisible} match
          </div>
        )}
      </div>
    </aside>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--rule)' }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              padding: '5px 10px',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: active ? 'var(--accent-ink)' : 'var(--ink-dim)',
              background: active ? 'var(--accent)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = 'var(--ink-dim)';
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RailMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--ink-dimmer)',
        padding: '12px 18px',
        fontStyle: 'italic',
      }}
    >
      {children}
    </div>
  );
}

function RailEntry({
  entry,
  active,
  onClick,
}: {
  entry: HistoryEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 18px',
        background: active ? 'var(--bg-2)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-2)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ink)',
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
          color: active ? 'var(--accent)' : 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatAge(entry.mtime)}
      </div>
    </button>
  );
}

/* ────────────────────────────── right pane states ────────────────────────────── */

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

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--warn)' }}>{message}</span>
    </div>
  );
}

/* ────────────────────────────── metadata strip ────────────────────────────── */

// Header above the file tabs. Shows the breadcrumb + slug pill + agent identity
// chips inferred from which files are present in the archive (Plan.md ⇒ claude
// ran, Build-Log.md ⇒ gemini, Build-Feedback.md ⇒ codex, WarZone.md ⇒ all three).
// No DB join — pure inference from on-disk files, single source of truth.
function MetadataStrip({
  slug,
  kind,
  mtime,
  agents,
}: {
  slug: string;
  kind: 'build' | 'discussion';
  mtime: number;
  agents: { claude: boolean; gemini: boolean; codex: boolean };
}) {
  return (
    <header
      style={{
        padding: '18px 26px',
        borderBottom: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            color: 'var(--ink-dimmer)',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}
        >
          <span style={{ color: 'var(--ink)' }}>archive</span>
          <span style={{ color: 'var(--rule-hot)' }}>/</span>
          <span style={{ color: 'var(--accent)' }}>{kind}</span>
          <span style={{ color: 'var(--rule-hot)' }}>·</span>
          <span>sealed {formatDate(mtime)}</span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
            margin: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            flexWrap: 'wrap',
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

      {/* Agents involved — chips colored by identity. Inferred from file presence:
          presence of Plan.md ⇒ claude ran, Build-Log.md ⇒ gemini, Build-Feedback.md ⇒ codex.
          Discussion archives have all three since WarZone.md is a 3-way debate. */}
      {(agents.claude || agents.gemini || agents.codex) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
            }}
          >
            agents
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {agents.claude && <AgentChip name="claude" color="var(--claude)" />}
            {agents.gemini && <AgentChip name="gemini" color="var(--gemini)" />}
            {agents.codex && <AgentChip name="codex" color="var(--codex)" />}
          </div>
        </div>
      )}
    </header>
  );
}

function AgentChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        border: `1px solid ${color}`,
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
        }}
      />
      {name}
    </span>
  );
}

/* ────────────────────────────── tab strip ────────────────────────────── */

function TabStrip<K extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: K; label: string; size: number; empty: boolean }[];
  active: K;
  onSelect: (k: K) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '0 26px',
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            disabled={t.empty}
            style={{
              padding: '10px 16px',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: t.empty ? 'var(--ink-dimmer)' : isActive ? 'var(--accent)' : 'var(--ink-dim)',
              background: 'transparent',
              border: 'none',
              cursor: t.empty ? 'not-allowed' : 'pointer',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: isActive ? 600 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (t.empty || isActive) return;
              e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              if (t.empty || isActive) return;
              e.currentTarget.style.color = 'var(--ink-dim)';
            }}
          >
            {isActive && <span style={{ color: 'var(--accent)' }}>▸</span>}
            {t.label}
            <span
              style={{
                color: t.empty
                  ? 'var(--ink-dimmer)'
                  : isActive
                    ? 'var(--accent)'
                    : 'var(--ink-dimmer)',
                fontWeight: 400,
                letterSpacing: '0.08em',
                fontStyle: t.empty ? 'italic' : 'normal',
                fontSize: t.empty ? 9 : 11,
              }}
            >
              {t.empty ? 'not present' : formatBytes(t.size)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── content body ────────────────────────────── */

function ContentBody({ body, empty }: { body: string; empty?: boolean }) {
  return (
    <div
      className="markdown-body"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '22px 30px 32px',
        color: 'var(--ink)',
        fontSize: 13,
        lineHeight: 1.6,
        minHeight: 0,
      }}
    >
      {empty ? (
        <p style={{ fontSize: 12, color: 'var(--ink-dimmer)', fontStyle: 'italic' }}>
          (file not present in this archive)
        </p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {body}
        </ReactMarkdown>
      )}
    </div>
  );
}

/* ────────────────────────────── per-archive views ────────────────────────────── */

function BuildArchiveView({
  slug,
  archive,
  mtime,
  tab,
  onTab,
}: {
  slug: string;
  archive: BuildArchive | null;
  mtime: number;
  tab: BuildTab;
  onTab: (t: BuildTab) => void;
}) {
  if (!archive) return <ErrorState message="failed to load archive." />;

  // Agent presence inferred from file presence — the implicit "who ran" signal
  // without a DB lookup. Empty file content (still present as empty string)
  // counts as a presence; missing files are sometimes empty-string anyway in
  // the BuildArchive shape, so we treat any non-empty body as positive evidence.
  const hasPlan = archive.plan.trim().length > 0;
  const hasBuildLog = archive.buildLog.trim().length > 0;
  const hasBuildFeedback = archive.buildFeedback.trim().length > 0;

  const tabs: { key: BuildTab; label: string; size: number; empty: boolean }[] = [
    { key: 'plan',           label: 'Plan.md',           size: bytesOf(archive.plan),          empty: !hasPlan },
    { key: 'buildLog',       label: 'Build-Log.md',      size: bytesOf(archive.buildLog),      empty: !hasBuildLog },
    { key: 'buildFeedback',  label: 'Build-Feedback.md', size: bytesOf(archive.buildFeedback), empty: !hasBuildFeedback },
  ];

  const activeBody =
    tab === 'plan' ? archive.plan :
    tab === 'buildLog' ? archive.buildLog :
    archive.buildFeedback;
  const activeEmpty =
    tab === 'plan' ? !hasPlan :
    tab === 'buildLog' ? !hasBuildLog :
    !hasBuildFeedback;

  return (
    <>
      <MetadataStrip
        slug={slug}
        kind="build"
        mtime={mtime}
        agents={{ claude: hasPlan, gemini: hasBuildLog, codex: hasBuildFeedback }}
      />
      <TabStrip tabs={tabs} active={tab} onSelect={onTab} />
      <ContentBody body={activeBody} empty={activeEmpty} />
    </>
  );
}

function DiscussionArchiveView({
  slug,
  archive,
  mtime,
}: {
  slug: string;
  archive: DiscussionArchive | null;
  mtime: number;
}) {
  if (!archive) return <ErrorState message="failed to load archive." />;
  const hasWarzone = archive.warzone.trim().length > 0;
  // Discussion archives are 3-way debates by definition — claude / gemini /
  // codex all participated. Show all three chips when the warzone file has
  // content; show none when it's empty.
  const agents = hasWarzone
    ? { claude: true, gemini: true, codex: true }
    : { claude: false, gemini: false, codex: false };

  return (
    <>
      <MetadataStrip slug={slug} kind="discussion" mtime={mtime} agents={agents} />
      <TabStrip
        tabs={[
          {
            key: 'warzone' as const,
            label: 'WarZone.md',
            size: bytesOf(archive.warzone),
            empty: !hasWarzone,
          },
        ]}
        active="warzone"
        onSelect={() => { /* single tab — no selection state needed */ }}
      />
      <ContentBody body={archive.warzone} empty={!hasWarzone} />
    </>
  );
}
