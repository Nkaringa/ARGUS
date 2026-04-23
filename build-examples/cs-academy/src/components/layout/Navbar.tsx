import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Terminal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setIsOpen(false), [location]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-accent p-1.5 rounded-lg">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">CS Academy</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/data-structures" className="text-sm font-medium text-foreground-muted hover:text-accent transition-colors">Data Structures</Link>
            <Link to="/system-design" className="text-sm font-medium text-foreground-muted hover:text-accent transition-colors">System Design</Link>
            <ThemeToggle />
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-border bg-background overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              <Link to="/data-structures" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-surface-2 transition-colors">Data Structures</Link>
              <Link to="/system-design" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-surface-2 transition-colors">System Design</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
