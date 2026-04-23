import { Hero } from '@/components/home/Hero';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedTopics } from '@/components/home/FeaturedTopics';

export function HomePage() {
  return (
    <>
      <Hero />
      <CategoryGrid />
      <FeaturedTopics />
    </>
  );
}
