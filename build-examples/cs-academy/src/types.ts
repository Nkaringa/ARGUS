export type Category = 'data-structures' | 'system-design';

export interface LessonSection {
  title: string;
  content: string;
}

export interface ComplexityTable {
  access: string;
  search: string;
  insert: string;
  delete: string;
  space: string;
}

export interface Lesson {
  slug: string;
  title: string;
  category: Category;
  tagline: string;
  readingMinutes: number;
  sections: LessonSection[];
  complexity?: ComplexityTable;
  animationKey: string;
  relatedSlugs: string[];
}
