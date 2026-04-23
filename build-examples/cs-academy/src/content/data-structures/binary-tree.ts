import { Lesson } from '@/types';

export const binaryTreeLesson: Lesson = {
  slug: 'binary-tree',
  title: 'Binary Search Tree',
  category: 'data-structures',
  tagline: 'Hierarchical data with sorted properties.',
  readingMinutes: 8,
  animationKey: 'BinaryTreeAnim',
  relatedSlugs: ['graph', 'hash-table'],
  complexity: {
    access: 'O(log n)',
    search: 'O(log n)',
    insert: 'O(log n)',
    delete: 'O(log n)',
    space: 'O(n)'
  },
  sections: [
    {
      title: 'What is a BST?',
      content: 'A Binary Search Tree (BST) is a node-based binary tree data structure where each node has at most two children. The left subtree contains only nodes with keys less than the node\'s key, and the right subtree contains only nodes with keys greater.'
    },
    {
      title: 'Efficiency',
      content: 'The O(log n) efficiency for search, insert, and delete assumes the tree is balanced. In the worst case (a skewed tree), it can degrade to O(n), behaving like a linked list.'
    },
    {
      title: 'Traversals',
      content: 'Common ways to visit nodes include In-order (left, root, right - gives sorted order), Pre-order (root, left, right), and Post-order (left, right, root).'
    }
  ]
};
