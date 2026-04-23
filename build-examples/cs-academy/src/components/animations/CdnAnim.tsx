import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface Request {
  id: number;
  edgeIdx: number;
  userPos: { x: number, y: number };
  isCacheHit: boolean;
  status: 'to-edge' | 'to-origin' | 'from-origin' | 'to-user';
}

const ORIGIN = { x: 50, y: 25 };
const EDGES = [
  { x: 20, y: 35, label: 'US-East' },
  { x: 50, y: 10, label: 'EU-West' },
  { x: 80, y: 40, label: 'Asia-South' },
];

export default function CdnAnim() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [cachedEdges, setCachedEdges] = useState<Set<number>>(new Set());
  const shouldReduceMotion = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const sendRequest = () => {
    const id = Date.now();
    const userPos = { x: Math.random() * 80 + 10, y: Math.random() * 30 + 10 };
    
    // Find nearest edge
    let nearestIdx = 0;
    let minChildDist = Infinity;
    EDGES.forEach((e, i) => {
      const dist = Math.sqrt((e.x - userPos.x)**2 + (e.y - userPos.y)**2);
      if (dist < minChildDist) {
        minChildDist = dist;
        nearestIdx = i;
      }
    });

    const isCacheHit = cachedEdges.has(nearestIdx);
    const newReq: Request = { id, edgeIdx: nearestIdx, userPos, isCacheHit, status: 'to-edge' };
    setRequests(prev => [...prev, newReq]);

    // Animation timeline
    if (isCacheHit) {
      // Direct to edge and back
      const t1 = window.setTimeout(() => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'to-user' } : r));
      }, 800);
      const t2 = window.setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
      }, 1600);
      timersRef.current.push(t1, t2);
    } else {
      // Edge to Origin to Edge to User
      const t1 = window.setTimeout(() => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'to-origin' } : r));
      }, 600);
      const t2 = window.setTimeout(() => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'from-origin' } : r));
      }, 1400);
      const t3 = window.setTimeout(() => {
        setCachedEdges(prev => new Set(prev).add(nearestIdx));
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'to-user' } : r));
      }, 2200);
      const t4 = window.setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
      }, 3000);
      timersRef.current.push(t1, t2, t3, t4);
    }
  };

  const clearCache = () => setCachedEdges(new Set());

  if (shouldReduceMotion) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-lg p-6 border-2 border-border rounded-xl bg-surface mb-8">
           <div className="grid grid-cols-3 gap-4 mb-6">
              {EDGES.map((e, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                   <div className="text-[8px] font-bold text-text-muted uppercase">{e.label}</div>
                   <div className={cn(
                     "w-10 h-10 rounded flex items-center justify-center text-[8px] font-bold border-2 transition-colors",
                     cachedEdges.has(i) ? "bg-accent text-white border-accent" : "bg-surface border-border text-text-muted"
                   )}>
                      {cachedEdges.has(i) ? "CACHED" : "EMPTY"}
                   </div>
                </div>
              ))}
           </div>
           <div className="flex gap-2 justify-center">
             <Button onClick={sendRequest} size="sm">Simulate Request</Button>
             <Button onClick={clearCache} size="sm" variant="ghost">Purge Cache</Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center">
      <div className="relative w-full aspect-[2.2/1] bg-surface-2 border border-border rounded-2xl overflow-hidden mb-8 shadow-inner">
        {/* Map Background */}
        <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full opacity-5 pointer-events-none fill-foreground">
          <path d="M5,15 Q15,5 30,10 T50,15 T70,10 T90,20 T95,40 T75,45 T45,40 T15,45 Z" />
        </svg>

        {/* Origin */}
        <div className="absolute left-1/2 top-[25%] -translate-x-1/2 flex flex-col items-center z-10">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-surface border-2 border-accent rounded-xl flex items-center justify-center text-[7px] md:text-[9px] font-bold shadow-lg">
            ORIGIN
          </div>
          <div className="text-[6px] mt-1 font-mono text-text-muted uppercase">Source Server</div>
        </div>

        {/* Edges */}
        {EDGES.map((e, i) => (
          <div 
            key={i} 
            className="absolute flex flex-col items-center z-10" 
            style={{ left: `${e.x}%`, top: `${e.y + 20}%`, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div 
              animate={{ 
                borderColor: cachedEdges.has(i) ? 'var(--accent)' : 'var(--border)',
                backgroundColor: cachedEdges.has(i) ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent'
              }}
              className="w-10 h-10 md:w-12 md:h-12 border-2 rounded-lg flex flex-col items-center justify-center shadow-md bg-surface"
            >
              <span className="text-[7px] font-bold">EDGE</span>
              <div className={cn(
                "w-2 h-2 rounded-full mt-1",
                cachedEdges.has(i) ? "bg-accent animate-pulse" : "bg-border"
              )} />
            </motion.div>
            <span className="text-[6px] md:text-[7px] mt-1 font-bold text-text-muted uppercase tracking-tighter">
              {e.label}
            </span>
          </div>
        ))}

        {/* Animated Requests */}
        <AnimatePresence>
          {requests.map(req => {
            const edge = EDGES[req.edgeIdx];
            let start = { x: req.userPos.x, y: req.userPos.y };
            let end = { x: edge.x, y: edge.y + 20 };

            if (req.status === 'to-origin') {
              start = { x: edge.x, y: edge.y + 20 };
              end = { x: ORIGIN.x, y: ORIGIN.y + 5 }; // Adjusted origin y for visual
            } else if (req.status === 'from-origin') {
              start = { x: ORIGIN.x, y: ORIGIN.y + 5 };
              end = { x: edge.x, y: edge.y + 20 };
            } else if (req.status === 'to-user') {
              start = { x: edge.x, y: edge.y + 20 };
              end = { x: req.userPos.x, y: req.userPos.y };
            }

            return (
              <motion.div
                key={`${req.id}-${req.status}`}
                initial={{ left: `${start.x}%`, top: `${start.y}%`, opacity: 0, scale: 0.5 }}
                animate={{ left: `${end.x}%`, top: `${end.y}%`, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "absolute w-2 h-2 rounded-full z-20 shadow-[0_0_8px_var(--accent)]",
                  req.status === 'to-edge' || req.status === 'to-user' ? "bg-accent" : "bg-warn"
                )}
              >
                {/* User Placeholder */}
                {req.status === 'to-edge' && (
                  <div className="absolute -inset-1 border border-accent rounded-full animate-ping" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <Button onClick={sendRequest}>Simulate User Request</Button>
        <Button variant="outline" onClick={clearCache}>Purge Global Cache</Button>
      </div>
      <p className="mt-4 text-[10px] text-text-muted text-center max-w-sm">
        Requests target the <strong>nearest edge</strong>. If data is <strong>EMPTY</strong> (gray), it's fetched from <strong>ORIGIN</strong> (orange path) and then <strong>CACHED</strong> (blue pulse).
      </p>
    </div>
  );
}
