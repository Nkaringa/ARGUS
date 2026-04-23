import type { Components } from 'react-markdown';

// Shared markdown styling for agent-authored content (DiscussionReview, HistoryView).
// Retuned for the dark terminal theme: bone ink on near-black, acid-lime accent for
// links, bg-3 for code surfaces. Strong content hierarchy via weight + size, not color.
const baseText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  color: 'var(--ink)',
};

export const markdownComponents: Components = {
  h1: (props) => (
    <h3
      style={{
        ...baseText,
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '20px 0 10px',
        color: 'var(--ink)',
      }}
      {...props}
    />
  ),
  h2: (props) => (
    <h4
      style={{
        ...baseText,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '18px 0 8px',
        color: 'var(--ink)',
      }}
      {...props}
    />
  ),
  h3: (props) => (
    <h5
      style={{
        ...baseText,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '16px 0 6px',
        color: 'var(--ink)',
      }}
      {...props}
    />
  ),
  h4: (props) => (
    <h6
      style={{
        ...baseText,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '14px 0 6px',
        color: 'var(--ink)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
      {...props}
    />
  ),
  p: (props) => (
    <p
      style={{
        ...baseText,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
      }}
      {...props}
    />
  ),
  ul: (props) => (
    <ul
      style={{
        ...baseText,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
        paddingLeft: 20,
      }}
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      style={{
        ...baseText,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
        paddingLeft: 20,
      }}
      {...props}
    />
  ),
  li: (props) => <li style={{ marginBottom: 4 }} {...props} />,
  strong: (props) => <strong style={{ fontWeight: 700, color: 'var(--ink)' }} {...props} />,
  em: (props) => <em style={{ fontStyle: 'italic', color: 'var(--ink)' }} {...props} />,
  a: (props) => (
    <a
      style={{
        color: 'var(--accent)',
        textDecoration: 'none',
        borderBottom: '1px solid var(--accent)',
      }}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ children, className, ...rest }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code
          className={className}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            color: 'var(--ink)',
          }}
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          background: 'var(--bg-3)',
          color: 'var(--accent)',
          padding: '1px 6px',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          border: '1px solid var(--rule)',
        }}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      style={{
        background: 'var(--bg-3)',
        color: 'var(--ink)',
        border: '1px solid var(--rule)',
        padding: '14px 16px',
        overflowX: 'auto',
        fontSize: 12.5,
        lineHeight: 1.55,
        margin: '0 0 14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      style={{
        borderLeft: '2px solid var(--accent)',
        paddingLeft: 14,
        margin: '0 0 12px',
        color: 'var(--ink-dim)',
        fontSize: 13,
        lineHeight: 1.6,
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px dashed var(--rule)',
        margin: '20px 0',
      }}
    />
  ),
  table: (props) => (
    <div style={{ overflowX: 'auto', marginBottom: 14 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 12.5,
          ...baseText,
        }}
        {...props}
      />
    </div>
  ),
  th: (props) => (
    <th
      style={{
        textAlign: 'left',
        padding: '6px 10px',
        borderBottom: '1px solid var(--rule)',
        fontWeight: 700,
        color: 'var(--ink-dimmer)',
        textTransform: 'uppercase',
        fontSize: 10,
        letterSpacing: '0.12em',
      }}
      {...props}
    />
  ),
  td: (props) => (
    <td
      style={{
        padding: '6px 10px',
        borderBottom: '1px dashed var(--rule)',
        color: 'var(--ink)',
      }}
      {...props}
    />
  ),
};
