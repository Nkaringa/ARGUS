import { cn } from '@/lib/cn';

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20', className)}>
      {children}
    </span>
  );
}
