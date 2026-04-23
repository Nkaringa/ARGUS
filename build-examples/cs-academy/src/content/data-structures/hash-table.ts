import { Lesson } from '@/types';

export const hashTableLesson: Lesson = {
  slug: 'hash-table',
  title: 'Hash Table',
  category: 'data-structures',
  tagline: 'Lightning-fast key-value lookups.',
  readingMinutes: 7,
  animationKey: 'HashTableAnim',
  relatedSlugs: ['array', 'binary-tree'],
  complexity: {
    access: 'N/A',
    search: 'O(1)',
    insert: 'O(1)',
    delete: 'O(1)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is a Hash Table?',
      content: 'A Hash Table (or Hash Map) is a data structure that maps keys to values using a hash function to compute an index into an array of buckets or slots.'
    },
    {
      title: 'Hash Functions & Collisions',
      content: 'A hash function takes an input (key) and returns an integer. Ideally, it distributes keys evenly. When two keys hash to the same index, a collision occurs. Common resolution strategies include Chaining (using a linked list at each index) and Open Addressing.'
    },
    {
      title: 'Why it matters',
      content: 'On average, Hash Tables provide O(1) time for search, insert, and delete. This makes them incredibly powerful for large-scale data retrieval.'
    }
  ]
};
