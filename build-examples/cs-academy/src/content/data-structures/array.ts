import { Lesson } from '@/types';

export const arrayLesson: Lesson = {
  slug: 'array',
  title: 'Arrays',
  category: 'data-structures',
  tagline: 'The foundation of linear data storage.',
  readingMinutes: 5,
  animationKey: 'ArrayAnim',
  relatedSlugs: ['linked-list', 'stack', 'queue'],
  complexity: {
    access: 'O(1)',
    search: 'O(n)',
    insert: 'O(n)',
    delete: 'O(n)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is an Array?',
      content: 'An array is a collection of items stored at contiguous memory locations. The idea is to store multiple items of the same type together. This makes it easier to calculate the position of each element by simply adding an offset to a base value, i.e., the memory location of the first element of the array.'
    },
    {
      title: 'How it works',
      content: 'Because elements are stored contiguously, arrays allow random access. If you know the index, you can jump directly to that memory address. However, this contiguous nature also means that inserting or deleting an element in the middle requires shifting all subsequent elements, leading to O(n) time complexity for those operations.'
    },
    {
      title: 'When to use',
      content: 'Arrays are best when you need fast access to elements by index and the size of the collection is relatively stable. They are the building blocks for many other data structures like Heaps, Hash Tables, and Strings.'
    }
  ]
};
