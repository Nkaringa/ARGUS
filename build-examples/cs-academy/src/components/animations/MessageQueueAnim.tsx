import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';

interface Message {
  id: number;
  val: number;
  retries: number;
}

const QUEUE_LIMIT = 5;

export default function MessageQueueAnim() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consumed, setConsumed] = useState<Message[]>([]);
  const [consumerHealthy, setConsumerHealthy] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const timersRef = useRef<number[]>([]);
  const healthyRef = useRef(true);

  // Sync ref with state
  useEffect(() => {
    healthyRef.current = consumerHealthy;
  }, [consumerHealthy]);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const produce = () => {
    if (messages.length >= QUEUE_LIMIT) return; // Backpressure
    const id = Date.now();
    const val = Math.floor(Math.random() * 999);
    setMessages(prev => [...prev, { id, val, retries: 0 }]);
  };

  const consume = () => {
    if (messages.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    const msg = messages[0];
    
    const timer = window.setTimeout(() => {
      // Check latest health status from ref
      if (healthyRef.current) {
        setMessages(prev => prev.slice(1));
        setConsumed(prev => [msg, ...prev.slice(0, 3)]);
        setIsProcessing(false);
      } else {
        // Consumer crashed! Message stays in queue or is returned for retry
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            const failed = { ...updated[0], retries: updated[0].retries + 1 };
            const rest = updated.slice(1);
            return [...rest, failed]; // Move to back of queue for "retry"
          }
          return prev;
        });
        setIsProcessing(false);
      }
    }, 1000);
    timersRef.current.push(timer);
  };

  if (shouldReduceMotion) {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-lg p-6 border-2 border-border rounded-xl bg-surface mb-8">
           <div className="flex justify-between items-center mb-6">
              <div className="text-center flex-1">
                 <div className="text-[10px] font-bold text-text-muted mb-1 uppercase">Queue Status</div>
                 <div className="text-xl font-bold font-mono">{messages.length} / {QUEUE_LIMIT}</div>
                 {messages.length >= QUEUE_LIMIT && <div className="text-[10px] text-danger font-bold uppercase mt-1">Backpressure Active</div>}
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center flex-1">
                 <div className="text-[10px] font-bold text-text-muted mb-1 uppercase">Consumer</div>
                 <div className={cn("text-xs font-bold uppercase", consumerHealthy ? "text-success" : "text-danger")}>
                    {consumerHealthy ? "Healthy" : "Crashed"}
                 </div>
              </div>
           </div>
           <div className="flex gap-2 justify-center">
             <Button onClick={produce} size="sm" disabled={messages.length >= QUEUE_LIMIT}>Produce Message</Button>
             <Button onClick={consume} size="sm" variant="outline" disabled={messages.length === 0}>Consume</Button>
             <Button onClick={() => setConsumerHealthy(!consumerHealthy)} size="sm" variant="ghost">Toggle Health</Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center">
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 mb-8 w-full max-w-2xl">
        {/* Producer */}
        <div className="flex flex-col items-center shrink-0">
          <div className={cn(
            "w-20 h-20 bg-surface border-2 rounded-2xl flex items-center justify-center text-xs font-bold shadow-sm transition-colors",
            messages.length >= QUEUE_LIMIT ? "border-danger text-danger" : "border-border text-text"
          )}>
            Producer
          </div>
          <Button size="sm" className="mt-4" onClick={produce} disabled={messages.length >= QUEUE_LIMIT}>
            {messages.length >= QUEUE_LIMIT ? 'Blocked' : 'Send Job'}
          </Button>
        </div>

        {/* Queue */}
        <div className="flex-grow w-full flex flex-col items-center">
          <div className="text-[10px] font-bold mb-3 uppercase tracking-wider text-text-muted">
            Queue ({messages.length}/{QUEUE_LIMIT})
          </div>
          <div className={cn(
            "w-full h-24 border-2 border-dashed rounded-2xl flex items-center px-4 gap-3 overflow-hidden transition-colors relative shadow-inner",
            messages.length >= QUEUE_LIMIT ? "bg-danger/5 border-danger/40" : "bg-surface-2 border-accent/40"
          )}>
            <AnimatePresence mode="popLayout">
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ x: -50, opacity: 0, scale: 0.8 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: 50, opacity: 0, scale: 0.8 }}
                  className={cn(
                    "w-12 h-12 shrink-0 text-white flex flex-col items-center justify-center text-[10px] rounded-xl font-mono shadow-md font-bold",
                    m.retries > 0 ? "bg-warn" : "bg-accent"
                  )}
                >
                  <span>{m.val}</span>
                  {m.retries > 0 && <span className="text-[8px]">R:{m.retries}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            {messages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-text-muted italic opacity-50">
                Queue Empty
              </div>
            )}
          </div>
          {messages.length >= QUEUE_LIMIT && (
            <div className="text-[9px] text-danger font-bold mt-2 animate-pulse">BACKPRESSURE: QUEUE FULL</div>
          )}
        </div>

        {/* Consumer */}
        <div className="flex flex-col items-center shrink-0">
          <button 
            type="button"
            onClick={() => setConsumerHealthy(!consumerHealthy)}
            aria-label={`Consumer is ${consumerHealthy ? 'healthy' : 'crashed'}. Click to toggle.`}
            className={cn(
              "w-20 h-20 border-2 rounded-2xl flex flex-col items-center justify-center text-xs font-bold shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              !consumerHealthy ? "bg-danger/10 border-danger text-danger" : "bg-surface border-border text-text",
              isProcessing && consumerHealthy && "ring-2 ring-success ring-offset-2"
            )}
          >
            <span>Consumer</span>
            <span className="text-[8px] mt-1 uppercase tracking-tighter">{consumerHealthy ? 'HEALTHY' : 'CRASHED'}</span>
          </button>
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-4" 
            onClick={consume} 
            disabled={messages.length === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Process'}
          </Button>
        </div>
      </div>

      {/* Processing History */}
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3">Recently Processed</h4>
        <div className="flex gap-2">
          {consumed.map((m) => (
            <div key={m.id} className="w-8 h-8 bg-surface-2 border border-border rounded flex items-center justify-center text-[10px] text-text-muted font-mono">
              {m.val}
            </div>
          ))}
          {consumed.length === 0 && <span className="text-xs text-text-muted italic">No jobs processed yet</span>}
        </div>
      </div>
      <p className="mt-6 text-[10px] text-text-muted text-center max-w-xs">
        Try crashing the consumer while it's processing to see the message returned for retry.
      </p>
    </div>
  );
}
