import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useLessonBySlug } from '@/hooks/useLessonBySlug';
import { LessonLayout } from '@/components/lesson/LessonLayout';
import { Category } from '@/types';

// Dynamic animation imports with proper typing
const animations: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  ArrayAnim: React.lazy(() => import('@/components/animations/ArrayAnim')),
  LinkedListAnim: React.lazy(() => import('@/components/animations/LinkedListAnim')),
  StackAnim: React.lazy(() => import('@/components/animations/StackAnim')),
  QueueAnim: React.lazy(() => import('@/components/animations/QueueAnim')),
  HashTableAnim: React.lazy(() => import('@/components/animations/HashTableAnim')),
  BinaryTreeAnim: React.lazy(() => import('@/components/animations/BinaryTreeAnim')),
  GraphAnim: React.lazy(() => import('@/components/animations/GraphAnim')),
  LoadBalancerAnim: React.lazy(() => import('@/components/animations/LoadBalancerAnim')),
  CacheAnim: React.lazy(() => import('@/components/animations/CacheAnim')),
  ShardingAnim: React.lazy(() => import('@/components/animations/ShardingAnim')),
  CapTheoremAnim: React.lazy(() => import('@/components/animations/CapTheoremAnim')),
  MessageQueueAnim: React.lazy(() => import('@/components/animations/MessageQueueAnim')),
  CdnAnim: React.lazy(() => import('@/components/animations/CdnAnim')),
};

interface LessonPageProps {
  category: Category;
}

export function LessonPage({ category }: LessonPageProps) {
  const { slug } = useParams();
  const lesson = useLessonBySlug(category, slug);

  if (!lesson) {
    return <Navigate to="/404" replace />;
  }

  const AnimationComponent = animations[lesson.animationKey];

  return (
    <LessonLayout lesson={lesson}>
      {AnimationComponent ? (
        <React.Suspense fallback={<div className="h-[360px] flex items-center justify-center bg-surface-2 rounded-xl animate-pulse">Loading Animation...</div>}>
          <AnimationComponent />
        </React.Suspense>
      ) : (
        <div className="h-[360px] flex items-center justify-center bg-surface-2 rounded-xl text-foreground-muted italic">
          Animation coming soon...
        </div>
      )}
    </LessonLayout>
  );
}
