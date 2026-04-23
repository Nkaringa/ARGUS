import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function QueueAnim() {
  const [queue, setQueue] = useState<string[]>(['Req #1', 'Req #2', 'Req #3']);
  const isReduced = useReducedMotion();

  const enqueue = () => {
    setQueue([...queue, `Req #${Math.floor(Math.random() * 900) + 100}`]);
  };

  const dequeue = () => {
    setQueue(queue.slice(1));
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="flex items-center gap-2 mb-12 p-6 border-2 border-border rounded-xl bg-surface">
           <div className="text-[10px] font-bold text-text-muted uppercase">Front</div>
           <div className="flex gap-2">
              {queue.map(item => (
                <div key={item} className="px-3 py-1 bg-accent-2 text-white rounded font-mono text-[10px]">{item}</div>
              ))}
              {queue.length === 0 && <div className="text-[10px] italic text-text-muted">Empty</div>}
           </div>
           <div className="text-[10px] font-bold text-text-muted uppercase">Back</div>
        </div>
        <div className="flex gap-2">
           <Button onClick={enqueue} size="sm">Enqueue</Button>
           <Button variant="outline" onClick={dequeue} size="sm" disabled={queue.length === 0}>Dequeue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center overflow-hidden">
      <div className="flex items-center gap-2 mb-12 min-h-[80px] overflow-x-auto w-full justify-center no-scrollbar">
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mr-2 md:mr-4">Front</div>
        <AnimatePresence mode="popLayout" initial={false}>
          {queue.map((item) => (
            <motion.div
              key={item}
              layout
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-accent-2 text-white rounded-md font-mono text-[10px] md:text-xs shadow-sm flex-shrink-0"
            >
              {item}
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-2 md:ml-4">Back</div>
      </div>
      <div className="flex gap-4">
        <Button size="sm" onClick={enqueue}>Enqueue O(1)</Button>
        <Button size="sm" variant="outline" onClick={dequeue} disabled={queue.length === 0}>Dequeue O(1)</Button>
      </div>
    </div>
  );
}
