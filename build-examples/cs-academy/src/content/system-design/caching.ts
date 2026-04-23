import { Lesson } from '@/types';

export const cachingLesson: Lesson = {
  slug: 'caching',
  title: 'Caching',
  category: 'system-design',
  tagline: 'Trading memory for speed.',
  readingMinutes: 7,
  animationKey: 'CacheAnim',
  relatedSlugs: ['load-balancing', 'cdn', 'database-sharding'],
  sections: [
    {
      title: 'The Problem: High Latency & DB Load',
      content: 'Accessing data from a primary database is relatively slow because it often involves disk I/O. As traffic grows, the database can become a bottleneck, leading to slow response times for users.'
    },
    {
      title: 'The Solution: Temporary Fast Storage',
      content: 'Caching stores copies of data in a temporary, high-speed storage layer (like RAM). By serving frequent requests from the cache instead of the database, you drastically reduce latency and offload work from your main data store.'
    },
    {
      title: 'How it Works in Practice: Strategies',
      content: 'Cache-Aside: The application code is responsible for reading and writing from both the cache and the database.\n\nRead-Through: The cache library or provider automatically fetches missing data from the database.\n\nWrite-Through: Data is written to the cache and the database simultaneously, ensuring consistency.'
    },
    {
      title: 'Trade-offs & Gotchas: Cache Invalidation',
      content: '"There are only two hard things in Computer Science: cache invalidation and naming things." Keeping the cache in sync with the database is the biggest challenge. Stale data can lead to bugs, and a "cache stampede" can crash your DB if the cache expires all at once.'
    }
  ]
};
