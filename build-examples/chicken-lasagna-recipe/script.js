document.addEventListener('DOMContentLoaded', () => {
    // --- Servings Adjuster ---
    const servingsDisplay = document.getElementById('servings-display');
    const minusBtn = document.getElementById('servings-minus');
    const plusBtn = document.getElementById('servings-plus');
    const qtyElements = document.querySelectorAll('[data-base-qty]');

    // Defensive guards for mandatory elements
    if (!servingsDisplay || !minusBtn || !plusBtn) {
        console.warn('Servings controls not found; scaling disabled.');
        return;
    }

    let currentServings = 8;
    const baseServings = 8;
    const minServings = 2;
    const maxServings = 16;

    const parseSingleQuantity = (str) => {
        if (!str) return 0;
        str = str.trim();
        if (str.includes(' ')) {
            const parts = str.split(/\s+/);
            return parseFloat(parts[0]) + parseSingleQuantity(parts[1]);
        }
        if (str.includes('/')) {
            const parts = str.split('/');
            return parseFloat(parts[0]) / parseFloat(parts[1]);
        }
        return parseFloat(str) || 0;
    };

    const parseQuantity = (str) => {
        if (str.includes('-')) {
            return str.split('-').map(s => parseSingleQuantity(s));
        }
        return parseSingleQuantity(str);
    };

    const formatSingleQuantity = (num) => {
        if (num === 0) return '';
        
        const whole = Math.floor(num);
        const fraction = num - whole;
        const tolerance = 0.02;

        if (fraction < tolerance) return whole.toString();
        if (1 - fraction < tolerance) return (whole + 1).toString();

        const commonFractions = [
            { val: 0.25, label: '1/4' },
            { val: 0.333, label: '1/3' },
            { val: 0.5, label: '1/2' },
            { val: 0.666, label: '2/3' },
            { val: 0.75, label: '3/4' }
        ];

        for (const f of commonFractions) {
            if (Math.abs(fraction - f.val) < tolerance) {
                return (whole > 0 ? whole + ' ' : '') + f.label;
            }
        }

        // If num > 4, try rounding to nearest 0.25 and using fraction labels
        if (num > 4) {
            const rounded = Math.round(num * 4) / 4;
            const rw = Math.floor(rounded);
            const rf = rounded - rw;
            if (rf === 0) return rw.toString();
            if (rf === 0.25) return rw + ' 1/4';
            if (rf === 0.5) return rw + ' 1/2';
            if (rf === 0.75) return rw + ' 3/4';
        }

        // Fallback
        return num.toFixed(1).replace(/\.0$/, '');
    };

    const formatQuantity = (qty) => {
        if (Array.isArray(qty)) {
            return qty.map(q => formatSingleQuantity(q)).join('-');
        }
        return formatSingleQuantity(qty);
    };

    const updateServings = (newServings) => {
        currentServings = Math.max(minServings, Math.min(maxServings, newServings));
        
        // Update display
        servingsDisplay.textContent = currentServings;
        
        // Update buttons state
        minusBtn.disabled = currentServings <= minServings;
        plusBtn.disabled = currentServings >= maxServings;

        // Recalculate quantities
        qtyElements.forEach(el => {
            const baseQtyRaw = el.getAttribute('data-base-qty');
            const baseValue = parseQuantity(baseQtyRaw);
            
            let scaledValue;
            if (Array.isArray(baseValue)) {
                scaledValue = baseValue.map(v => (v * currentServings) / baseServings);
            } else {
                scaledValue = (baseValue * currentServings) / baseServings;
            }
            
            el.textContent = formatQuantity(scaledValue);
        });
    };

    minusBtn.addEventListener('click', () => updateServings(currentServings - 2));
    plusBtn.addEventListener('click', () => updateServings(currentServings + 2));

    // --- Check-off Toggle ---
    const listItems = document.querySelectorAll('.check-list li');
    
    listItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't toggle if clicking a button inside (though there aren't any yet)
            if (e.target.tagName === 'BUTTON') return;
            item.classList.toggle('checked');
        });
    });

    // Initialize
    updateServings(currentServings);
});
