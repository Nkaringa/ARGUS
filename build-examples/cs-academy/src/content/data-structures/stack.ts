import { Lesson } from '@/types';

export const stackLesson: Lesson = {
  slug: 'stack',
  title: 'Stack',
  category: 'data-structures',
  tagline: 'Last-In, First-Out (LIFO) order.',
  readingMinutes: 4,
  animationKey: 'StackAnim',
  relatedSlugs: ['queue', 'linked-list', 'array'],
  complexity: {
    access: 'O(n)',
    search: 'O(n)',
    insert: 'O(1)',
    delete: 'O(1)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is a Stack?',
      content: 'A stack is a linear data structure that follows the LIFO (Last-In, First-Out) principle. Think of it like a stack of plates: you can only add or remove the top plate.'
    },
    {
      title: 'Operations',
      content: 'The two primary operations are Push (add an item) and Pop (remove the most recently added item). Both are O(1) operations.'
    },
    {
      title: 'Use Cases',
      content: 'Stacks are essential for function call management (the call stack), undo mechanisms in editors, and expression parsing (like balanced parentheses).'
    }
  ]
};
