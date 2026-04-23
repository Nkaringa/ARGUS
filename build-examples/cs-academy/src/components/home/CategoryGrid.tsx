import { Link } from 'react-router-dom';
import { Database, Server } from 'lucide-react';
import { motion } from 'framer-motion';
import React from 'react';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  gradientClass: string;
}

export function CategoryGrid() {
  return (
    <section className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          <CategoryCard
            title="Data Structures"
            description="The building blocks of software. Learn how data is organized, stored, and managed for efficient access and modification."
            icon={<Database className="w-8 h-8" />}
            to="/data-structures"
            gradientClass="from-accent/20 to-accent/5"
          />
          <CategoryCard
            title="System Design"
            description="Architecture at scale. Understand how to build distributed systems that are scalable, reliable, and maintainable."
            icon={<Server className="w-8 h-8" />}
            to="/system-design"
            gradientClass="from-accent-2/20 to-accent-2/5"
          />
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ title, description, icon, to, gradientClass }: CategoryCardProps) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -5 }}
        className="relative overflow-hidden p-8 rounded-2xl bg-background border border-border group transition-shadow hover:shadow-xl"
      >
        <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${gradientClass} opacity-50 rounded-bl-full group-hover:opacity-100 transition-opacity`} />
        <div className="mb-4 text-accent relative z-10">{icon}</div>
        <h3 className="text-2xl font-bold mb-3 text-foreground relative z-10">{title}</h3>
        <p className="text-foreground-muted leading-relaxed relative z-10">{description}</p>
        <div className="mt-6 flex items-center font-semibold text-accent group-hover:underline relative z-10">
          Browse topics →
        </div>
      </motion.div>
    </Link>
  );
}
