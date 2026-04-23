import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Node {
  id: number;
  val: string;
}

export default function LinkedListAnim() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, val: 'A' },
    { id: 2, val: 'B' },
    { id: 3, val: 'C' }
  ]);
  const isReduced = useReducedMotion();

  const addNode = () => {
    const id = Date.now();
    const val = String.fromCharCode(65 + (nodes.length % 26));
    setNodes([...nodes, { id, val }]);
  };

  const removeHead = () => {
    setNodes(nodes.slice(1));
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="flex items-center justify-center flex-wrap gap-4 mb-12 p-6 border-2 border-border rounded-xl bg-surface">
           {nodes.map((node, i) => (
             <div key={node.id} className="flex items-center">
                <div className="w-12 h-12 border-2 border-accent rounded-xl flex items-center justify-center bg-surface-2 font-bold text-accent shadow-sm">
                   {node.val}
                </div>
                {i < nodes.length - 1 ? (
                   <ArrowRight className="w-4 h-4 mx-2 text-border" />
                ) : (
                   <div className="ml-2 text-[8px] font-mono text-text-muted">NULL</div>
                )}
             </div>
           ))}
           {nodes.length === 0 && <div className="text-text-muted italic">Empty List</div>}
        </div>
        <div className="flex gap-2">
           <Button onClick={addNode} size="sm">Add Node</Button>
           <Button variant="outline" onClick={removeHead} size="sm" disabled={nodes.length === 0}>Remove Head</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center overflow-hidden">
      <div className="flex items-center justify-center flex-wrap gap-y-8 min-h-[120px] mb-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {nodes.map((node, i) => (
            <motion.div
              key={node.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="flex items-center"
            >
              <div className="relative">
                <div className="w-12 h-12 md:w-14 md:h-14 border-2 border-accent rounded-xl flex items-center justify-center bg-surface shadow-md relative z-10">
                  <span className="font-bold text-accent">{node.val}</span>
                </div>
                {i === 0 && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-accent uppercase tracking-tighter">
                    Head
                  </span>
                )}
              </div>
              {i < nodes.length - 1 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="mx-1 md:mx-2 text-border"
                >
                  <ArrowRight className="w-4 h-4 md:w-6 md:h-6" />
                </motion.div>
              ) : (
                <div className="mx-2 text-[10px] font-mono text-text-muted">NULL</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        <Button size="sm" onClick={addNode}>Add Node O(1)</Button>
        <Button size="sm" variant="outline" onClick={removeHead} disabled={nodes.length === 0}>Remove Head O(1)</Button>
      </div>
    </div>
  );
}
