import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface Node {
  id: number;
  x: number;
  y: number;
}

export default function GraphAnim() {
  const nodes: Node[] = [
    { id: 0, x: 100, y: 100 },
    { id: 1, x: 200, y: 50 },
    { id: 2, x: 200, y: 150 },
    { id: 3, x: 300, y: 100 },
    { id: 4, x: 150, y: 200 },
  ];
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [0, 4], [4, 2]];

  const [visited, setVisited] = useState<number[]>([]);
  const [sourceNode, setSourceNode] = useState(0);
  const [focusedNode, setFocusedNode] = useState<number | null>(null);
  const [algo, setAlgo] = useState<'BFS' | 'DFS'>('BFS');
  const [isRunning, setIsRunning] = useState(false);
  const isReduced = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const runTraversal = () => {
    setVisited([]);
    setIsRunning(true);
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];

    const sequence: number[] = [];
    const seen = new Set([sourceNode]);

    if (algo === 'BFS') {
      const queue = [sourceNode];
      while (queue.length > 0) {
        const n = queue.shift()!;
        sequence.push(n);
        edges.forEach(([u, v]) => {
          if (u === n && !seen.has(v)) { seen.add(v); queue.push(v); }
          if (v === n && !seen.has(u)) { seen.add(u); queue.push(u); }
        });
      }
    } else {
      const stack = [sourceNode];
      while (stack.length > 0) {
        const n = stack.pop()!;
        if (!sequence.includes(n)) {
          sequence.push(n);
          // Sort to keep traversal predictable
          const neighbors: number[] = [];
          edges.forEach(([u, v]) => {
            if (u === n && !seen.has(v)) { neighbors.push(v); }
            if (v === n && !seen.has(u)) { neighbors.push(u); }
          });
          neighbors.reverse().forEach(v => {
            if (!seen.has(v)) {
              seen.add(v);
              stack.push(v);
            }
          });
        }
      }
    }

    if (isReduced) {
      setVisited(sequence);
      setIsRunning(false);
      return;
    }

    sequence.forEach((id, i) => {
      const timer = window.setTimeout(() => {
        setVisited(prev => [...prev, id]);
        if (i === sequence.length - 1) setIsRunning(false);
      }, i * 600);
      timersRef.current.push(timer);
    });
  };

  if (isReduced) {
    return (
      <div className="p-4 w-full flex flex-col items-center">
        <div className="mb-6 p-4 border-2 border-border rounded-xl bg-surface flex flex-col items-center">
          <svg viewBox="0 0 400 250" width="100%" className="max-w-[300px] h-auto mb-4 opacity-50">
             {edges.map(([u, v], i) => (
                <line key={i} x1={nodes[u].x} y1={nodes[u].y} x2={nodes[v].x} y2={nodes[v].y} stroke="currentColor" className="text-border" strokeWidth="2" />
             ))}
             {nodes.map(n => (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r="15" className="fill-surface stroke-border" strokeWidth="2" />
                  <text x={n.x} y={n.y} dy="5" textAnchor="middle" className="text-[10px] font-bold fill-text-muted">{n.id}</text>
                </g>
             ))}
          </svg>
          <div className="text-xs text-center font-mono">
            <strong>Static Graph Representation</strong><br/>
            Nodes 0-4 connected via edges.<br/>
            BFS explores layer by layer.<br/>
            DFS explores deep into one branch first.
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAlgo('BFS')} variant={algo === 'BFS' ? 'primary' : 'outline'} size="sm">BFS</Button>
          <Button onClick={() => setAlgo('DFS')} variant={algo === 'DFS' ? 'primary' : 'outline'} size="sm">DFS</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-full flex flex-col items-center overflow-hidden">
      <svg 
        viewBox="0 0 400 250" 
        width="100%" 
        className="mb-6 max-w-[400px] h-auto"
      >
        {edges.map(([u, v], i) => {
          const isHighlighted = visited.includes(u) && visited.includes(v);
          return (
            <line
              key={i}
              x1={nodes[u].x} y1={nodes[u].y}
              x2={nodes[v].x} y2={nodes[v].y}
              stroke="currentColor"
              className={cn(isHighlighted ? 'text-accent' : 'text-border', 'transition-colors duration-500')}
              strokeWidth={isHighlighted ? "3" : "2"}
            />
          );
        })}
        {nodes.map(n => {
          const isVisited = visited.includes(n.id);
          const isSource = sourceNode === n.id;
          const isFocused = focusedNode === n.id;
          return (
            <motion.g 
              key={n.id} 
              animate={{ scale: isVisited ? 1.15 : 1 }}
              className="cursor-pointer outline-none"
              onClick={() => !isRunning && setSourceNode(n.id)}
              onFocus={() => setFocusedNode(n.id)}
              onBlur={() => setFocusedNode(null)}
              tabIndex={isRunning ? -1 : 0}
              role="button"
              aria-label={`Select Node ${n.id} as source`}
              onKeyDown={(e) => {
                if (!isRunning && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setSourceNode(n.id);
                }
              }}
            >
              {/* Focus Halo */}
              {isFocused && (
                <circle
                  cx={n.x} cy={n.y} r="24"
                  className="fill-none stroke-accent stroke-[3] opacity-50"
                />
              )}
              <circle
                cx={n.x} cy={n.y} r="18"
                className={cn(
                  'transition-colors duration-500 stroke-2',
                  isVisited ? 'fill-accent stroke-accent' : 'fill-surface stroke-border',
                  isSource && !isVisited && 'stroke-accent border-dashed'
                )}
              />
              <text 
                x={n.x} y={n.y} dy="5" 
                textAnchor="middle" 
                className={cn(
                  'text-[10px] font-bold pointer-events-none transition-colors duration-500',
                  isVisited ? 'fill-white' : 'fill-text'
                )}
              >
                {n.id}
              </text>
              {isSource && !isVisited && (
                <text x={n.x} y={n.y + 30} textAnchor="middle" className="text-[8px] fill-accent font-bold">START</text>
              )}
            </motion.g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2 md:gap-4">
        <Button size="sm" onClick={runTraversal} disabled={isRunning}>
          Run {algo} from Node {sourceNode}
        </Button>
        <div className="flex p-1 bg-surface-2 rounded-lg border border-border">
          <button 
            onClick={() => setAlgo('BFS')}
            className={cn("px-3 py-1 text-xs rounded-md transition-all", algo === 'BFS' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text")}
          >BFS</button>
          <button 
            onClick={() => setAlgo('DFS')}
            className={cn("px-3 py-1 text-xs rounded-md transition-all", algo === 'DFS' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text")}
          >DFS</button>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { setVisited([]); setIsRunning(false); }} disabled={isRunning}>Clear</Button>
      </div>
      <p className="text-[10px] text-text-muted mt-4">Click any node to set it as the starting source.</p>
    </div>
  );
}
