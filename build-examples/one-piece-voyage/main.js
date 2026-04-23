import * as THREE from 'three';

// --- Configuration ---
const CONFIG = {
    oceanColor: 0x122038,
    colors: {
        cream: 0xf3ead8,
        gold: 0xd4a64a,
        sakura: 0xf3b4c5
    },
    waveSpeed: 0.5,
    waveAmplitude: 0.15,
    particleCount: 800,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

// --- Three.js Setup ---
let scene, camera, renderer, clock;
let ocean, particles, horizonShip;
let canvas = document.getElementById('bg-canvas');

function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 4);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    clock = new THREE.Clock();

    createOcean();
    createParticles();
    createHorizonShip();
    
    if (!CONFIG.reducedMotion) {
        animate();
    } else {
        render(); // Single frame
    }
}

function createOcean() {
    const geometry = new THREE.PlaneGeometry(20, 20, 80, 80);
    const material = new THREE.MeshBasicMaterial({
        color: CONFIG.oceanColor,
        wireframe: true,
        transparent: true,
        opacity: 0.2
    });

    ocean = new THREE.Mesh(geometry, material);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.5;
    scene.add(ocean);
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    const phases = new Float32Array(CONFIG.particleCount);

    const colorCream = new THREE.Color(CONFIG.colors.cream);
    const colorGold = new THREE.Color(CONFIG.colors.gold);
    const colorSakura = new THREE.Color(CONFIG.colors.sakura);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 15;
        positions[i3 + 1] = (Math.random() - 0.2) * 8;
        positions[i3 + 2] = (Math.random() - 0.5) * 15;

        // 70% cream, 20% gold, 10% sakura
        const rand = Math.random();
        let pColor = colorCream;
        if (rand > 0.9) pColor = colorSakura;
        else if (rand > 0.7) pColor = colorGold;

        colors[i3] = pColor.r;
        colors[i3 + 1] = pColor.g;
        colors[i3 + 2] = pColor.b;

        phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.phases = phases;

    const material = new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.4,
        vertexColors: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function createHorizonShip() {
    horizonShip = new THREE.Group();
    
    // Low poly hull
    const hullGeom = new THREE.BoxGeometry(0.4, 0.1, 0.15);
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1e });
    const hull = new THREE.Mesh(hullGeom, hullMat);
    horizonShip.add(hull);

    // Sails
    const sailGeom = new THREE.PlaneGeometry(0.15, 0.2);
    const sailMat = new THREE.MeshBasicMaterial({ 
        color: CONFIG.colors.cream, 
        transparent: true, 
        opacity: 0.35,
        side: THREE.DoubleSide 
    });
    
    for (let i = 0; i < 3; i++) {
        const sail = new THREE.Mesh(sailGeom, sailMat);
        sail.position.set(-0.1 + i * 0.1, 0.15, 0);
        horizonShip.add(sail);
    }

    horizonShip.position.set(-8, -0.3, -6);
    scene.add(horizonShip);
}

function updateOcean() {
    const time = clock.getElapsedTime() * CONFIG.waveSpeed;
    const positions = ocean.geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        
        const wave1 = Math.sin(x * 1.0 + time) * CONFIG.waveAmplitude;
        const wave2 = Math.sin(y * 1.2 + time * 0.8) * CONFIG.waveAmplitude;
        
        positions[i + 2] = wave1 + wave2;
    }

    ocean.geometry.attributes.position.needsUpdate = true;
}

function updateParticles() {
    const positions = particles.geometry.attributes.position.array;
    const phases = particles.geometry.userData.phases;
    const colors = particles.geometry.attributes.color.array;
    const time = clock.getElapsedTime();

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        positions[i3 + 1] += 0.002; // Upward drift
        
        // Sakura petals (pink) drift sideways
        if (colors[i3] > 0.9 && colors[i3 + 2] > 0.7) { // Very rough check for pink
            positions[i3] += Math.sin(time + phases[i]) * 0.001;
        }

        if (positions[i3 + 1] > 5) positions[i3 + 1] = -3;
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

function updateShip() {
    if (!horizonShip) return;
    const time = clock.getElapsedTime();
    horizonShip.position.x += 0.005;
    if (horizonShip.position.x > 8) horizonShip.position.x = -8;
    
    horizonShip.position.y = -0.3 + Math.sin(time * 0.4) * 0.05;
    horizonShip.rotation.z = Math.sin(time * 0.3) * 0.02;
}

function animate() {
    requestAnimationFrame(animate);
    updateOcean();
    updateParticles();
    updateShip();
    render();
}

function render() {
    renderer.render(scene, camera);
}

// --- Interaction & Reveal ---
function initInteractions() {
    // Letter Split for Hero Title
    const heroTitle = document.getElementById('hero-title');
    const text = heroTitle.textContent;
    heroTitle.textContent = '';
    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.className = 'letter';
        span.style.setProperty('--i', i);
        span.style.animationDelay = `${i * 90 + 200}ms`;
        heroTitle.appendChild(span);
    });

    // Bubble Cursor Trail
    let lastBubbleTime = 0;
    window.addEventListener('mousemove', (e) => {
        if (CONFIG.reducedMotion) return;
        const now = Date.now();
        if (now - lastBubbleTime < 80) return;
        lastBubbleTime = now;

        const bubble = document.createElement('span');
        bubble.className = 'bubble';
        bubble.style.left = `${e.clientX}px`;
        bubble.style.top = `${e.clientY}px`;
        document.body.appendChild(bubble);

        bubble.addEventListener('animationend', () => {
            bubble.remove();
        });
    });

    // Parallax Effect for Hero Content
    const heroContent = document.querySelector('#hero .content');
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateParallax() {
        if (lastScrollY < window.innerHeight) {
            heroContent.style.transform = `translateY(${lastScrollY * 0.3}px)`;
            heroContent.style.opacity = 1 - (lastScrollY / (window.innerHeight * 0.8));
        }
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (CONFIG.reducedMotion) return;
        lastScrollY = window.scrollY;
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    });

    // Card Flip
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('is-flipped');
        });
    });

    // Intersection Observer for Reveals
    const sections = document.querySelectorAll('.reveal-section');

    // Inject Haki Ripple elements
    sections.forEach(section => {
        const h2 = section.querySelector('h2');
        if (h2) {
            const ripple = document.createElement('span');
            ripple.className = 'haki-ripple';
            ripple.setAttribute('aria-hidden', 'true');
            h2.appendChild(ripple);
        }
    });

    const observerOptions = {
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                const h2 = entry.target.querySelector('h2');
                if (h2) {
                    h2.parentElement.classList.add('ripple-on');
                    // One shot: unobserve or handle in CSS? 
                    // Plan says one-shot, so let's unobserve if we want it strictly once.
                    // Actually, let's just let it be. 
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });

    // Quote Rotation (Ink Brush Wipe)
    const quotes = document.querySelectorAll('.quote');
    let currentQuote = 0;

    function rotateQuotes() {
        const prevQuote = quotes[currentQuote];
        prevQuote.classList.add('exiting');
        prevQuote.classList.remove('active');

        setTimeout(() => {
            prevQuote.classList.remove('exiting');
        }, 800);

        currentQuote = (currentQuote + 1) % quotes.length;
        quotes[currentQuote].classList.add('active');
    }

    if (quotes.length > 0) {
        setInterval(rotateQuotes, 5000);
    }
}

// --- Window Events ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (CONFIG.reducedMotion) render();
});

// --- Start ---
document.addEventListener('DOMContentLoaded', () => {
    initThree();
    initInteractions();
});
