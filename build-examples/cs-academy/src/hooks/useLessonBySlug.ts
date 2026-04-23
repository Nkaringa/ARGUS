import { getLessonBySlug } from '@/content';

export function useLessonBySlug(category: string | undefined, slug: string | undefined) {
  if (!category || !slug) return null;
  const lesson = getLessonBySlug(slug);
  if (lesson && lesson.category === category) {
    return lesson;
  }
  return null;
}
