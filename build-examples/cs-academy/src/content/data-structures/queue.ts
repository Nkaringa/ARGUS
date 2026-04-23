import { Lesson } from '@/types';

export const queueLesson: Lesson = {
  slug: 'queue',
  title: 'Queue',
  category: 'data-structures',
  tagline: 'First-In, First-Out (FIFO) order.',
  readingMinutes: 4,
  animationKey: 'QueueAnim',
  relatedSlugs: ['stack', 'linked-list', 'array'],
  complexity: {
    access: 'O(n)',
    search: 'O(n)',
    insert: 'O(1)',
    delete: 'O(1)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is a Queue?',
      content: 'A queue is a linear data structure that follows the FIFO (First-In, First-Out) principle. It is similar to a line of people waiting for a bus: the first person in line is the first one to get on.'
    },
    {
      title: 'Operations',
      content: 'The primary operations are Enqueue (add to the back) and Dequeue (remove from the front). Efficient implementations using a circular array or a linked list provide O(1) time for both.'
    },
    {
      title: 'Use Cases',
      content: 'Queues are used in asynchronous data transfer, IO buffers, and BFS (Breadth-First Search) in graphs.'
    }
  ]
};
