import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface DataRecord {
  id: number;
  shard: number;
}

type ShardMode = 'hash' | 'range';

export default function ShardingAnim() {
  const [data, setData] = useState<DataRecord[]>([]);
  const [mode, setMode] = useState<ShardMode>('hash');
  const [numShards, setNumShards] = useState(3);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const isReduced = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const getShard = (id: number, shardsCount: number, currentMode: ShardMode) => {
    if (currentMode === 'hash') {
      return id % shardsCount;
    } else {
      // Range: 0-333, 334-666, 667-1000 for 3 shards
      // Adjust ranges based on shardsCount
      const rangeSize = Math.ceil(1000 / shardsCount);
      return Math.min(Math.floor(id / rangeSize), shardsCount - 1);
    }
  };

  const addData = () => {
    if (isRebalancing) return;
    const id = Math.floor(Math.random() * 1000);
    const shard = getShard(id, numShards, mode);
    setData(prev => [...prev, { id, shard }]);
  };

  const rebalance = () => {
    if (isRebalancing) return;
    setIsRebalancing(true);
    const newShardsCount = numShards === 3 ? 4 : 3;
    
    // Animate rebalancing
    const timer = window.setTimeout(() => {
      setNumShards(newShardsCount);
      setData(prev => prev.map(d => ({
        ...d,
        shard: getShard(d.id, newShardsCount, mode)
      })));
      setIsRebalancing(false);
    }, isReduced ? 0 : 1000);
    timersRef.current.push(timer);
  };

  const reset = () => {
    setData([]);
    setNumShards(3);
    setIsRebalancing(false);
  };

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-lg p-6 border-2 border-border rounded-xl bg-surface mb-8">
          <div className="flex justify-between items-center mb-4">
             <div className="font-bold">Sharding Strategy: {mode === 'hash' ? 'Hash-based' : 'Range-based'}</div>
             <div className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-full">{numShards} Shards Active</div>
          </div>
          <div className="space-y-4">
             {[...Array(numShards)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                   <div className="w-16 text-[10px] font-bold text-text-muted">SHARD {i}</div>
                   <div className="flex-1 h-4 bg-surface-2 rounded-full overflow-hidden border border-border">
                      <div 
                        className="h-full bg-accent transition-all duration-500" 
                        style={{ width: `${Math.min(100, (data.filter(d => d.shard === i).length / 10) * 100)}%` }}
                      />
                   </div>
                   <div className="text-[10px] font-mono">{data.filter(d => d.shard === i).length} Recs</div>
                </div>
             ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button onClick={addData} size="sm">Add Record</Button>
          <Button variant="outline" onClick={() => setMode(m => m === 'hash' ? 'range' : 'hash')} size="sm">Toggle Mode</Button>
          <Button variant="outline" onClick={rebalance} size="sm">Rebalance (Change Shards)</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center">
      <div className={cn(
        "grid gap-4 w-full mb-8 transition-all duration-500",
        numShards === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-4"
      )}>
        {[...Array(numShards)].map((_, s) => (
          <div key={s} className="flex flex-col items-center">
            <div className="text-[10px] font-bold mb-2 uppercase text-text-muted">
              {mode === 'hash' ? `Shard ${s} (ID%${numShards}==${s})` : `Shard ${s} (Range)`}
            </div>
            <div className="w-full h-40 bg-surface border border-border rounded-xl p-3 overflow-y-auto flex flex-wrap gap-2 content-start shadow-inner">
              <AnimatePresence mode="popLayout">
                {data.filter(d => d.shard === s).map(d => (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-8 h-8 md:w-10 md:h-10 bg-accent text-white flex items-center justify-center text-[10px] md:text-[11px] rounded shadow-md font-mono"
                  >
                    {d.id}
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.filter(d => d.shard === s).length === 0 && !isRebalancing && (
                <div className="w-full h-full flex items-center justify-center text-[8px] text-text-muted italic">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={addData} disabled={isRebalancing}>Insert Record</Button>
        <Button variant="outline" onClick={() => {
          setMode(prev => prev === 'hash' ? 'range' : 'hash');
          setData([]);
        }}>Mode: {mode === 'hash' ? 'Hash-based' : 'Range-based'}</Button>
        <Button variant="outline" onClick={rebalance} disabled={isRebalancing}>
          {isRebalancing ? 'Rebalancing...' : `Scale to ${numShards === 3 ? '4' : '3'} Shards`}
        </Button>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>
      
      <p className="mt-6 text-xs text-text-muted text-center max-w-md">
        {mode === 'hash' 
          ? "Hash sharding distributes data evenly using a hash function. Rebalancing often requires moving many records."
          : "Range sharding groups records by key ranges (e.g. 0-250, 251-500). Great for range queries but can lead to hot spots."}
      </p>
    </div>
  );
}
