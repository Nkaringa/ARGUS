import type { Components } from 'react-markdown';

// Shared markdown styling for any agent-authored content rendered in the BMW dashboard:
// Helvetica typography, zero radius, hairline borders, dark code blocks. Used by
// DiscussionReview (live warzone reviews) and HistoryView (archived builds + discussions).
const baseText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  color: '#262626',
};

export const markdownComponents: Components = {
  h1: (props) => (
    <h3
      style={{
        ...baseText,
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '20px 0 12px',
      }}
      {...props}
    />
  ),
  h2: (props) => (
    <h4
      style={{
        ...baseText,
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '20px 0 10px',
      }}
      {...props}
    />
  ),
  h3: (props) => (
    <h5
      style={{
        ...baseText,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '16px 0 8px',
      }}
      {...props}
    />
  ),
  h4: (props) => (
    <h6
      style={{
        ...baseText,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.3,
        margin: '14px 0 6px',
      }}
      {...props}
    />
  ),
  p: (props) => (
    <p
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.55,
        margin: '0 0 12px',
      }}
      {...props}
    />
  ),
  ul: (props) => (
    <ul
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.55,
        margin: '0 0 12px',
        paddingLeft: 24,
      }}
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.55,
        margin: '0 0 12px',
        paddingLeft: 24,
      }}
      {...props}
    />
  ),
  li: (props) => <li style={{ marginBottom: 4 }} {...props} />,
  strong: (props) => <strong style={{ fontWeight: 700, color: '#262626' }} {...props} />,
  em: (props) => <em style={{ fontStyle: 'italic' }} {...props} />,
  a: (props) => (
    <a
      style={{
        color: '#1c69d4',
        textDecoration: 'none',
        borderBottom: '1px solid #1c69d4',
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
            fontSize: 13,
            color: '#ffffff',
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
          background: '#262626',
          color: '#ffffff',
          padding: '2px 6px',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
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
        background: '#262626',
        color: '#ffffff',
        padding: '16px 20px',
        overflowX: 'auto',
        fontSize: 13,
        lineHeight: 1.5,
        margin: '0 0 16px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      style={{
        borderLeft: '2px solid #1c69d4',
        paddingLeft: 16,
        margin: '0 0 12px',
        color: '#757575',
        fontSize: 15,
        lineHeight: 1.55,
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid #bbbbbb',
        margin: '24px 0',
      }}
    />
  ),
  table: (props) => (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14,
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
        padding: '8px 12px',
        borderBottom: '1px solid #262626',
        fontWeight: 700,
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: '0.1em',
      }}
      {...props}
    />
  ),
  td: (props) => (
    <td
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #bbbbbb',
      }}
      {...props}
    />
  ),
};
