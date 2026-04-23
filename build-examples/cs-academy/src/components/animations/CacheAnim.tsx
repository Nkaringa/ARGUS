import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function CacheAnim() {
  const [cache, setCache] = useState<string[]>(['user:1', 'user:2']);
  const [status, setStatus] = useState<'HIT' | 'MISS' | null>(null);
  const isReduced = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const request = (key: string) => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];

    if (cache.includes(key)) {
      setStatus('HIT');
      // Move to front (LRU)
      setCache([key, ...cache.filter(k => k !== key)]);
      
      const timer = window.setTimeout(() => setStatus(null), 1500);
      timersRef.current.push(timer);
    } else {
      setStatus('MISS');
      const timer1 = window.setTimeout(() => {
        setCache(prev => [key, ...prev.slice(0, 2)]);
        setStatus(null);
      }, isReduced ? 0 : 1000);
      timersRef.current.push(timer1);
    }
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="flex gap-4 mb-8">
           <div className="flex flex-col items-center p-4 border-2 border-border rounded-xl bg-surface">
              <div className="text-[10px] font-bold mb-2 uppercase text-text-muted">Cache Content</div>
              <div className="flex flex-col gap-1">
                 {cache.map(item => (
                   <div key={item} className="px-4 py-1 bg-accent/10 text-accent border border-accent/20 rounded font-mono text-xs">{item}</div>
                 ))}
                 {cache.length === 0 && <div className="text-[10px] italic text-text-muted">Empty</div>}
              </div>
           </div>
           <div className="flex flex-col items-center justify-center p-4 border-2 border-border rounded-xl bg-surface min-w-[100px]">
              <div className="text-xl font-black">{status || 'IDLE'}</div>
              <div className="text-[10px] text-text-muted">Status</div>
           </div>
        </div>
        <div className="flex gap-2">
           <Button size="sm" onClick={() => request('user:1')}>Req User 1</Button>
           <Button size="sm" onClick={() => request('user:2')}>Req User 2</Button>
           <Button size="sm" variant="outline" onClick={() => request('user:3')}>Req User 3 (Miss)</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 mb-12 items-center">
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-bold mb-2 uppercase text-text-muted tracking-wider">Cache (LRU)</div>
          <div className="w-28 md:w-32 h-40 md:h-48 border-2 border-accent rounded-xl p-2 flex flex-col gap-2 bg-surface shadow-inner">
            <AnimatePresence initial={false}>
              {cache.map(item => (
                <motion.div
                  key={item}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="py-2 bg-accent/10 text-accent border border-accent/20 rounded text-center text-xs font-mono"
                >
                  {item}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-w-[120px]">
          <div className="text-3xl md:text-4xl font-black mb-4 h-12 flex items-center">
            {status === 'HIT' && <span className="text-success">HIT!</span>}
            {status === 'MISS' && (
              <span className="text-danger animate-pulse">
                MISS
              </span>
            )}
          </div>
          <div className="w-20 h-20 md:w-24 md:h-24 bg-surface-2 border border-border rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
            Database
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 md:gap-4">
        <Button size="sm" onClick={() => request('user:1')}>Req User 1</Button>
        <Button size="sm" onClick={() => request('user:2')}>Req User 2</Button>
        <Button size="sm" variant="outline" onClick={() => request('user:' + (Math.floor(Math.random() * 7) + 3))}>
          Req Random
        </Button>
      </div>
    </div>
  );
}
