import { Link } from 'react-router-dom';
import { lessonsByCategory } from '@/content';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Category } from '@/types';

interface CategoryPageProps {
  category: Category;
}

export function CategoryPage({ category }: CategoryPageProps) {
  const categoryLessons = lessonsByCategory[category];
  const title = category === 'data-structures' ? 'Data Structures' : 'System Design';
  const description = category === 'data-structures' 
    ? 'The fundamental building blocks for efficient software.' 
    : 'Principles and patterns for building massive scale systems.';

  return (
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-4">
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold mb-4 text-foreground">{title}</h1>
          <p className="text-xl text-foreground-muted max-w-2xl">{description}</p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {categoryLessons.map((lesson, i) => (
            <Link key={lesson.slug} to={`/${category}/${lesson.slug}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -5 }}
                className="p-8 bg-surface border border-border rounded-2xl h-full flex flex-col group transition-shadow hover:shadow-lg"
              >
                <Badge className="mb-4 w-fit">{lesson.readingMinutes} min read</Badge>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-accent transition-colors">{lesson.title}</h3>
                <p className="text-foreground-muted leading-relaxed mb-6 flex-grow">{lesson.tagline}</p>
                <div className="flex items-center text-sm font-semibold text-accent">
                  Start learning →
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
