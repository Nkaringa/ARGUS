import { ComplexityTable } from '@/types';
import { motion } from 'framer-motion';

export function Complexity({ complexity }: { complexity: ComplexityTable }) {
  const rows = [
    { label: 'Access', value: complexity.access || 'N/A' },
    { label: 'Search', value: complexity.search },
    { label: 'Insert', value: complexity.insert },
    { label: 'Delete', value: complexity.delete },
    { label: 'Space', value: complexity.space },
  ];

  return (
    <div className="mt-8 mb-12">
      <h3 className="text-xl font-bold mb-4">Time & Space Complexity</h3>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Operation</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Complexity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <motion.tr
                key={row.label}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <td className="px-6 py-4 text-sm font-medium">{row.label}</td>
                <td className="px-6 py-4 text-sm font-mono text-accent">{row.value}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
