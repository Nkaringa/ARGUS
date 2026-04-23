import { Lesson, Category } from '@/types';
import { arrayLesson } from './data-structures/array';
import { linkedListLesson } from './data-structures/linked-list';
import { stackLesson } from './data-structures/stack';
import { queueLesson } from './data-structures/queue';
import { hashTableLesson } from './data-structures/hash-table';
import { binaryTreeLesson } from './data-structures/binary-tree';
import { graphLesson } from './data-structures/graph';
import { loadBalancingLesson } from './system-design/load-balancing';
import { cachingLesson } from './system-design/caching';
import { shardingLesson } from './system-design/database-sharding';
import { capTheoremLesson } from './system-design/cap-theorem';
import { messageQueuesLesson } from './system-design/message-queues';
import { cdnLesson } from './system-design/cdn';

export const lessons: Lesson[] = [
  arrayLesson,
  linkedListLesson,
  stackLesson,
  queueLesson,
  hashTableLesson,
  binaryTreeLesson,
  graphLesson,
  loadBalancingLesson,
  cachingLesson,
  shardingLesson,
  capTheoremLesson,
  messageQueuesLesson,
  cdnLesson
];

export const lessonsByCategory: Record<Category, Lesson[]> = {
  'data-structures': [
    arrayLesson,
    linkedListLesson,
    stackLesson,
    queueLesson,
    hashTableLesson,
    binaryTreeLesson,
    graphLesson
  ],
  'system-design': [
    loadBalancingLesson,
    cachingLesson,
    shardingLesson,
    capTheoremLesson,
    messageQueuesLesson,
    cdnLesson
  ]
};

export const getLessonBySlug = (slug: string) => lessons.find(l => l.slug === slug);
