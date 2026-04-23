import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function ArrayAnim() {
  const [items, setItems] = useState<number[]>([10, 20, 30, 40, 50]);
  const isReduced = useReducedMotion();

  const addAtIndex = (index: number) => {
    const newVal = Math.floor(Math.random() * 90) + 10;
    const newItems = [...items];
    newItems.splice(index, 0, newVal);
    setItems(newItems.slice(0, 8)); // Cap at 8 for visibility
  };

  const removeAtIndex = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="flex justify-center items-end gap-2 mb-8 bg-surface border-2 border-border p-6 rounded-xl shadow-sm">
           {items.map((item, i) => (
             <div key={i} className="flex flex-col items-center">
                <div className="text-[10px] text-text-muted mb-1 font-mono">[{i}]</div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-accent text-white flex items-center justify-center rounded-lg font-bold">
                  {item}
                </div>
             </div>
           ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
           <Button onClick={() => addAtIndex(0)} size="sm">Insert start</Button>
           <Button onClick={() => addAtIndex(items.length)} size="sm">Push end</Button>
           <Button variant="ghost" onClick={() => setItems([10, 20, 30, 40, 50])} size="sm">Reset</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full overflow-hidden">
      <div className="flex justify-center items-end gap-2 h-32 mb-8 flex-wrap">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={`item-${i}-${item}`}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className="flex flex-col items-center"
            >
              <div className="text-[10px] text-text-muted mb-1 font-mono">[{i}]</div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-accent text-white flex items-center justify-center rounded-lg font-bold shadow-lg">
                {item}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-2 md:gap-4">
        <Button variant="outline" size="sm" onClick={() => addAtIndex(0)}>Insert at start O(n)</Button>
        <Button variant="outline" size="sm" onClick={() => addAtIndex(items.length)}>Push O(1)</Button>
        <Button variant="outline" size="sm" onClick={() => removeAtIndex(0)} disabled={items.length === 0}>Remove start O(n)</Button>
        <Button variant="outline" size="sm" onClick={() => setItems([10, 20, 30, 40, 50])}>Reset</Button>
      </div>
      
      <p className="text-center text-[10px] md:text-xs text-text-muted mt-6">
        Watch elements shift when inserting at index 0 vs the end.
      </p>
    </div>
  );
}
