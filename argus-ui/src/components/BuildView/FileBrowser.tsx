import { useCallback, useEffect, useState } from 'react';
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

interface FileBrowserProps {
  /** When provided, FileBrowser runs in controlled mode — clicks invoke this callback
   *  instead of opening the internal FilePreview modal. Workspace mode uses this so the
   *  preview renders inline in its own pane next to the tree. */
  onFileSelect?: (path: string) => void;
  /** Highlight a specific file as selected. Typically paired with onFileSelect. */
  externalSelectedFile?: string | null;
}

export function FileBrowser({ onFileSelect, externalSelectedFile }: FileBrowserProps = {}) {
  const [root, setRoot] = useState('');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Internal selection used when the parent isn't providing controlled selection.
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selectedFile = externalSelectedFile !== undefined ? externalSelectedFile : internalSelected;

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

  const toggle = (fullPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  };

  const rootLabel = root ? root.split('/').filter(Boolean).pop() || root : '';

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px dashed var(--rule)' }}>
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
            fontWeight: 700,
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

      <div style={{ padding: '8px 8px 24px', flex: 1 }}>
        {error ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--warn)',
              padding: '8px 14px',
              lineHeight: 1.4,
            }}
          >
            failed to load files ({error}).
          </div>
        ) : !loaded ? (
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
              padding: '8px 14px',
            }}
          >
            loading…
          </div>
        ) : tree.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-dim)',
              padding: '8px 14px',
              lineHeight: 1.5,
            }}
          >
            no files yet. submit a task to see files appear here.
          </div>
        ) : (
          <TreeNodeList
            nodes={tree}
            path=""
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            selectedFile={selectedFile}
            onSelectFile={handleSelect}
          />
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

        const idleColor = isDir ? 'var(--ink)' : 'var(--ink-dim)';
        const selectedColor = 'var(--accent)';
        const idleWeight = isDir ? 700 : 400;
        const selectedWeight = 600;

        return (
          <div key={fullPath}>
            <button
              type="button"
              onClick={() => (isDir ? onToggle(fullPath) : onSelectFile(fullPath))}
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                paddingRight: 8,
                paddingLeft: 8 + depth * 14,
                fontSize: 13,
                color: isSelected ? selectedColor : idleColor,
                fontWeight: isSelected ? selectedWeight : idleWeight,
                lineHeight: 1.4,
                background: isSelected ? 'rgba(196,255,61,0.08)' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--bg-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected
                  ? 'rgba(196,255,61,0.08)'
                  : 'transparent';
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 9,
                  color: isSelected ? 'var(--accent)' : 'var(--rule-hot)',
                  width: 10,
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                {isDir ? (isExpanded ? '▼' : '▶') : ''}
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.name}
              </span>
            </button>
            {isDir && isExpanded && node.children && node.children.length > 0 && (
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
      })}
    </>
  );
}
