import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function HashTableAnim() {
  const [buckets, setBuckets] = useState<string[][]>(
    Array(5).fill([]).map((_, i) => (i === 1 ? ['user_1'] : i === 3 ? ['post_42', 'post_88'] : []))
  );
  const isReduced = useReducedMotion();

  const addKey = () => {
    const keys = ['data', 'meta', 'auth', 'cache', 'log'];
    const key = keys[Math.floor(Math.random() * keys.length)] + '_' + Math.floor(Math.random() * 99);
    const index = Math.floor(Math.random() * buckets.length);
    const newBuckets = [...buckets];
    newBuckets[index] = [...newBuckets[index], key];
    setBuckets(newBuckets);
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full max-w-md mx-auto">
        <div className="space-y-3 mb-8 bg-surface p-4 border-2 border-border rounded-xl">
           {buckets.map((bucket, i) => (
             <div key={i} className="flex items-center gap-4">
               <div className="w-8 h-8 shrink-0 border border-border flex items-center justify-center rounded bg-surface-2 font-mono text-xs">{i}</div>
               <div className="flex flex-wrap gap-1">
                  {bucket.map(val => (
                    <div key={val} className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded text-[10px] font-mono">{val}</div>
                  ))}
                  {bucket.length === 0 && <span className="text-[10px] text-text-muted italic">empty</span>}
               </div>
             </div>
           ))}
        </div>
        <Button onClick={addKey} size="sm" className="w-full">Insert Key</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-md mx-auto overflow-hidden">
      <div className="space-y-3 md:space-y-4 mb-8">
        {buckets.map((bucket, i) => (
          <div key={i} className="flex items-center gap-2 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 border border-border flex items-center justify-center rounded bg-surface-2 font-mono text-xs text-text">
              {i}
            </div>
            <div className="flex-grow min-h-[40px] border border-dashed border-border rounded flex items-center p-1 gap-1 overflow-x-auto no-scrollbar">
              <AnimatePresence initial={false}>
                {bucket.map((val) => (
                  <motion.div
                    key={val}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="px-2 py-1 bg-accent/20 text-accent rounded text-[10px] font-mono whitespace-nowrap border border-accent/30"
                  >
                    {val}
                  </motion.div>
                ))}
              </AnimatePresence>
              {bucket.length === 0 && <span className="text-[10px] text-text-muted ml-2">Empty</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <Button size="sm" onClick={addKey}>Insert Random Key O(1)*</Button>
        <p className="text-[10px] text-text-muted mt-3">
          Multiple keys in one bucket show collision chaining.
        </p>
      </div>
    </div>
  );
}
