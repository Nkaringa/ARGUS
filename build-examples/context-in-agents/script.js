document.addEventListener('DOMContentLoaded', () => {
    // --- Context Window Demo Logic ---
    const tokensPerType = {
        system: 1500,
        tools: 1200,
        user: 800,
        assistant: 2500,
        results: 5000,
        rag: 8000
    };

    const state = {
        system: 0,
        tools: 0,
        user: 0,
        assistant: 0,
        results: 0,
        rag: 0
    };

    const TOTAL_CAPACITY = 200000;
    const currentTokensEl = document.getElementById('current-tokens');
    const usagePill = document.getElementById('usage-pill');
    const resetBtn = document.getElementById('reset-btn');
    const chips = document.querySelectorAll('.chip');

    const updateUI = () => {
        let total = 0;
        for (const type in state) {
            const segment = document.getElementById(`segment-${type}`);
            if (segment) {
                const percentage = (state[type] / TOTAL_CAPACITY) * 100;
                segment.style.width = `${percentage}%`;
                // Hide text if segment is too small
                const span = segment.querySelector('span');
                if (span) span.style.display = percentage < 5 ? 'none' : 'block';
            }
            total += state[type];
        }

        currentTokensEl.textContent = total.toLocaleString();

        // Warning pill logic
        if (total > TOTAL_CAPACITY * 0.8) {
            usagePill.classList.remove('hidden');
            if (total >= TOTAL_CAPACITY) {
                usagePill.textContent = 'Context Full — Overflowing';
                usagePill.style.background = '#fee2e2';
                usagePill.style.color = '#991b1b';
            } else {
                usagePill.textContent = 'Compaction Recommended';
                usagePill.style.background = '#fef3c7';
                usagePill.style.color = '#92400e';
            }
        } else {
            usagePill.classList.add('hidden');
        }
    };

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.dataset.type;
            const total = Object.values(state).reduce((a, b) => a + b, 0);
            
            if (total < TOTAL_CAPACITY) {
                state[type] += tokensPerType[type];
                // Cap at total capacity for visual representation
                const newTotal = Object.values(state).reduce((a, b) => a + b, 0);
                if (newTotal > TOTAL_CAPACITY) {
                    const diff = newTotal - TOTAL_CAPACITY;
                    state[type] -= diff;
                }
                updateUI();
            }
        });
    });

    resetBtn.addEventListener('click', () => {
        for (const type in state) {
            state[type] = 0;
        }
        updateUI();
    });


    // --- Intersection Observer for Section Reveal ---
    const observerOptions = {
        threshold: 0.15
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply reveal class to sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        // Skip for users who prefer reduced motion
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            section.classList.add('section-reveal');
            revealObserver.observe(section);
        }
    });

    // --- Smooth Scroll for older browsers if needed ---
    // (CSS scroll-behavior: smooth covers most modern cases)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Initialize UI
    updateUI();
});
