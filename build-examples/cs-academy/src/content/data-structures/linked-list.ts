import { Lesson } from '@/types';

export const linkedListLesson: Lesson = {
  slug: 'linked-list',
  title: 'Linked List',
  category: 'data-structures',
  tagline: 'Dynamic memory allocation with pointers.',
  readingMinutes: 6,
  animationKey: 'LinkedListAnim',
  relatedSlugs: ['array', 'stack', 'queue'],
  complexity: {
    access: 'O(n)',
    search: 'O(n)',
    insert: 'O(1)',
    delete: 'O(1)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is a Linked List?',
      content: 'A linked list is a linear data structure where elements are not stored at contiguous memory locations. Instead, each element (node) contains a data field and a reference (link) to the next node in the sequence.'
    },
    {
      title: 'How it works',
      content: 'The first node is called the Head. If the list is empty, the head is a null reference. Since nodes are linked via pointers, inserting or deleting a node only requires changing a few pointers, making it O(1) if you already have a reference to the insertion point.'
    },
    {
      title: 'Trade-offs',
      content: 'Unlike arrays, linked lists do not allow random access. To reach the n-th element, you must traverse from the head, taking O(n) time. They also use more memory per element due to the storage of pointers.'
    }
  ]
};
