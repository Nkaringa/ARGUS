import { Lesson } from '@/types';

export const graphLesson: Lesson = {
  slug: 'graph',
  title: 'Graph',
  category: 'data-structures',
  tagline: 'Modeling complex relationships between entities.',
  readingMinutes: 10,
  animationKey: 'GraphAnim',
  relatedSlugs: ['binary-tree', 'linked-list'],
  complexity: {
    access: 'N/A',
    search: 'O(V+E)',
    insert: 'O(1)',
    delete: 'O(E)',
    space: 'O(V+E)'
  },
  sections: [
    {
      title: 'What is a Graph?',
      content: 'A Graph consists of a finite set of vertices (or nodes) and set of Edges which connect a pair of nodes. Graphs can be directed (one-way) or undirected (two-way).'
    },
    {
      title: 'Representations',
      content: 'The two most common ways to represent a graph are Adjacency Matrix (a 2D array) and Adjacency List (an array of lists). Adjacency lists are generally more space-efficient for sparse graphs.'
    },
    {
      title: 'Algorithms',
      content: 'Fundamental graph algorithms include Breadth-First Search (BFS) for finding shortest paths in unweighted graphs and Depth-First Search (DFS) for exploring deep into connections.'
    }
  ]
};
