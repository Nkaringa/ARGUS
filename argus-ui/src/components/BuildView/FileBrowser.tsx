import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SERVERS, authHeaders } from '../../config';
import { FilePreview } from './FilePreview';

interface FileNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileNode[];
  size?: number;
  mtime?: number;
}

interface FileTreeResponse {
  root: string;
  tree: FileNode[];
}

type SortMode = 'path' | 'recent' | 'size';

// Files modified within this many ms get a "recent" indicator dot.
const RECENT_THRESHOLD_MS = 60 * 60 * 1000;

interface FileBrowserProps {
  /** When provided, FileBrowser runs in controlled mode — clicks invoke this callback
   *  instead of opening the internal FilePreview modal. Workspace mode uses this so the
   *  preview renders inline in its own pane next to the tree. */
  onFileSelect?: (path: string) => void;
  /** Highlight a specific file as selected. Typically paired with onFileSelect. */
  externalSelectedFile?: string | null;
  /** Slug of the currently-running or last-active build. When set, the file
   *  browser pins it at the top and auto-expands its folder. */
  activeSlug?: string | null;
}

export function FileBrowser({ onFileSelect, externalSelectedFile, activeSlug }: FileBrowserProps = {}) {
  const [root, setRoot] = useState('');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortMode>('path');
  // Internal selection used when the parent isn't providing controlled selection.
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selectedFile = externalSelectedFile !== undefined ? externalSelectedFile : internalSelected;

  // Track the last non-null active slug so the pin doesn't flicker out during
  // brief state transitions (idle ↔ planning) — the user wants to keep
  // exploring the slug they're focused on, not lose the pin every transition.
  const lastActiveSlugRef = useRef<string | null>(null);
  if (activeSlug) lastActiveSlugRef.current = activeSlug;
  const stickyActiveSlug = activeSlug ?? lastActiveSlugRef.current;

  const handleSelect = (path: string) => {
    if (onFileSelect) onFileSelect(path);
    else setInternalSelected(path);
  };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${SERVERS.build.http}/files`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FileTreeResponse = await res.json();
      setRoot(data.root || '');
      setTree(data.tree || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    // Poll every 3s — cheap on the server (one readdirSync recursion, depth-capped)
    // and gives a near-live feel as agents drop files into WORK_DIR during a build.
    const id = setInterval(fetchFiles, 3000);
    return () => clearInterval(id);
  }, [fetchFiles]);

  // Auto-expand the active slug's folder so the user lands on the running
  // build's files without having to click the chevron themselves.
  useEffect(() => {
    if (!stickyActiveSlug) return;
    setExpanded((prev) => {
      if (prev.has(stickyActiveSlug)) return prev;
      const next = new Set(prev);
      next.add(stickyActiveSlug);
      return next;
    });
  }, [stickyActiveSlug]);

  const toggle = (fullPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  };

  // Compute the rendered tree based on filter + sort. For path mode we keep the
  // hierarchical view; for recent/size we flatten leaves and sort, since "give
  // me the most recently touched file" is a flat-list question, not a tree one.
  const view = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (sort === 'path') {
      return { kind: 'tree' as const, nodes: filterTree(tree, q) };
    }
    const leaves = collectLeaves(tree, '');
    const filtered = q
      ? leaves.filter((l) => l.name.toLowerCase().includes(q) || l.path.toLowerCase().includes(q))
      : leaves;
    const sorted = [...filtered].sort((a, b) =>
      sort === 'recent' ? (b.mtime ?? 0) - (a.mtime ?? 0) : (b.size ?? 0) - (a.size ?? 0),
    );
    return { kind: 'flat' as const, leaves: sorted };
  }, [tree, filter, sort]);

  const rootLabel = root ? root.split('/').filter(Boolean).pop() || root : '';

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Head — work directory label */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          // work directory
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={root}
        >
          {rootLabel || '—'}
        </div>
      </div>

      {/* Toolbar — filter + sort */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px dashed var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>$</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter files..."
            style={{
              flex: 1,
              fontSize: 11.5,
              color: 'var(--ink)',
              background: 'var(--bg-3)',
              border: '1px solid var(--rule)',
              padding: '5px 8px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.16em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              marginRight: 2,
            }}
          >
            sort
          </span>
          <SortBtn label="path"   on={sort === 'path'}   onClick={() => setSort('path')} />
          <SortBtn label="recent" on={sort === 'recent'} onClick={() => setSort('recent')} />
          <SortBtn label="size"   on={sort === 'size'}   onClick={() => setSort('size')} />
        </div>
      </div>

      {/* Body — pin + tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 16px', minHeight: 0 }}>
        {error ? (
          <BodyMessage warn>failed to load files ({error}).</BodyMessage>
        ) : !loaded ? (
          <BodyMessage>loading…</BodyMessage>
        ) : tree.length === 0 ? (
          <BodyMessage>no files yet. submit a task to see files appear here.</BodyMessage>
        ) : (
          <>
            {stickyActiveSlug && (
              <div
                style={{
                  margin: '4px 8px 10px',
                  padding: '8px 12px',
                  background: 'var(--accent-tint-soft)',
                  border: '1px solid var(--accent-dim)',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  // active build
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  {stickyActiveSlug}
                </div>
              </div>
            )}

            {view.kind === 'tree' ? (
              view.nodes.length === 0 ? (
                <BodyMessage>no matches.</BodyMessage>
              ) : (
                <TreeNodeList
                  nodes={view.nodes}
                  path=""
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelect}
                />
              )
            ) : view.leaves.length === 0 ? (
              <BodyMessage>no matches.</BodyMessage>
            ) : (
              view.leaves.map((leaf) => (
                <FileRow
                  key={leaf.path}
                  name={leaf.path}
                  fullPath={leaf.path}
                  size={leaf.size}
                  mtime={leaf.mtime}
                  selected={selectedFile === leaf.path}
                  onClick={() => handleSelect(leaf.path)}
                  depth={0}
                  flat
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Uncontrolled mode only — when no parent handler is provided, show the modal
          preview on click. In workspace mode the parent renders InlinePreview instead. */}
      {!onFileSelect && internalSelected && (
        <FilePreview path={internalSelected} onClose={() => setInternalSelected(null)} />
      )}
    </aside>
  );
}

function SortBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 8px',
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: on ? 'var(--accent)' : 'var(--ink-dim)',
        background: on ? 'var(--accent-tint)' : 'transparent',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function BodyMessage({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: warn ? 'var(--warn)' : 'var(--ink-dim)',
        padding: '8px 14px',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

interface Leaf {
  name: string;
  path: string;
  size?: number;
  mtime?: number;
}

// Flatten the tree to its file leaves with their full paths. Used by recent/size sorts.
function collectLeaves(nodes: FileNode[], parent: string): Leaf[] {
  const out: Leaf[] = [];
  for (const n of nodes) {
    const full = parent ? `${parent}/${n.name}` : n.name;
    if (n.type === 'file') {
      out.push({ name: n.name, path: full, size: n.size, mtime: n.mtime });
    } else if (n.children) {
      out.push(...collectLeaves(n.children, full));
    }
  }
  return out;
}

// Filter the tree, keeping any folder whose descendants include a matching
// file (or whose own name matches). Returns a fresh tree; original untouched.
function filterTree(nodes: FileNode[], q: string): FileNode[] {
  if (!q) return nodes;
  const out: FileNode[] = [];
  for (const n of nodes) {
    const nameMatch = n.name.toLowerCase().includes(q);
    if (n.type === 'file') {
      if (nameMatch) out.push(n);
    } else {
      const filteredChildren = n.children ? filterTree(n.children, q) : [];
      if (nameMatch || filteredChildren.length > 0) {
        out.push({ ...n, children: filteredChildren });
      }
    }
  }
  return out;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TreeNodeList({
  nodes,
  path,
  depth,
  expanded,
  onToggle,
  selectedFile,
  onSelectFile,
}: {
  nodes: FileNode[];
  path: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const fullPath = path ? `${path}/${node.name}` : node.name;
        const isExpanded = expanded.has(fullPath);
        const isDir = node.type === 'dir';
        const isSelected = !isDir && selectedFile === fullPath;

        if (isDir) {
          return (
            <div key={fullPath}>
              <FolderRow
                name={node.name}
                expanded={isExpanded}
                onClick={() => onToggle(fullPath)}
                depth={depth}
                childCount={node.children?.length ?? 0}
              />
              {isExpanded && node.children && node.children.length > 0 && (
                <TreeNodeList
                  nodes={node.children}
                  path={fullPath}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  selectedFile={selectedFile}
                  onSelectFile={onSelectFile}
                />
              )}
            </div>
          );
        }

        return (
          <FileRow
            key={fullPath}
            name={node.name}
            fullPath={fullPath}
            size={node.size}
            mtime={node.mtime}
            selected={isSelected}
            onClick={() => onSelectFile(fullPath)}
            depth={depth}
          />
        );
      })}
    </>
  );
}

function FolderRow({
  name,
  expanded,
  onClick,
  depth,
  childCount,
}: {
  name: string;
  expanded: boolean;
  onClick: () => void;
  depth: number;
  childCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr auto',
        gap: 6,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: `4px 14px 4px ${8 + depth * 14}px`,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        aria-hidden
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          color: expanded ? 'var(--accent)' : 'var(--ink-dimmer)',
          textAlign: 'center',
        }}
      >
        {expanded ? '▾' : '▸'}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--ink)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}/
      </span>
      {!expanded && (
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.06em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {childCount}
        </span>
      )}
    </button>
  );
}

function FileRow({
  name,
  fullPath,
  size,
  mtime,
  selected,
  onClick,
  depth,
  flat,
}: {
  name: string;
  fullPath: string;
  size?: number;
  mtime?: number;
  selected: boolean;
  onClick: () => void;
  depth: number;
  flat?: boolean;
}) {
  const recent = mtime !== undefined && Date.now() - mtime < RECENT_THRESHOLD_MS;
  return (
    <button
      type="button"
      onClick={onClick}
      title={fullPath}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: `4px 14px 4px ${flat ? 14 : 8 + depth * 14}px`,
        background: selected ? 'var(--bg-3)' : 'transparent',
        border: 'none',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border-left-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--bg-3)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 9,
          letterSpacing: '0.06em',
          color: selected ? 'var(--accent)' : 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {recent && (
          <span
            title="modified in the last hour"
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 4px var(--accent)',
            }}
          />
        )}
        {formatSize(size)}
      </span>
    </button>
  );
}
