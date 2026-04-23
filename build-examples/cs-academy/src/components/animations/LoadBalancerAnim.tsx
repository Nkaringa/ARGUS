import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface Request {
  id: number;
  server: number;
}

type Algorithm = 'round-robin' | 'least-connections';

export default function LoadBalancerAnim() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [servers, setServers] = useState([
    { id: 0, connections: 0, healthy: true },
    { id: 1, connections: 0, healthy: true },
    { id: 2, connections: 0, healthy: true },
  ]);
  const [algorithm, setAlgorithm] = useState<Algorithm>('round-robin');
  const [nextServer, setNextServer] = useState(0);
  const isReduced = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const pushRequest = () => {
    let serverIndex = -1;

    if (algorithm === 'round-robin') {
      // Find next healthy server
      let attempts = 0;
      let curr = nextServer;
      while (attempts < servers.length) {
        if (servers[curr].healthy) {
          serverIndex = curr;
          setNextServer((curr + 1) % servers.length);
          break;
        }
        curr = (curr + 1) % servers.length;
        attempts++;
      }
    } else {
      // Least connections
      const healthyServers = servers.filter(s => s.healthy);
      if (healthyServers.length > 0) {
        const sorted = [...healthyServers].sort((a, b) => a.connections - b.connections);
        serverIndex = sorted[0].id;
      }
    }

    if (serverIndex === -1) return; // All servers down

    const id = Date.now();
    setRequests(prev => [...prev, { id, server: serverIndex }]);
    setServers(prev => prev.map(s => s.id === serverIndex ? { ...s, connections: s.connections + 1 } : s));
    
    const timer = window.setTimeout(() => {
      setRequests(prev => prev.filter(r => r.id !== id));
      setServers(prev => prev.map(s => s.id === serverIndex ? { ...s, connections: Math.max(0, s.connections - 1) } : s));
    }, 3000);
    timersRef.current.push(timer);
  };

  const toggleHealth = (id: number) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, healthy: !s.healthy, connections: s.healthy ? 0 : s.connections } : s));
  };

  const serverTops = ['16%', '50%', '84%'];

  if (isReduced) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="relative w-full max-w-[500px] h-64 border-2 border-border rounded-xl bg-surface mb-8 flex items-center justify-around shadow-sm p-4">
           <div className="flex flex-col items-center gap-2">
             <div className="w-12 h-12 bg-surface-2 border border-border rounded-lg flex items-center justify-center font-bold text-xs">Client</div>
             <div className="text-[10px] text-text-muted">Requests Source</div>
           </div>
           <div className="w-px h-12 bg-border" />
           <div className="flex flex-col items-center gap-2">
             <div className="w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center font-bold text-[10px] text-center p-2">
               Load Balancer
             </div>
             <div className="text-[10px] text-text-muted">Algorithm: {algorithm}</div>
           </div>
           <div className="w-px h-12 bg-border" />
           <div className="flex flex-col gap-2">
             {servers.map(s => (
               <div key={s.id} className={cn(
                 "w-20 h-8 border rounded flex items-center justify-center text-[10px] font-bold px-2",
                 s.healthy ? "bg-surface-2 border-border" : "bg-danger/10 border-danger text-danger"
               )}>
                 Server {s.id + 1} {!s.healthy && "(Down)"}
               </div>
             ))}
           </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={pushRequest}>Send Request</Button>
          <Button variant="outline" onClick={() => setAlgorithm(a => a === 'round-robin' ? 'least-connections' : 'round-robin')}>
            Mode: {algorithm === 'round-robin' ? 'Round Robin' : 'Least Conn'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center overflow-hidden">
      <div className="relative w-full max-w-[500px] h-64 border border-dashed border-border rounded-xl bg-surface mb-8 overflow-hidden shadow-inner">
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <line x1="15%" y1="50%" x2="50%" y2="50%" stroke="currentColor" strokeWidth="2" />
          <line x1="50%" y1="50%" x2="85%" y2="16%" stroke={servers[0].healthy ? "currentColor" : "var(--danger)"} strokeWidth="2" />
          <line x1="50%" y1="50%" x2="85%" y2="50%" stroke={servers[1].healthy ? "currentColor" : "var(--danger)"} strokeWidth="2" />
          <line x1="50%" y1="50%" x2="85%" y2="84%" stroke={servers[2].healthy ? "currentColor" : "var(--danger)"} strokeWidth="2" />
        </svg>

        {/* Client side */}
        <div className="absolute left-[5%] top-1/2 -translate-y-1/2 flex flex-col items-center z-20">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-2 border border-border rounded-lg flex items-center justify-center font-bold text-[10px] md:text-xs shadow-sm">Client</div>
        </div>

        {/* Load Balancer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-accent text-white rounded-full flex items-center justify-center font-bold text-[9px] md:text-[10px] text-center p-2 shadow-xl">
            {algorithm === 'round-robin' ? 'RR' : 'LC'}<br/>Balancer
          </div>
        </div>

        {/* Servers */}
        <div className="absolute right-[5%] top-0 bottom-0 flex flex-col justify-around z-20">
          {servers.map(s => (
            <button 
              key={s.id} 
              onClick={() => toggleHealth(s.id)}
              className={cn(
                "w-14 h-10 md:w-16 md:h-12 border rounded flex flex-col items-center justify-center text-[8px] md:text-[9px] font-bold shadow-sm transition-colors",
                s.healthy ? "bg-surface-2 border-border" : "bg-danger/20 border-danger text-danger"
              )}
            >
              <span>S{s.id + 1}</span>
              <span className="text-[7px] opacity-70">Conn: {s.connections}</span>
              {!s.healthy && <span className="text-[6px]">DOWN</span>}
            </button>
          ))}
        </div>

        {/* Animated Requests */}
        <AnimatePresence>
          {requests.map(req => (
            <motion.div
              key={req.id}
              initial={{ left: '12%', top: '50%', x: 0, y: -6, opacity: 0 }}
              animate={{
                left: ['12%', '45%', '80%', '80%'],
                top: ['50%', '50%', serverTops[req.server], serverTops[req.server]],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 2.5,
                times: [0, 0.2, 0.6, 1],
                ease: "easeInOut"
              }}
              className="absolute w-2 h-2 md:w-3 md:h-3 bg-accent rounded-full z-10"
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-2 md:gap-4">
        <Button size="sm" onClick={pushRequest}>Send Request</Button>
        <Button size="sm" variant="outline" onClick={() => setAlgorithm(a => a === 'round-robin' ? 'least-connections' : 'round-robin')}>
          Algo: {algorithm === 'round-robin' ? 'Round Robin' : 'Least Connections'}
        </Button>
        <div className="text-[10px] text-text-muted mt-2 w-full text-center">
          Click servers to toggle health (simulates failure)
        </div>
      </div>
    </div>
  );
}
