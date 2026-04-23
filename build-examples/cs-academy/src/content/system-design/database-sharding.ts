import { Lesson } from '@/types';

export const shardingLesson: Lesson = {
  slug: 'database-sharding',
  title: 'Database Sharding',
  category: 'system-design',
  tagline: 'Splitting huge datasets across multiple machines.',
  readingMinutes: 9,
  animationKey: 'ShardingAnim',
  relatedSlugs: ['cap-theorem', 'caching'],
  sections: [
    {
      title: 'The Problem: Vertical Scaling Limits',
      content: 'Single database servers have a ceiling on how much data they can store and how many queries they can process. Once you reach the limits of the most powerful hardware available, you must find a way to scale horizontally.'
    },
    {
      title: 'The Solution: Horizontal Partitioning',
      content: 'Sharding breaks a large dataset into smaller, more manageable chunks called "shards." Each shard is stored on a separate database server. This allows the system to handle massive amounts of data by spreading the load across a cluster of machines.'
    },
    {
      title: 'How it Works in Practice: Sharding Keys',
      content: 'To determine which shard holds a specific piece of data, we use a "sharding key." \n\nRange-based Sharding: Shards are based on ranges of values (e.g., User IDs 1-1000).\n\nHash-based Sharding: A hash function is applied to the key to distribute data evenly.\n\nDirectory-based Sharding: A lookup table tracks which shard holds which data.'
    },
    {
      title: 'Trade-offs & Gotchas: Operational Complexity',
      content: 'Sharding introduces massive complexity. Joins across shards are extremely slow or impossible, and rebalancing data when a shard becomes too large ("hotspotting") requires significant engineering effort.'
    }
  ]
};
