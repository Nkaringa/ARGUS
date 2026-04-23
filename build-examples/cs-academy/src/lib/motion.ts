export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
export const EASE_SPRING_SOFT = { type: 'spring', stiffness: 100, damping: 20 };

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE_OUT_EXPO }
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 }
};

export const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
