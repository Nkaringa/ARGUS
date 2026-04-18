import type { HistoryItem } from '../../types';

interface LogsViewProps {
  history: HistoryItem[];
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const date = new Date(item.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="flex items-start justify-between"
      style={{
        padding: '22px 0',
        borderBottom: '1px solid var(--color-ink-3)',
        gap: 32,
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.45,
            color: 'var(--color-fg-0)',
            margin: 0,
          }}
        >
          {item.description}
        </p>
        <div
          className="flex items-center"
          style={{ gap: 24, marginTop: 10 }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.15em',
              color: 'var(--color-fg-2)',
            }}
          >
            {item.status}
          </span>
          {item.iterations > 0 && (
            <span
              className="uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--color-fg-2)',
              }}
            >
              {item.iterations} Iteration{item.iterations !== 1 ? 's' : ''}
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--color-fg-2)',
            }}
          >
            {date}
          </span>
        </div>
      </div>
      {item.grade && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color:
              item.grade === 'A' ? 'var(--color-accent)' : 'var(--color-fg-0)',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {item.grade}
        </span>
      )}
    </div>
  );
}

export function LogsView({ history }: LogsViewProps) {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--color-ink-0)',
        color: 'var(--color-fg-0)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          padding: '40px 60px 28px',
          borderBottom: '1px solid var(--color-ink-3)',
        }}
      >
        <p
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: 'var(--color-accent)',
            marginBottom: 10,
          }}
        >
          History
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 44,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--color-fg-0)',
          }}
        >
          Logs
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--color-fg-1)',
            marginTop: 8,
          }}
        >
          {history.length} task{history.length !== 1 ? 's' : ''} completed.
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 60px' }}>
        {history.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            style={{ gap: 12 }}
          >
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 20,
                fontWeight: 400,
                color: 'var(--color-fg-1)',
                margin: 0,
              }}
            >
              No completed tasks yet.
            </p>
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-fg-2)',
                letterSpacing: '0.15em',
                margin: 0,
              }}
            >
              Finished builds will appear here
            </p>
          </div>
        ) : (
          [...history].reverse().map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
