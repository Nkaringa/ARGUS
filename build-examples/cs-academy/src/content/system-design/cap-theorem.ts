import { Lesson } from '@/types';

export const capTheoremLesson: Lesson = {
  slug: 'cap-theorem',
  title: 'CAP Theorem',
  category: 'system-design',
  tagline: 'The fundamental trade-offs of distributed systems.',
  readingMinutes: 6,
  animationKey: 'CapTheoremAnim',
  relatedSlugs: ['database-sharding', 'load-balancing'],
  sections: [
    {
      title: 'The Problem: Reliability in Distributed Systems',
      content: 'In a distributed system, data is spread across multiple nodes. When the network is healthy, updates can be synchronized instantly. However, networks are unreliable — they can experience "partitions" where nodes cannot communicate. The CAP theorem defines what happens to your data guarantees during these inevitable failures.'
    },
    {
      title: 'The Three Pillars: C, A, and P',
      content: 'Consistency (C): Every read receives the most recent write or an error. It feels like a single-node system.\n\nAvailability (A): Every request receives a non-error response, without the guarantee that it contains the most recent write.\n\nPartition Tolerance (P): The system continues to operate despite an arbitrary number of messages being dropped or delayed by the network between nodes.'
    },
    {
      title: 'The Solution: Choosing Your Trade-offs',
      content: 'CAP theorem states that during a network partition, you must choose between Consistency and Availability. You cannot have both.\n\nCP (Consistency + Partition Tolerance): Wait for a response from the partitioned node, which might result in a timeout or error if the node is unreachable. Preferred for financial systems.\n\nAP (Availability + Partition Tolerance): Return the most recent version of the data you have, even if it might be stale. Preferred for social media feeds.'
    },
    {
      title: 'Practice: Real-world Applications',
      content: 'No system is 100% one or the other all the time. Many modern databases like Cassandra (AP) or MongoDB (CP) allow you to tune these settings per request. For example, you might require a "quorum" of nodes to agree on a write to ensure consistency.'
    }
  ]
};
