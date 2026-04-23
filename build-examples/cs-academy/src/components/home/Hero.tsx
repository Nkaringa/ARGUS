import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useMemo } from 'react';

export function Hero() {
  const words = "Master System Design and Data Structures".split(" ");
  const shouldReduceMotion = useReducedMotion();

  // Memoize random values to prevent re-render jumps and maintain stability
  const nodes = useMemo(() => [...Array(12)].map(() => ({
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    r: Math.random() * 20 + 5,
    tx: Math.random() * 100 - 50,
    ty: Math.random() * 100 - 50,
    duration: Math.random() * 10 + 10,
  })), []);

  const lines = useMemo(() => [...Array(15)].map(() => ({
    x1: Math.random() * 1000,
    y1: Math.random() * 1000,
    x2: Math.random() * 1000,
    y2: Math.random() * 1000,
    duration: Math.random() * 5 + 5,
  })), []);

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-background">
      {/* Drifting Background Nodes */}
      <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none">
        <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
          {nodes.map((node, i) => (
            <motion.circle
              key={i}
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill="currentColor"
              className="text-accent"
              animate={shouldReduceMotion ? {} : {
                x: [0, node.tx, 0],
                y: [0, node.ty, 0],
              }}
              transition={{
                duration: node.duration,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
          {lines.map((line, i) => (
            <motion.line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="currentColor"
              className="text-border"
              strokeWidth="1"
              animate={shouldReduceMotion ? {} : {
                opacity: [0.1, 0.5, 0.1],
              }}
              transition={{
                duration: line.duration,
                repeat: Infinity,
              }}
            />
          ))}
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-foreground">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="inline-block mr-4"
            >
              {word}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-xl text-foreground-muted mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Interactive visualizers and high-end animations to help you understand abstract concepts. Build intuition, not just memorization.
        </motion.p>
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <Link to="/data-structures">
            <Button size="lg" className="w-full sm:w-auto">Data Structures</Button>
          </Link>
          <Link to="/system-design">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">System Design</Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
