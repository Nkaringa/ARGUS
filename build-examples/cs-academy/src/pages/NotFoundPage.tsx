import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          className="inline-block p-6 bg-surface-2 rounded-3xl mb-8"
        >
          <FileQuestion className="w-16 h-16 text-accent" />
        </motion.div>
        <h1 className="text-4xl font-extrabold mb-4">404 - Topic Not Found</h1>
        <p className="text-xl text-foreground-muted mb-8 max-w-md mx-auto">
          The concept you're looking for doesn't exist yet, or the node has been garbage collected.
        </p>
        <Link to="/">
          <Button size="lg">Return to Base</Button>
        </Link>
      </div>
    </div>
  );
}
