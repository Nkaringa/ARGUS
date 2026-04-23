import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Lesson } from '@/types';

interface SidebarProps {
  lessons: Lesson[];
}

export function Sidebar({ lessons }: SidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 overflow-y-auto sticky top-24 h-[calc(100vh-8rem)] pr-6">
      <nav className="space-y-1">
        <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-4 px-3">Topics</p>
        {lessons.map((lesson) => (
          <NavLink
            key={lesson.slug}
            to={`/${lesson.category}/${lesson.slug}`}
            className={({ isActive }) => cn(
              'block px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              isActive 
                ? 'bg-accent/10 text-accent' 
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-2'
            )}
          >
            {lesson.title}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
