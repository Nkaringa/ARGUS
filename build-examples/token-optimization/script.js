document.addEventListener('DOMContentLoaded', () => {
    // 1. Token Estimation Logic
    const estimateTokens = (text) => {
        if (!text) return 0;
        // Heuristic: ~4 characters per token
        return Math.ceil(text.trim().length / 4);
    };

    const formatCost = (tokens) => {
        const cost = (tokens / 1000000) * 3; // $3.00 per 1M tokens
        return '$' + cost.toFixed(6);
    };

    // 2. Estimator Elements
    const estimatorTextarea = document.getElementById('estimator-text');
    const resTokens = document.getElementById('res-tokens');
    const resCost = document.getElementById('res-cost');
    const resChars = document.getElementById('res-chars');

    if (estimatorTextarea) {
        estimatorTextarea.addEventListener('input', (e) => {
            const text = e.target.value;
            const tokens = estimateTokens(text);
            const chars = text.length;

            resTokens.textContent = tokens.toLocaleString();
            resCost.textContent = formatCost(tokens);
            resChars.textContent = chars.toLocaleString();
        });
    }

    // 3. Before/After Comparison Initialization
    const beforeText = document.getElementById('comparison-before')?.innerText || "";
    const afterText = document.getElementById('comparison-after')?.innerText || "";
    
    const beforeCountEl = document.getElementById('before-count');
    const afterCountEl = document.getElementById('after-count');
    const savingsCountEl = document.getElementById('savings-count');
    const savingsPercentEl = document.getElementById('savings-percent');

    if (beforeCountEl && afterCountEl) {
        const beforeCount = estimateTokens(beforeText);
        const afterCount = estimateTokens(afterText);
        const savingsCount = beforeCount - afterCount;
        const savingsPercent = Math.round((savingsCount / beforeCount) * 100);

        beforeCountEl.textContent = beforeCount;
        afterCountEl.textContent = afterCount;
        
        if (savingsCountEl && savingsPercentEl) {
            savingsCountEl.textContent = savingsCount;
            savingsPercentEl.textContent = savingsPercent;
        }
    }

    // 4. Copy to Clipboard
    const copyButtons = document.querySelectorAll('.copy-btn');

    copyButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const codeBlock = btn.nextElementSibling.querySelector('code');
            if (!codeBlock) return;

            const text = codeBlock.innerText;

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    
                    const originalText = btn.innerText;
                    btn.innerText = 'Copied!';
                    btn.style.background = '#10b981'; // success color
                    
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.background = '';
                    }, 1500);
                }
            } catch (err) {
                // Fail silently as per plan if clipboard API unavailable on file://
                // Removing console.error as requested in audit
            }
        });
    });

    // 5. Smooth Scroll for Nav Links (Extra polish)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
