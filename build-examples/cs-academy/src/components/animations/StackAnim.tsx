import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function StackAnim() {
  const [stack, setStack] = useState<string[]>(['main()', 'fetchData()', 'parse()']);
  const isReduced = useReducedMotion();

  const push = () => {
    const fns = ['calculate()', 'validate()', 'save()', 'render()', 'log()'];
    setStack([...stack, fns[Math.floor(Math.random() * fns.length)]]);
  };

  const pop = () => {
    setStack(stack.slice(0, -1));
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-[280px] border-2 border-border rounded-xl p-6 flex flex-col-reverse gap-2 min-h-[200px] mb-8 bg-surface">
           {stack.map((item, i) => (
             <div key={`${item}-${i}`} className="w-full py-2 bg-accent text-white rounded font-mono text-xs text-center shadow-sm">
                {item}
             </div>
           ))}
           {stack.length === 0 && <div className="text-text-muted italic text-center text-xs">Empty Stack</div>}
        </div>
        <div className="flex gap-2">
           <Button onClick={push} size="sm">Push</Button>
           <Button variant="outline" onClick={pop} size="sm" disabled={stack.length === 0}>Pop</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-[280px] border-x-2 border-b-2 border-border rounded-b-xl p-4 flex flex-col-reverse gap-2 min-h-[250px] mb-8 bg-surface">
        <AnimatePresence initial={false}>
          {stack.map((item, i) => (
            <motion.div
              key={`${item}-${i}`}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full py-3 bg-accent text-white rounded-lg text-center font-mono text-sm shadow-sm"
            >
              {item}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex gap-4">
        <Button size="sm" onClick={push}>Push O(1)</Button>
        <Button size="sm" variant="outline" onClick={pop} disabled={stack.length === 0}>Pop O(1)</Button>
      </div>
    </div>
  );
}
