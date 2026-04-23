import type { HistoryItem } from '../../types';
import { Panel } from '../shared/Panel';

interface LogsViewProps {
  history: HistoryItem[];
}

// Format timestamp as "Apr 23 · 14:22" so the table stays compact while still
// carrying enough context to orient a task against memory.
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

// Status values come from hermes.db tasks.status (RUNNING / DONE / STALE / ABORTED).
// Color-code so a user can spot trouble rows (stale, aborted) without reading.
function statusStyle(status: string): { color: string; label: string } {
  const s = status.toUpperCase();
  if (s === 'DONE')    return { color: 'var(--accent)',  label: 'done' };
  if (s === 'RUNNING') return { color: 'var(--gemini)',  label: 'running' };
  if (s === 'STALE')   return { color: 'var(--warn)',    label: 'stale' };
  if (s === 'ABORTED') return { color: 'var(--warn)',    label: 'aborted' };
  return { color: 'var(--ink-dim)', label: s.toLowerCase() };
}

function gradeStyle(grade: string | null): { color: string; text: string } {
  if (!grade) return { color: 'var(--ink-dimmer)', text: '—' };
  const g = grade.toUpperCase();
  if (g === 'A') return { color: 'var(--accent)', text: 'A' };
  if (g === 'B') return { color: 'var(--ink)',    text: 'B' };
  if (g === 'C') return { color: 'var(--warn)',   text: 'C' };
  if (g === 'F') return { color: 'var(--warn)',   text: 'F' };
  return { color: 'var(--ink-dimmer)', text: g };
}

/* ────────────────────────────── breadcrumbs ────────────────────────────── */

function Breadcrumbs({ count }: { count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        paddingBottom: 14,
        borderBottom: '1px dashed var(--rule)',
        fontSize: 11,
        color: 'var(--ink-dimmer)',
        letterSpacing: '0.06em',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ color: 'var(--ink)' }}>history</span>
      <span style={{ color: 'var(--rule-hot)' }}>/</span>
      <span style={{ color: 'var(--accent)' }}>logs</span>
      <span style={{ color: 'var(--ink-dim)', fontSize: 10, marginLeft: 'auto' }}>
        {count} task{count === 1 ? '' : 's'} · source <b style={{ color: 'var(--accent)', fontWeight: 500 }}>sqlite WAL</b>
      </span>
    </div>
  );
}

/* ────────────────────────────── hero ────────────────────────────── */

function HeroCard({ count }: { count: number }) {
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
        <Stat label="tasks" value={String(count)} />
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

/* ────────────────────────────── log table ────────────────────────────── */

function LogTable({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
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
          no tasks yet
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          finished builds appear here
        </div>
      </div>
    );
  }

  // Newest first — hermes returns oldest→newest; reverse once here so the caller doesn't.
  const rows = [...history].reverse();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 140px 1fr 80px 120px 60px',
      }}
    >
      <HeaderCell>id</HeaderCell>
      <HeaderCell>when</HeaderCell>
      <HeaderCell>task</HeaderCell>
      <HeaderCell style={{ justifyContent: 'flex-end' }}>iter</HeaderCell>
      <HeaderCell>state</HeaderCell>
      <HeaderCell style={{ justifyContent: 'center' }}>grade</HeaderCell>

      {rows.map((item) => {
        const state = statusStyle(item.status);
        const grade = gradeStyle(item.grade);
        return (
          <Row key={item.id}>
            <Cell muted tabular>
              #{item.id}
            </Cell>
            <Cell muted tabular>
              {formatWhen(item.created_at)}
            </Cell>
            <Cell>
              <span
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
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
            <Cell muted tabular style={{ justifyContent: 'flex-end' }}>
              {item.iterations > 0 ? item.iterations : '—'}
            </Cell>
            <Cell>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: state.color,
                }}
              >
                {state.label}
              </span>
            </Cell>
            <Cell style={{ justifyContent: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  color: grade.color,
                  lineHeight: 1,
                }}
              >
                {grade.text}
              </span>
            </Cell>
          </Row>
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
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  // `display: contents` lets each row's children participate in the parent grid
  // while still grouping semantically. Hover highlight is handled below because
  // `display: contents` can't carry a :hover — so each cell handles its own.
  return <div style={{ display: 'contents' }}>{children}</div>;
}

function Cell({
  children,
  muted,
  tabular,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  tabular?: boolean;
  style?: React.CSSProperties;
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
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export function LogsView({ history }: LogsViewProps) {
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
      <Breadcrumbs count={history.length} />
      <HeroCard count={history.length} />

      <div style={{ marginTop: 18, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Panel fill headLabel="tasks · recent first" headRight="newest → oldest">
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <LogTable history={history} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
