import { Lesson } from '@/types';

export const loadBalancingLesson: Lesson = {
  slug: 'load-balancing',
  title: 'Load Balancing',
  category: 'system-design',
  tagline: 'Distributing traffic to ensure high availability.',
  readingMinutes: 8,
  animationKey: 'LoadBalancerAnim',
  relatedSlugs: ['caching', 'cdn', 'message-queues'],
  sections: [
    {
      title: 'The Problem: The Single Server Bottleneck',
      content: 'When a single server can no longer handle the volume of requests, or when you need to ensure the system remains available even if one server fails, you need to scale horizontally. Without a way to distribute traffic, one server becomes a single point of failure.'
    },
    {
      title: 'The Solution: Traffic Orchestration',
      content: 'A load balancer sits in front of your servers and routes incoming client requests across all servers capable of fulfilling them. This maximizes speed and capacity utilization while ensuring that no one server is overworked.'
    },
    {
      title: 'How it Works in Practice: Algorithms',
      content: 'Load balancers use various algorithms to decide where to send traffic:\n\nRound Robin: Rotates through the list of servers sequentially.\n\nLeast Connections: Sends requests to the server with the fewest active sessions.\n\nIP Hash: Uses the client\'s IP address to determine which server receives the request, ensuring session persistence.'
    },
    {
      title: 'Trade-offs & Gotchas: Complexity vs. Reliability',
      content: 'While load balancers improve availability, they also introduce a new single point of failure if not themselves redundant. "Sticky sessions" can also lead to uneven load distribution if one client generates much more traffic than others.'
    }
  ]
};
