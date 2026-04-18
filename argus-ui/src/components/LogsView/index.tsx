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
      style={{ padding: '24px 0', borderBottom: '1px solid #bbbbbb', gap: 32 }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.3,
            color: '#262626',
          }}
        >
          {item.description}
        </p>
        <div className="flex items-center" style={{ gap: 24, marginTop: 12 }}>
          <span
            className="uppercase"
            style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.15em', color: '#757575' }}
          >
            {item.status}
          </span>
          {item.iterations > 0 && (
            <span
              className="uppercase"
              style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.15em', color: '#757575' }}
            >
              {item.iterations} Iteration{item.iterations !== 1 ? 's' : ''}
            </span>
          )}
          <span
            style={{ fontSize: 14, fontWeight: 400, color: '#757575' }}
          >
            {date}
          </span>
        </div>
      </div>
      {item.grade && (
        <span
          className="uppercase"
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: item.grade === 'A' ? '#1c69d4' : '#262626',
            minWidth: 32,
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
    <div className="flex flex-col h-full bg-white text-[#262626]">
      {/* Header */}
      <div className="shrink-0" style={{ padding: '48px 60px 32px', borderBottom: '1px solid #bbbbbb' }}>
        <h1
          className="uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 60,
            fontWeight: 300,
            lineHeight: 1.3,
            letterSpacing: '0.02em',
          }}
        >
          Logs
        </h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: '#757575', marginTop: 8 }}>
          {history.length} task{history.length !== 1 ? 's' : ''} completed
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 60px' }}>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ gap: 16 }}>
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 300,
                letterSpacing: '0.02em',
                color: '#262626',
              }}
            >
              No Completed Tasks Yet
            </p>
            <p
              className="uppercase"
              style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}
            >
              Finished builds will appear here
            </p>
          </div>
        ) : (
          [...history].reverse().map((item) => <HistoryRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
