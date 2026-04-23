import { Lesson } from '@/types';

export const messageQueuesLesson: Lesson = {
  slug: 'message-queues',
  title: 'Message Queues',
  category: 'system-design',
  tagline: 'Decoupling services with asynchronous communication.',
  readingMinutes: 8,
  animationKey: 'MessageQueueAnim',
  relatedSlugs: ['load-balancing', 'cap-theorem'],
  sections: [
    {
      title: 'The Problem: Tight Coupling',
      content: 'In a synchronous system, Service A calls Service B and waits for a response. If Service B is slow or down, Service A is blocked. This "tight coupling" leads to cascading failures and poor scalability.'
    },
    {
      title: 'The Solution: Asynchronous Buffering',
      content: 'A message queue acts as a middleman. Service A (the Producer) sends a message to the queue and immediately moves on. Service B (the Consumer) picks up the message when it is ready. This decouples the timing of the two services.'
    },
    {
      title: 'How it Works in Practice: Patterns',
      content: 'Point-to-Point: Each message is consumed by exactly one consumer.\n\nPublish-Subscribe: A single message is broadcast to multiple interested subscribers.\n\nLoad Leveling: The queue acts as a buffer to protect consumers from sudden spikes in traffic.'
    },
    {
      title: 'Trade-offs & Gotchas: Eventual Consistency',
      content: 'Queues introduce "eventual consistency." A user might not see the result of their action immediately. You also need to handle "poison pill" messages that cause consumers to crash repeatedly.'
    }
  ]
};
