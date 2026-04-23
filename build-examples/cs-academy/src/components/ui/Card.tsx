import { cn } from '@/lib/cn';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function Card({ children, className, animate = true }: CardProps) {
  const Component = animate ? motion.div : 'div';
  return (
    <Component
      initial={animate ? { opacity: 0, y: 20 } : undefined}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true }}
      className={cn('bg-surface border border-border rounded-xl p-6 shadow-sm', className)}
    >
      {children}
    </Component>
  );
}
