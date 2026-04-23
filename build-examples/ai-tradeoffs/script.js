document.addEventListener('DOMContentLoaded', () => {
    // Add js-enabled class for CSS hooks
    document.documentElement.classList.add('js-enabled');

    // 1. Scroll Fade-in Animation
    const meritCards = document.querySelectorAll('.merit-card');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        meritCards.forEach((card, index) => {
            // Apply a small staggered delay based on its position in the list
            const column = card.closest('.column');
            const cardsInColumn = Array.from(column.querySelectorAll('.merit-card'));
            const cardIndex = cardsInColumn.indexOf(card);
            card.style.transitionDelay = `${cardIndex * 60}ms`;
            revealObserver.observe(card);
        });
    } else {
        // Fallback: show immediately
        meritCards.forEach(card => card.classList.add('reveal'));
    }

    // 2. Mobile View Toggle (Tabs)
    const tabAi = document.getElementById('tab-ai');
    const tabHuman = document.getElementById('tab-human');
    const panelAi = document.getElementById('panel-ai');
    const panelHuman = document.getElementById('panel-human');

    function switchTab(target) {
        if (target === 'ai' || target === 'panel-ai') {
            tabAi.classList.add('active');
            tabAi.setAttribute('aria-selected', 'true');
            tabHuman.classList.remove('active');
            tabHuman.setAttribute('aria-selected', 'false');
            panelAi.classList.add('active');
            panelHuman.classList.remove('active');
        } else if (target === 'human' || target === 'panel-human') {
            tabHuman.classList.add('active');
            tabHuman.setAttribute('aria-selected', 'true');
            tabAi.classList.remove('active');
            tabAi.setAttribute('aria-selected', 'false');
            panelHuman.classList.add('active');
            panelAi.classList.remove('active');
        }
    }

    tabAi.addEventListener('click', () => switchTab('ai'));
    tabHuman.addEventListener('click', () => switchTab('human'));

    // Handle anchor navigation (hash links) syncing with tabs
    function handleHash() {
        const hash = window.location.hash.substring(1);
        if (hash === 'panel-ai' || hash === 'panel-human') {
            switchTab(hash);
        }
    }

    window.addEventListener('hashchange', handleHash);

    // Initialize mobile view
    handleHash(); // Check if starting with a specific hash
    if (!window.location.hash) switchTab('ai'); // Default
});
