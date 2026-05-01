import { useEffect, useState, type ChangeEvent } from 'react';
import type { HistoryItem, TaskDetail } from '../../types';
import { SERVERS, authHeaders } from '../../config';
import { useLogsHistory } from '../../hooks/useLogsHistory';

// Format timestamp as "Apr 23 · 14:22" so the table stays compact while still
// carrying enough context to orient a task against memory.
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

// Wall-clock duration as "Xm YYs" or "Ys". Returns "—" for tasks that haven't
// completed (running) or completed_at missing (stale rows from old DB rows).
function formatWall(item: HistoryItem): string {
  if (!item.completed_at) return '—';
  const start = new Date(item.created_at).getTime();
  const end = new Date(item.completed_at).getTime();
  const total = Math.max(0, Math.floor((end - start) / 1000));
  if (!Number.isFinite(total)) return '—';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// Status values come from hermes.db tasks.status (RUNNING / DONE / STALE / ABORTED).
function statusKey(s: string): 'done' | 'running' | 'stale' | 'aborted' | 'other' {
  const u = s.toUpperCase();
  if (u === 'DONE')    return 'done';
  if (u === 'RUNNING') return 'running';
  if (u === 'STALE')   return 'stale';
  if (u === 'ABORTED') return 'aborted';
  return 'other';
}

function statusColor(s: string): string {
  switch (statusKey(s)) {
    case 'done':    return 'var(--accent)';
    case 'running': return 'var(--gemini)';
    case 'stale':   return 'var(--warn)';
    case 'aborted': return 'var(--warn)';
    default:        return 'var(--ink-dim)';
  }
}

function gradeColor(g: string | null | undefined): string {
  if (!g) return 'var(--ink-dimmer)';
  const u = g.toUpperCase();
  if (u === 'A') return 'var(--accent)';
  if (u === 'B') return 'var(--ink)';
  if (u === 'C' || u === 'F') return 'var(--warn)';
  return 'var(--ink-dimmer)';
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'DONE',    label: 'done' },
  { key: 'RUNNING', label: 'running' },
  { key: 'STALE',   label: 'stale' },
  { key: 'ABORTED', label: 'aborted' },
];
const GRADE_FILTERS: { key: string; label: string }[] = [
  { key: 'A',    label: 'A' },
  { key: 'B',    label: 'B' },
  { key: 'C',    label: 'C' },
  { key: 'F',    label: 'F' },
  { key: 'NONE', label: 'none' },
];

/* ────────────────────────────── hero ────────────────────────────── */

function HeroCard({ total }: { total: number }) {
  return (
    <section
      style={{
        marginTop: 20,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '22px 26px',
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
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          // build pipeline history · live from hermes.db
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.8vw, 56px)',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            marginTop: 10,
            color: 'var(--ink)',
          }}
        >
          logs
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
        <Stat label="tasks" value={String(total)} />
        <Stat label="source" value="tasks table" mono />
      </div>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-body)' : 'var(--font-display)',
          fontSize: mono ? 14 : 20,
          fontWeight: 500,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ────────────────────────────── filter bar ────────────────────────────── */

function FilterBar({
  search,
  status,
  grade,
  onSearch,
  onToggleStatus,
  onToggleGrade,
  onClear,
}: {
  search: string;
  status: Set<string>;
  grade: Set<string>;
  onSearch: (q: string) => void;
  onToggleStatus: (s: string) => void;
  onToggleGrade: (g: string) => void;
  onClear: () => void;
}) {
  const hasAnyFilter = search.trim().length > 0 || status.size > 0 || grade.size > 0;
  return (
    <section
      style={{
        marginTop: 18,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Search input — full-width, debounced via the hook. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>$</span>
        <input
          type="text"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
          placeholder="search task description..."
          style={{
            flex: 1,
            fontSize: 13,
            color: 'var(--ink)',
            background: 'var(--bg-3)',
            border: '1px solid var(--rule)',
            padding: '8px 12px',
            outline: 'none',
          }}
        />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
              background: 'transparent',
              border: '1px solid var(--rule)',
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            clear filters
          </button>
        )}
      </div>

      {/* Chip rows — state and grade. Multi-select pills (OR-within-category). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <FilterGroupLabel>state</FilterGroupLabel>
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s.key}
            on={status.has(s.key)}
            onClick={() => onToggleStatus(s.key)}
            label={s.label}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <FilterGroupLabel>grade</FilterGroupLabel>
        {GRADE_FILTERS.map((g) => (
          <FilterChip
            key={g.key}
            on={grade.has(g.key)}
            onClick={() => onToggleGrade(g.key)}
            label={g.label}
          />
        ))}
      </div>
    </section>
  );
}

function FilterGroupLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        color: 'var(--ink-dimmer)',
        textTransform: 'uppercase',
        marginRight: 4,
      }}
    >
      {children}
    </span>
  );
}

function FilterChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`,
        background: on ? 'var(--accent-tint)' : 'var(--bg-3)',
        color: on ? 'var(--accent)' : 'var(--ink-dim)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          border: `1px solid ${on ? 'var(--accent)' : 'var(--ink-dimmer)'}`,
          background: on ? 'var(--accent)' : 'transparent',
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
}

/* ────────────────────────────── log table ────────────────────────────── */

const TABLE_COLUMNS = '60px 140px 90px 1fr 60px 110px 60px';

function LogTable({ items }: { items: HistoryItem[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (items.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginBottom: 8,
          }}
        >
          no tasks match
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          adjust the filters above or clear them
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLUMNS }}>
      <HeaderCell>id</HeaderCell>
      <HeaderCell>when</HeaderCell>
      <HeaderCell>wall</HeaderCell>
      <HeaderCell>task</HeaderCell>
      <HeaderCell style={{ justifyContent: 'flex-end' }}>iter</HeaderCell>
      <HeaderCell>state</HeaderCell>
      <HeaderCell style={{ justifyContent: 'center' }}>grade</HeaderCell>

      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <Row
            key={item.id}
            item={item}
            isOpen={isOpen}
            onToggle={() => setOpenId(isOpen ? null : item.id)}
          />
        );
      })}
    </div>
  );
}

function HeaderCell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--rule)',
        fontSize: 10,
        letterSpacing: '0.14em',
        color: 'var(--ink-dimmer)',
        textTransform: 'uppercase',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  item,
  isOpen,
  onToggle,
}: {
  item: HistoryItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // display: contents lets each row's cells participate in the parent grid.
  // Row state (open/closed) lives on the Row itself rather than per-cell so
  // we can apply the open-row background uniformly via the cell style prop.
  const cellBg = isOpen ? 'var(--bg-3)' : undefined;
  return (
    <>
      <div style={{ display: 'contents' }} onClick={onToggle}>
        {/* Task id rendered in the accent color to signal "this row has more —
            click for metadata." Whole row is still clickable; the id is just
            the visual affordance. */}
        <Cell tabular bg={cellBg} style={{ color: 'var(--accent)', fontWeight: 500 }}>
          #{item.id}
        </Cell>
        <Cell muted tabular bg={cellBg}>{formatWhen(item.created_at)}</Cell>
        <Cell muted tabular bg={cellBg}>{formatWall(item)}</Cell>
        <Cell bg={cellBg}>
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              lineClamp: 2 as unknown as string,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: 'var(--ink)',
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
            title={item.description}
          >
            {item.description}
          </span>
        </Cell>
        <Cell muted tabular bg={cellBg} style={{ justifyContent: 'flex-end' }}>
          {item.iterations > 0 ? item.iterations : '—'}
        </Cell>
        <Cell bg={cellBg}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: statusColor(item.status),
            }}
          >
            {item.status.toLowerCase()}
          </span>
        </Cell>
        <Cell bg={cellBg} style={{ justifyContent: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              color: gradeColor(item.grade),
              lineHeight: 1,
            }}
          >
            {item.grade ?? '—'}
          </span>
        </Cell>
      </div>
      {isOpen && <RowDetail taskId={item.id} />}
    </>
  );
}

function Cell({
  children,
  muted,
  tabular,
  style,
  bg,
}: {
  children: React.ReactNode;
  muted?: boolean;
  tabular?: boolean;
  style?: React.CSSProperties;
  bg?: string;
}) {
  return (
    <div
      style={{
        padding: '12px 18px',
        borderBottom: '1px dashed var(--rule)',
        fontSize: 12,
        color: muted ? 'var(--ink-dim)' : 'var(--ink)',
        fontVariantNumeric: tabular ? 'tabular-nums' : 'normal',
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        cursor: 'pointer',
        background: bg,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── row detail (lazy) ────────────────────────────── */

function RowDetail({ taskId }: { taskId: number }) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Lazy-fetch on mount. The Row only mounts RowDetail when isOpen is true,
  // so this fires exactly when the user expands a row. Cancellation guard
  // prevents a stale fetch from setState'ing into an unmounted component.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${SERVERS.build.http}/tasks/${taskId}/detail`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || `Request failed (${res.status})`);
          return;
        }
        setDetail(body as TaskDetail);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [taskId]);

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        padding: '18px 22px 22px',
        background: 'var(--bg-3)',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      {loading && (
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-dimmer)', textTransform: 'uppercase' }}>
          loading detail…
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--warn)' }}>could not load detail: {error}</div>
      )}
      {detail && <DetailGrid detail={detail} />}
    </div>
  );
}

function DetailGrid({ detail }: { detail: TaskDetail }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '22px 36px' }}>
      {/* META — slug, mode, auto-approve flag + cap, plan-review flag. */}
      <DetailSection full label="meta">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {detail.slug && (
            <Chip
              label={detail.slug}
              fontFamily="var(--font-body)"
              bg="var(--accent)"
              color="var(--accent-ink)"
              border="var(--accent)"
              uppercase={false}
            />
          )}
          {detail.mode && (
            <Chip
              label={detail.mode === 'continue' ? 'continuation' : 'new project'}
              color={detail.mode === 'continue' ? 'var(--gemini)' : 'var(--accent)'}
              border={detail.mode === 'continue' ? 'var(--gemini)' : 'var(--accent-dim)'}
            />
          )}
          {detail.autoApprove ? (
            <Chip
              label={`auto-approve · cap ${detail.autoApproveCap ?? '?'}`}
              color="var(--accent)"
              border="var(--accent-dim)"
            />
          ) : (
            <Chip label="auto-approve · off" color="var(--ink-dimmer)" border="var(--rule)" />
          )}
          {detail.planReview ? (
            <Chip label="plan-review · on" color="var(--accent)" border="var(--accent-dim)" />
          ) : (
            <Chip label="plan-review · off" color="var(--ink-dimmer)" border="var(--rule)" />
          )}
        </div>
      </DetailSection>

      {/* ITERATION TRAIL — every iteration's grade as a pill, final pill emphasized. */}
      <DetailSection label="iteration trail">
        {detail.gradeTrail.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--ink-dimmer)', fontStyle: 'italic' }}>
            no graded iterations yet
          </span>
        ) : (
          <IterTrail trail={detail.gradeTrail} />
        )}
      </DetailSection>

      {/* AGENT BREAKDOWN — total durationMs per agent, summed across all iterations. */}
      <DetailSection label="agent breakdown · total">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <AgentTime name="claude" color="var(--claude)" ms={detail.agentTotals.claude} />
          <AgentTime name="gemini" color="var(--gemini)" ms={detail.agentTotals.gemini} />
          <AgentTime name="codex"  color="var(--codex)"  ms={detail.agentTotals.codex} />
        </div>
      </DetailSection>

      {/* FILES WRITTEN — final size of each meta file produced by the run. */}
      {detail.files.length > 0 && (
        <DetailSection full label="files written">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {detail.files.map((f) => (
              <span
                key={f.role}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  color: 'var(--ink)',
                }}
              >
                {f.name}
                <span style={{ color: 'var(--ink-dimmer)', marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(f.sizeBytes)}
                </span>
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* FAILURES — only shown when any agent.failed events were recorded. */}
      {detail.failures.length > 0 && (
        <DetailSection full label="failures">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail.failures.map((f, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  color: 'var(--warn)',
                }}
              >
                {f.role && <b style={{ fontWeight: 600 }}>{f.role}</b>}
                {f.role && f.error ? ' · ' : ''}
                {f.error || '(no detail)'}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* TRUNCATED notice — appears only when the event scan hit the safety cap. */}
      {detail.truncated && (
        <DetailSection full label="">
          <span style={{ fontSize: 11, color: 'var(--warn)', fontStyle: 'italic' }}>
            event scan truncated at 1000 entries — counts may be partial
          </span>
        </DetailSection>
      )}
    </div>
  );
}

function DetailSection({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      style={{
        gridColumn: full ? '1 / -1' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Chip({
  label,
  color,
  border,
  bg,
  fontFamily,
  uppercase = true,
}: {
  label: string;
  color: string;
  border: string;
  bg?: string;
  fontFamily?: string;
  uppercase?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        border: `1px solid ${border}`,
        background: bg ?? 'transparent',
        fontSize: 10,
        letterSpacing: uppercase ? '0.1em' : '0.04em',
        textTransform: uppercase ? 'uppercase' : 'none',
        fontFamily: fontFamily ?? 'inherit',
        color,
      }}
    >
      {label}
    </span>
  );
}

function IterTrail({ trail }: { trail: { iteration: number; grade: string }[] }) {
  // Final iteration is the highest-iteration entry — emphasized via the `final`
  // styling so the resting grade reads at a glance even with a long trail.
  const finalIter = trail.reduce((m, t) => Math.max(m, t.iteration), 0);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {trail.map((t, idx) => (
        <span key={`${t.iteration}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {idx > 0 && <span style={{ color: 'var(--rule-hot)', fontSize: 12 }}>→</span>}
          <IterPill iteration={t.iteration} grade={t.grade} final={t.iteration === finalIter} />
        </span>
      ))}
    </div>
  );
}

function IterPill({
  iteration,
  grade,
  final,
}: {
  iteration: number;
  grade: string;
  final: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 36,
        padding: '5px 8px',
        border: `1px solid ${final ? 'var(--accent)' : 'var(--rule-hot)'}`,
        background: final ? 'var(--accent-tint)' : 'var(--bg)',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          color: final ? 'var(--accent)' : 'var(--ink-dimmer)',
          marginBottom: 3,
          textTransform: 'uppercase',
        }}
      >
        iter {iteration}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: gradeColor(grade),
        }}
      >
        {grade}
      </span>
    </span>
  );
}

function AgentTime({ name, color, ms }: { name: string; color: string; ms: number }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--ink)' }}>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color,
          marginRight: 8,
        }}
      >
        {name}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-dim)' }}>
        {ms > 0 ? formatMs(ms) : '—'}
      </span>
    </div>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export function LogsView() {
  const {
    items,
    total,
    loading,
    error,
    hasMore,
    filters,
    setSearch,
    toggleStatus,
    toggleGrade,
    clearFilters,
    loadMore,
  } = useLogsHistory();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 24px 24px',
        background: 'var(--bg)',
        color: 'var(--ink)',
        minHeight: 0,
      }}
    >
      <HeroCard total={total} />

      <FilterBar
        search={filters.search}
        status={filters.status}
        grade={filters.grade}
        onSearch={setSearch}
        onToggleStatus={toggleStatus}
        onToggleGrade={toggleGrade}
        onClear={clearFilters}
      />

      <div
        style={{
          marginTop: 18,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--rule)',
          background: 'var(--bg-2)',
        }}
      >
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--rule)',
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: 'var(--accent)' }}>▸</span>
          tasks · recent first
          <span style={{ marginLeft: 'auto', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>
            showing <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{items.length}</b> of {total}
          </span>
        </div>
        {/* Hint row — clarifies the click-to-expand affordance signaled by the
            accent-colored task id. Dashed bottom border separates the hint
            from the table header below without making it feel like its own
            section. */}
        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px dashed var(--rule)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            background: 'var(--bg)',
          }}
        >
          click <b style={{ color: 'var(--accent)', fontWeight: 500 }}>#task id</b> or any row to expand task metadata
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '20px 24px', color: 'var(--warn)', fontSize: 12 }}>
              could not load history: {error}
            </div>
          )}
          <LogTable items={items} />
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 18px' }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-dim)',
                  background: 'transparent',
                  border: '1px solid var(--rule)',
                  padding: '8px 14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (loading) return;
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  if (loading) return;
                  e.currentTarget.style.color = 'var(--ink-dim)';
                  e.currentTarget.style.borderColor = 'var(--rule)';
                }}
              >
                {loading ? 'loading…' : `load 20 older →`}
              </button>
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '14px 18px',
                fontSize: 10,
                letterSpacing: '0.14em',
                color: 'var(--ink-dimmer)',
                textTransform: 'uppercase',
              }}
            >
              no more tasks · refresh the page to reset filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
