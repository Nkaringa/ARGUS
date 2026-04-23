document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    // Check for saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;
    
    // Apply initial theme
    html.setAttribute('data-theme', currentTheme);
    
    themeToggle.addEventListener('click', () => {
        const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Smooth Scrolling for Anchor Links
    const anchorLinks = document.querySelectorAll('nav a, .back-to-top');
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Only handle internal links
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href === '#' ? null : href.substring(1);
                const targetElement = targetId ? document.getElementById(targetId) : document.body;
                
                if (targetElement) {
                    // Using smooth behavior unless reduced motion is preferred
                    const scrollOptions = {
                        behavior: prefersReducedMotion ? 'auto' : 'smooth',
                        block: 'start'
                    };
                    
                    // Special case for "Back to top"
                    if (href === '#') {
                        window.scrollTo({
                            top: 0,
                            behavior: prefersReducedMotion ? 'auto' : 'smooth'
                        });
                    } else {
                        // Offset for sticky nav
                        const navHeight = document.querySelector('nav').offsetHeight;
                        const elementPosition = targetElement.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - navHeight;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: prefersReducedMotion ? 'auto' : 'smooth'
                        });
                    }
                    
                    // Update URL hash without jumping
                    if (targetId) {
                        history.pushState(null, null, `#${targetId}`);
                    } else {
                        history.pushState(null, null, window.location.pathname);
                    }
                }
            }
        });
    });
});
