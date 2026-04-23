import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface TreeNode {
  id: number;
  val: number;
  x: number;
  y: number;
  left: number | null;
  right: number | null;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 240;
const NODE_RADIUS = 18;
const LEVEL_HEIGHT = 50;

export default function BinaryTreeAnim() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [rootId, setRootId] = useState<number | null>(null);
  const [active, setActive] = useState<number[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTraversing, setIsTraversing] = useState(false);
  const isReduced = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  // Initial tree
  useEffect(() => {
    const initialVals = [50, 30, 70, 20, 40, 80];
    let currentNodes: TreeNode[] = [];
    let currentRoot: number | null = null;

    initialVals.forEach(val => {
      const { updatedNodes, newRoot } = insertNode(currentNodes, currentRoot, val);
      currentNodes = updatedNodes;
      currentRoot = newRoot;
    });

    setNodes(updateLayout(currentNodes, currentRoot));
    setRootId(currentRoot);
  }, []);

  const insertNode = (currentNodes: TreeNode[], root: number | null, val: number) => {
    const newNode: TreeNode = {
      id: Date.now() + Math.random(),
      val,
      x: CANVAS_WIDTH / 2,
      y: 40,
      left: null,
      right: null
    };

    if (root === null) {
      return { updatedNodes: [newNode], newRoot: newNode.id };
    }

    const updatedNodes = [...currentNodes];
    let currId: number | null = root;
    let parentId: number | null = null;
    let side: 'left' | 'right' | null = null;

    while (currId !== null) {
      const currNode = updatedNodes.find(n => n.id === currId)!;
      if (val === currNode.val) return { updatedNodes: currentNodes, newRoot: root }; // No duplicates for simplicity
      
      parentId = currId;
      if (val < currNode.val) {
        currId = currNode.left;
        side = 'left';
      } else {
        currId = currNode.right;
        side = 'right';
      }
    }

    const parentIdx = updatedNodes.findIndex(n => n.id === parentId);
    if (side === 'left') updatedNodes[parentIdx] = { ...updatedNodes[parentIdx], left: newNode.id };
    else updatedNodes[parentIdx] = { ...updatedNodes[parentIdx], right: newNode.id };

    updatedNodes.push(newNode);
    return { updatedNodes, newRoot: root };
  };

  const updateLayout = (allNodes: TreeNode[], root: number | null): TreeNode[] => {
    if (root === null) return [];
    const updated = [...allNodes];

    const calculate = (id: number | null, x: number, y: number, offset: number) => {
      if (id === null) return;
      const idx = updated.findIndex(n => n.id === id);
      updated[idx] = { ...updated[idx], x, y };
      
      calculate(updated[idx].left, x - offset, y + LEVEL_HEIGHT, offset / 1.8);
      calculate(updated[idx].right, x + offset, y + LEVEL_HEIGHT, offset / 1.8);
    };

    calculate(root, CANVAS_WIDTH / 2, 40, 80);
    return updated;
  };

  const handleInsert = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseInt(inputValue);
    if (isNaN(val) || nodes.length >= 15) return;

    const { updatedNodes, newRoot } = insertNode(nodes, rootId, val);
    setNodes(updateLayout(updatedNodes, newRoot));
    setRootId(newRoot);
    setInputValue('');
  };

  const traverse = (order: 'in' | 'pre' | 'post') => {
    if (isTraversing) return;
    setIsTraversing(true);
    setActive([]);
    timersRef.current.forEach(clearTimeout);

    const sequence: number[] = [];
    const walk = (id: number | null) => {
      if (id === null) return;
      const node = nodes.find(n => n.id === id)!;
      if (order === 'pre') sequence.push(id);
      walk(node.left);
      if (order === 'in') sequence.push(id);
      walk(node.right);
      if (order === 'post') sequence.push(id);
    };
    walk(rootId);

    if (isReduced) {
      setActive(sequence);
      setIsTraversing(false);
      return;
    }

    sequence.forEach((id, i) => {
      const timer = window.setTimeout(() => {
        setActive(prev => [...prev, id]);
        if (i === sequence.length - 1) setIsTraversing(false);
      }, i * 600);
      timersRef.current.push(timer);
    });
  };

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  if (isReduced) {
    return (
      <div className="p-4 w-full flex flex-col items-center">
        <div className="mb-6 p-4 border-2 border-border rounded-xl bg-surface flex flex-col items-center w-full max-w-sm">
          <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} width="100%" className="h-auto mb-4 opacity-50">
            {nodes.map(n => (
              <g key={`reduced-edges-${n.id}`}>
                {n.left && (
                  <line 
                    x1={n.x} y1={n.y} x2={nodes.find(c => c.id === n.left)?.x} y2={nodes.find(c => c.id === n.left)?.y} 
                    stroke="currentColor" className="text-border" strokeWidth="1.5" 
                  />
                )}
                {n.right && (
                  <line 
                    x1={n.x} y1={n.y} x2={nodes.find(c => c.id === n.right)?.x} y2={nodes.find(c => c.id === n.right)?.y} 
                    stroke="currentColor" className="text-border" strokeWidth="1.5" 
                  />
                )}
              </g>
            ))}
            {nodes.map(n => (
              <g key={`reduced-node-${n.id}`}>
                <circle cx={n.x} cy={n.y} r="14" className="fill-surface stroke-border" strokeWidth="2" />
                <text x={n.x} y={n.y} dy="4" textAnchor="middle" className="text-[9px] font-bold fill-text-muted">{n.val}</text>
              </g>
            ))}
          </svg>
          <div className="text-[10px] text-center font-mono space-y-1">
            <p><strong>Binary Search Tree</strong>: Left &lt; Root &lt; Right</p>
            <p>Total Nodes: {nodes.length}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
           <Button size="sm" variant="outline" onClick={() => traverse('in')}>In-order</Button>
           <Button size="sm" variant="outline" onClick={() => traverse('pre')}>Pre-order</Button>
           <Button size="sm" variant="ghost" onClick={() => { setNodes([]); setRootId(null); setActive([]); }}>Reset</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-full flex flex-col items-center overflow-hidden">
      <svg 
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} 
        width="100%" 
        className="mb-6 max-w-[400px] h-auto"
      >
        <AnimatePresence>
          {nodes.map(n => {
            const leftChild = nodes.find(c => c.id === n.left);
            const rightChild = nodes.find(c => c.id === n.right);
            
            return (
              <g key={`edges-${n.id}`}>
                {leftChild && (
                  <motion.line 
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: 1, 
                      opacity: 1,
                      x1: n.x, y1: n.y, 
                      x2: leftChild.x, y2: leftChild.y 
                    }}
                    stroke="currentColor" 
                    className={cn(
                      'transition-colors duration-300', 
                      active.includes(n.id) && active.includes(n.left!) ? 'text-accent' : 'text-border'
                    )}
                    strokeWidth="2" 
                  />
                )}
                {rightChild && (
                  <motion.line 
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: 1, 
                      opacity: 1,
                      x1: n.x, y1: n.y, 
                      x2: rightChild.x, y2: rightChild.y 
                    }}
                    stroke="currentColor" 
                    className={cn(
                      'transition-colors duration-300', 
                      active.includes(n.id) && active.includes(n.right!) ? 'text-accent' : 'text-border'
                    )}
                    strokeWidth="2" 
                  />
                )}
              </g>
            );
          })}
        </AnimatePresence>
        
        <AnimatePresence>
          {nodes.map(n => (
            <motion.g 
              key={n.id} 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: active.includes(n.id) ? 1.15 : 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.circle
                animate={{ cx: n.x, cy: n.y }}
                r={NODE_RADIUS}
                className={cn(
                  'transition-colors duration-300 stroke-2', 
                  active.includes(n.id) ? 'fill-accent stroke-accent' : 'fill-surface stroke-accent'
                )}
              />
              <motion.text 
                animate={{ x: n.x, y: n.y }}
                dy="5" 
                textAnchor="middle" 
                className={cn(
                  'text-[10px] font-bold pointer-events-none transition-colors duration-300', 
                  active.includes(n.id) ? 'fill-white' : 'fill-accent'
                )}
              >
                {n.val}
              </motion.text>
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <form onSubmit={handleInsert} className="flex gap-2">
          <input 
            type="number" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Value (e.g. 45)"
            className="flex-grow px-3 py-1 text-sm bg-surface border border-border rounded-md focus:ring-2 focus:ring-accent outline-none"
            min="1"
            max="99"
          />
          <Button type="submit" size="sm" disabled={isTraversing || nodes.length >= 15}>Insert</Button>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => traverse('in')} disabled={isTraversing}>In-order</Button>
          <Button size="sm" variant="outline" onClick={() => traverse('pre')} disabled={isTraversing}>Pre-order</Button>
          <Button size="sm" variant="outline" onClick={() => traverse('post')} disabled={isTraversing}>Post-order</Button>
          <Button size="sm" variant="ghost" onClick={() => setActive([])} disabled={isTraversing}>Clear</Button>
        </div>
      </div>
    </div>
  );
}
