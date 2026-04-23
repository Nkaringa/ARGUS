import { Lesson } from '@/types';

export const cdnLesson: Lesson = {
  slug: 'cdn',
  title: 'Content Delivery Network',
  category: 'system-design',
  tagline: 'Bringing data closer to the user.',
  readingMinutes: 7,
  animationKey: 'CdnAnim',
  relatedSlugs: ['caching', 'load-balancing'],
  sections: [
    {
      title: 'The Problem: The Speed of Light',
      content: 'Physical distance causes latency. If your origin server is in New York and your user is in Tokyo, every request takes hundreds of milliseconds just to travel across the ocean, regardless of how fast your server is.'
    },
    {
      title: 'The Solution: Edge Servers',
      content: 'A Content Delivery Network (CDN) is a globally distributed network of "edge servers." By caching static content (images, JS, CSS) at the edge, you serve users from a location physically close to them, drastically reducing latency.'
    },
    {
      title: 'How it Works in Practice: Routing',
      content: 'When a user requests a file, DNS routing or Anycast IP addresses direct the request to the nearest edge node. If the node has the content cached, it serves it. Otherwise, it fetches it from the origin and caches it for future users.'
    },
    {
      title: 'Trade-offs & Gotchas: Purging & Cost',
      content: 'Purging (invalidating) content across thousands of global nodes can be slow. CDNs also add cost and complexity to your deployment pipeline, and "cache misses" at the edge can actually increase latency slightly compared to a direct origin request.'
    }
  ]
};
