import { cn } from '@/lib/cn';

export function CodeBlock({ code, language, className }: { code: string; language?: string; className?: string }) {
  return (
    <pre className={cn('bg-surface-2 p-4 rounded-lg overflow-x-auto border border-border font-mono text-sm leading-relaxed', className)}>
      <code className={language ? `language-${language}` : undefined}>{code}</code>
    </pre>
  );
}
