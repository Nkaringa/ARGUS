import { Lesson } from '@/types';
import { Sidebar } from '../layout/Sidebar';
import { lessonsByCategory, lessons as allLessons } from '@/content';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, List } from 'lucide-react';
import { Suspense, useState } from 'react';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';

interface LessonLayoutProps {
  lesson: Lesson;
  children: React.ReactNode; // Animation component
}

export function LessonLayout({ lesson, children }: LessonLayoutProps) {
  const categoryLessons = lessonsByCategory[lesson.category];
  const currentIndex = categoryLessons.findIndex(l => l.slug === lesson.slug);
  const prev = categoryLessons[currentIndex - 1];
  const next = categoryLessons[currentIndex + 1];
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const relatedLessons = (lesson.relatedSlugs || [])
    .map(slug => allLessons.find(l => l.slug === slug))
    .filter((l): l is Lesson => !!l);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
      <Sidebar lessons={categoryLessons} />
      
      {/* Mobile Topic Picker */}
      <div className="lg:hidden mb-6">
        <button 
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl text-sm font-semibold"
          aria-expanded={isMobileNavOpen}
        >
          <span className="flex items-center"><List className="w-4 h-4 mr-2" /> All {lesson.category.replace('-', ' ')} Topics</span>
          <ChevronRight className={cn("w-4 h-4 transition-transform", isMobileNavOpen && "rotate-90")} />
        </button>
        
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-2 bg-surface-2 border border-border rounded-xl grid grid-cols-1 gap-1">
                {categoryLessons.map((l) => (
                  <Link
                    key={l.slug}
                    to={`/${l.category}/${l.slug}`}
                    onClick={() => setIsMobileNavOpen(false)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg transition-colors",
                      l.slug === lesson.slug ? "bg-accent/10 text-accent font-bold" : "text-foreground-muted hover:bg-surface"
                    )}
                  >
                    {l.title}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <article className="flex-grow min-w-0">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center space-x-3 mb-4">
            <Link to={`/${lesson.category}`} className="text-xs font-bold uppercase tracking-widest text-accent hover:underline">
              {lesson.category.replace('-', ' ')}
            </Link>
            <span className="text-border">/</span>
            <div className="flex items-center text-xs text-foreground-muted">
              <Clock className="w-3 h-3 mr-1" />
              {lesson.readingMinutes} min read
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight text-foreground">{lesson.title}</h1>
          <p className="text-lg md:text-xl text-foreground-muted leading-relaxed">{lesson.tagline}</p>
        </header>

        {/* Animation Slot */}
        <div className="mb-12 md:mb-16 bg-surface-2 rounded-2xl border border-border overflow-hidden min-h-[360px] flex items-center justify-center relative shadow-inner">
          <Suspense fallback={<div className="animate-pulse text-foreground-muted">Loading visualizer...</div>}>
            {children}
          </Suspense>
        </div>

        <div className="max-w-3xl">
          <div className="space-y-12">
            {lesson.sections.map((section, i) => (
              <div key={i} className="scroll-mt-24" id={section.title.toLowerCase().replace(/\s+/g, '-')}>
                <h2 className="text-2xl font-bold mb-4 text-foreground">{section.title}</h2>
                <div className="text-foreground-muted leading-relaxed space-y-4">
                  {section.content.split('\n\n').map((paragraph, pi) => (
                    <p key={pi}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {lesson.complexity && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-6 text-foreground">Complexity Analysis</h2>
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Operation</th>
                      <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-accent">Complexity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="px-6 py-4 text-sm">Access / Search</td>
                      <td className="px-6 py-4 font-mono text-sm text-accent">{lesson.complexity.access}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="px-6 py-4 text-sm">Insert</td>
                      <td className="px-6 py-4 font-mono text-sm text-accent">{lesson.complexity.insert}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="px-6 py-4 text-sm">Delete</td>
                      <td className="px-6 py-4 font-mono text-sm text-accent">{lesson.complexity.delete}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm">Space Complexity</td>
                      <td className="px-6 py-4 font-mono text-sm text-accent">{lesson.complexity.space}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {relatedLessons.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-6 text-foreground">Related Topics</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {relatedLessons.map(rl => (
                  <Link 
                    key={rl.slug} 
                    to={`/${rl.category}/${rl.slug}`}
                    className="p-4 rounded-xl border border-border hover:border-accent bg-surface transition-colors group"
                  >
                    <span className="text-xs text-foreground-muted uppercase tracking-wider mb-1 block">{rl.category.replace('-', ' ')}</span>
                    <span className="font-bold block group-hover:text-accent transition-colors">{rl.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row justify-between gap-4">
            {prev ? (
              <Link to={`/${lesson.category}/${prev.slug}`} className="flex-1 flex flex-col p-6 rounded-xl border border-border hover:bg-surface transition-colors items-start">
                <span className="text-xs text-foreground-muted flex items-center mb-1 uppercase tracking-wider font-bold"><ChevronLeft className="w-4 h-4 mr-1 text-accent" /> Previous</span>
                <span className="font-bold text-lg">{prev.title}</span>
              </Link>
            ) : <div className="flex-1" />}
            {next ? (
              <Link to={`/${lesson.category}/${next.slug}`} className="flex-1 flex flex-col p-6 rounded-xl border border-border hover:bg-surface transition-colors items-end text-right">
                <span className="text-xs text-foreground-muted flex items-center mb-1 uppercase tracking-wider font-bold">Next <ChevronRight className="w-4 h-4 ml-1 text-accent" /></span>
                <span className="font-bold text-lg">{next.title}</span>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        </div>
      </article>
    </div>
  );
}
