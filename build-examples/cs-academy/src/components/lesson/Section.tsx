import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-100px" }}
      className="mb-12"
    >
      <h2 className="text-2xl font-bold mb-4 tracking-tight">{title}</h2>
      <div className="prose prose-lg dark:prose-invert max-w-none text-foreground-muted leading-relaxed">
        {children}
      </div>
    </motion.section>
  );
}
