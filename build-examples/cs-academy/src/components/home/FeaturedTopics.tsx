import { lessons } from '@/content';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '../ui/Badge';

export function FeaturedTopics() {
  const featured = lessons.slice(0, 4);

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12">Featured Lessons</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((lesson) => (
            <Link key={lesson.slug} to={`/${lesson.category}/${lesson.slug}`}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-6 bg-surface border border-border rounded-xl h-full flex flex-col"
              >
                <Badge className="mb-4 w-fit">{lesson.category === 'data-structures' ? 'Data Structure' : 'System Design'}</Badge>
                <h4 className="text-lg font-bold mb-2">{lesson.title}</h4>
                <p className="text-sm text-foreground-muted mb-4 flex-grow">{lesson.tagline}</p>
                <span className="text-xs font-semibold text-accent">Read lesson →</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
