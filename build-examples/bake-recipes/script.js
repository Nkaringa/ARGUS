document.addEventListener('DOMContentLoaded', () => {
    // 1. Unit Toggle Logic
    const toggleUs = document.getElementById('toggle-us');
    const toggleMetric = document.getElementById('toggle-metric');
    const ingredientItems = document.querySelectorAll('.ingredient-list li[data-us]');

    function updateUnits(system) {
        document.body.className = `units-${system}`;
        
        // Update button states
        if (system === 'us') {
            toggleUs.classList.add('active');
            toggleUs.setAttribute('aria-checked', 'true');
            toggleMetric.classList.remove('active');
            toggleMetric.setAttribute('aria-checked', 'false');
        } else {
            toggleMetric.classList.add('active');
            toggleMetric.setAttribute('aria-checked', 'true');
            toggleUs.classList.remove('active');
            toggleUs.setAttribute('aria-checked', 'false');
        }

        // Update ingredient display
        ingredientItems.forEach(item => {
            const value = item.getAttribute(`data-${system}`);
            item.setAttribute('data-display', value);
        });
    }

    toggleUs.addEventListener('click', () => updateUnits('us'));
    toggleMetric.addEventListener('click', () => updateUnits('metric'));

    // Initialize with US units
    updateUnits('us');


    // 2. Step Check-off Logic
    const stepButtons = document.querySelectorAll('.step-item');

    stepButtons.forEach(button => {
        button.addEventListener('click', () => {
            const isPressed = button.getAttribute('aria-pressed') === 'true';
            button.setAttribute('aria-pressed', !isPressed);
        });
    });


    // 3. Scroll Reveal Animation
    const revealSections = document.querySelectorAll('.reveal-section');
    
    if (window.IntersectionObserver) {
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Once visible, we can stop observing this specific section
                    revealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealSections.forEach(section => {
            revealObserver.observe(section);
        });
    } else {
        // Fallback for older browsers
        revealSections.forEach(section => section.classList.add('is-visible'));
    }

    // 4. Smooth Scrolling for Internal Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
