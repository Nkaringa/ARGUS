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

export function FileBrowser() {
  const [root, setRoot] = useState('');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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
      className="shrink-0 overflow-y-auto"
      style={{
        width: 280,
        background: '#fafafa',
        borderRight: '1px solid #e5e5e5',
      }}
    >
      <div style={{ padding: '48px 24px 20px' }}>
        <div
          className="uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            color: '#757575',
            marginBottom: 6,
          }}
        >
          Work directory
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: '#262626',
          }}
          title={root}
        >
          {rootLabel || '—'}
        </div>
      </div>

      <div style={{ padding: '0 8px 24px' }}>
        {error ? (
          <div style={{ fontSize: 12, color: '#a85432', padding: '8px 16px', lineHeight: 1.4 }}>
            Failed to load files ({error}).
          </div>
        ) : !loaded ? (
          <div style={{ fontSize: 12, color: '#757575', padding: '8px 16px' }}>Loading…</div>
        ) : tree.length === 0 ? (
          <div style={{ fontSize: 12, color: '#757575', padding: '8px 16px', lineHeight: 1.4 }}>
            No files yet. Submit a task to see files appear here.
          </div>
        ) : (
          <TreeNodeList
            nodes={tree}
            path=""
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        )}
      </div>
      {selectedFile && (
        <FilePreview path={selectedFile} onClose={() => setSelectedFile(null)} />
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
        return (
          <div key={fullPath}>
            <button
              type="button"
              onClick={() => (isDir ? onToggle(fullPath) : onSelectFile(fullPath))}
              className="w-full text-left truncate"
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                paddingRight: 8,
                paddingLeft: 8 + depth * 14,
                fontSize: 13,
                color: isDir ? '#262626' : isSelected ? '#1c69d4' : '#757575',
                fontWeight: isDir ? 700 : isSelected ? 700 : 400,
                lineHeight: 1.4,
                background: isSelected ? '#e9f0fb' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected ? '#e9f0fb' : 'transparent';
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 9,
                  color: '#bbbbbb',
                  width: 10,
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                {isDir ? (isExpanded ? '▼' : '▶') : ''}
              </span>
              <span className="truncate">{node.name}</span>
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
