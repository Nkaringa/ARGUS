import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type CapMode = 'CP' | 'AP' | 'CA';

export default function CapTheoremAnim() {
  const [type, setType] = useState<CapMode>('CP');
  const shouldReduceMotion = useReducedMotion();

  const descriptions: Record<CapMode, string> = {
    CP: "Consistent & Partition Tolerant: System shuts down or returns errors if nodes can't sync. (e.g., MongoDB, HBase)",
    AP: "Available & Partition Tolerant: System stays up but might return stale data if nodes can't sync. (e.g., Cassandra, CouchDB)",
    CA: "Consistent & Available: Only possible if there are NO network partitions (e.g., a single-node database)."
  };

  if (shouldReduceMotion) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-sm p-6 border-2 border-border rounded-xl bg-surface mb-8">
           <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col items-center gap-1">
                 <div className={`w-3 h-3 rounded-full ${type === 'CA' || type === 'CP' ? 'bg-accent' : 'bg-border'}`} />
                 <div className="text-[8px] font-bold">CONSISTENCY</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                 <div className={`w-3 h-3 rounded-full ${type === 'CA' || type === 'AP' ? 'bg-accent' : 'bg-border'}`} />
                 <div className="text-[8px] font-bold">AVAILABILITY</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                 <div className={`w-3 h-3 rounded-full ${type === 'CP' || type === 'AP' ? 'bg-accent' : 'bg-border'}`} />
                 <div className="text-[8px] font-bold">PARTITION TOLERANCE</div>
              </div>
           </div>
           <div className="text-center font-bold text-accent mb-2">{type} MODE</div>
           <p className="text-xs text-text-muted text-center">{descriptions[type]}</p>
        </div>
        <div className="flex gap-2">
           {(['CP', 'AP', 'CA'] as CapMode[]).map(mode => (
             <Button key={mode} size="sm" variant={type === mode ? 'primary' : 'outline'} onClick={() => setType(mode)}>{mode}</Button>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center">
      <div className="relative w-full max-w-sm aspect-square mb-8">
        <svg viewBox="0 0 100 100" width="100%" height="100%" className="overflow-visible">
          {/* Triangle */}
          <motion.polygon 
            points="50,10 90,80 10,80" 
            fill="none" 
            stroke="currentColor" 
            className="text-border" 
            strokeWidth="2"
            animate={{ strokeDasharray: [100, 100], strokeDashoffset: [100, 0] }}
          />
          
          {/* Points */}
          <g>
            <circle cx="50" cy="10" r="5" className={type === 'CA' ? 'fill-accent' : 'fill-border transition-colors'} />
            <text x="50" y="-2" textAnchor="middle" className="text-[5px] fill-foreground font-bold uppercase">Consistency</text>
          </g>
          <g>
            <circle cx="90" cy="80" r="5" className={type === 'AP' ? 'fill-accent' : 'fill-border transition-colors'} />
            <text x="90" y="92" textAnchor="middle" className="text-[5px] fill-foreground font-bold uppercase">Availability</text>
          </g>
          <g>
            <circle cx="10" cy="80" r="5" className={type === 'CP' ? 'fill-accent' : 'fill-border transition-colors'} />
            <text x="10" y="92" textAnchor="middle" className="text-[5px] fill-foreground font-bold uppercase">Partition Tolerance</text>
          </g>

          {/* Indicator Node */}
          <motion.circle
            cx={type === 'CA' ? 50 : type === 'AP' ? 90 : 10}
            cy={type === 'CA' ? 10 : 80}
            r="8"
            className="fill-accent opacity-30"
            animate={{
              cx: type === 'CA' ? 50 : type === 'AP' ? 90 : 10,
              cy: type === 'CA' ? 10 : 80,
              scale: [1, 1.5, 1],
            }}
            transition={{
              cx: { type: "spring", stiffness: 100, damping: 15 },
              cy: { type: "spring", stiffness: 100, damping: 15 },
              scale: { repeat: Infinity, duration: 2 }
            }}
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {(['CP', 'AP', 'CA'] as CapMode[]).map(mode => (
          <Button 
            key={mode}
            size="sm" 
            variant={type === mode ? 'primary' : 'outline'} 
            onClick={() => setType(mode)}
            className="font-bold"
          >
            {mode} Mode
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-6 bg-surface border-l-4 border-accent rounded-r-xl w-full max-w-lg shadow-sm"
        >
          <h4 className="font-bold text-accent mb-2">{type} Guarantees</h4>
          <p className="text-sm text-foreground-muted leading-relaxed">
            {descriptions[type]}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
