document.addEventListener('DOMContentLoaded', () => {
    const scenes = document.querySelectorAll('.scene');
    const timelineDots = document.querySelectorAll('.mini-timeline .dot');
    const heroTagline = document.getElementById('hero-tagline');
    const pipelineStatus = document.getElementById('pipeline-status');
    const taskToken = document.getElementById('task-token');
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const artifacts = {
        plan: document.getElementById('artifact-plan'),
        build: document.getElementById('artifact-build'),
        audit: document.getElementById('artifact-audit')
    };
    const stations = {
        hermes: document.querySelector('.station.hermes'),
        claude: document.querySelector('.station.claude'),
        gemini: document.querySelector('.station.gemini'),
        codex: document.querySelector('.station.codex')
    };

    // 1. Intersection Observer for scene activation and lifecycle
    const observerOptions = {
        threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Toggle in-view class for continuous/looping animations
            entry.target.classList.toggle('in-view', entry.isIntersecting);

            if (entry.isIntersecting) {
                // One-time activation for entry animations
                if (!entry.target.classList.contains('active')) {
                    entry.target.classList.add('active');
                    
                    // Trigger specific scene entry effects (unless reduced motion)
                    if (!prefersReducedMotion) {
                        if (entry.target.id === 'scene-0') {
                            typeText(heroTagline);
                        }
                        if (entry.target.id === 'scene-1') {
                            document.querySelectorAll('.role-label-typed').forEach((el, idx) => {
                                setTimeout(() => typeText(el), 500 + (idx * 200));
                            });
                        }
                        if (entry.target.id === 'scene-4') {
                            animateWarZone();
                        }
                    } else {
                        // Fallback for reduced motion: show content immediately
                        if (entry.target.id === 'scene-0') {
                            heroTagline.textContent = heroTagline.getAttribute('data-text');
                        }
                        if (entry.target.id === 'scene-1') {
                            document.querySelectorAll('.role-label-typed').forEach(el => {
                                el.textContent = el.getAttribute('data-text');
                            });
                        }
                        if (entry.target.id === 'scene-4') {
                            document.querySelector('.warzone-doc-forming').classList.add('visible');
                        }
                    }
                }

                updateTimeline(entry.target.id);
                
                // Continuous/Looping triggers
                if (!prefersReducedMotion) {
                    if (entry.target.id === 'scene-2') {
                        startPipelineDemo();
                    }
                    if (entry.target.id === 'scene-5') {
                        startMiniPipelineLoop();
                    }
                }
            }
        });
    }, observerOptions);

    scenes.forEach(scene => observer.observe(scene));

    function updateTimeline(sceneId) {
        const index = sceneId.split('-')[1];
        timelineDots.forEach((dot, i) => {
            if (i == index) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }

    // 2. Typed-text helper
    function typeText(element) {
        if (element.classList.contains('typed') || prefersReducedMotion) return;
        const text = element.getAttribute('data-text');
        let i = 0;
        element.classList.add('typed');
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, 40);
            }
        }
        type();
    }

    // 3. Scene 2: Pipeline Demo Logic
    let pipelineInterval;
    function startPipelineDemo() {
        if (pipelineInterval || prefersReducedMotion) return;
        
        const sequence = [
            { station: 'hermes', status: 'Orchestrating Task...', x: 125, artifact: null },
            { station: 'claude', status: 'Planning approach...', x: 375, artifact: 'plan' },
            { station: 'gemini', status: 'Executing build...', x: 625, artifact: 'build' },
            { station: 'codex', status: 'Auditing results...', x: 875, artifact: 'audit' }
        ];

        let step = 0;
        let isRevising = false;
        const scene2 = document.getElementById('scene-2');
        const revisePath = document.getElementById('revise-path');
        const reviseLabel = document.querySelector('.revise-label');
        const archiveLine = document.querySelector('.archive-line');
        const archiveNode = document.getElementById('archive-node');
        
        function runStep() {
            // Pause loop if Scene 2 is out of view or in scrub mode
            if (!scene2.classList.contains('in-view') || document.body.classList.contains('scene-2-scrub')) {
                setTimeout(runStep, 1000);
                return;
            }

            const current = sequence[step];
            
            // Move token
            taskToken.style.transition = isRevising && step === 2 ? 'transform 1.5s ease-in-out' : 'transform 1s var(--ease-out)';
            taskToken.setAttribute('transform', `translate(${current.x}, 100)`);
            
            // Update stations
            Object.values(stations).forEach(s => s.classList.remove('active'));
            stations[current.station].classList.add('active');
            
            // Update status
            if (isRevising && current.station === 'gemini') {
                pipelineStatus.textContent = "Revising build...";
            } else {
                pipelineStatus.textContent = current.status;
            }
            pipelineStatus.style.color = `var(--${current.station})`;

            // Show artifact
            if (current.artifact) {
                setTimeout(() => {
                    if (current.artifact === 'audit' && isRevising) {
                        artifacts.audit.textContent = "Grade: B (Fixing)";
                        artifacts.audit.style.borderColor = "var(--warn)";
                    } else if (current.artifact === 'audit') {
                        artifacts.audit.textContent = "Grade: A (Shipping)";
                        artifacts.audit.style.borderColor = "var(--ok)";
                    }
                    artifacts[current.artifact].classList.add('visible');
                }, 500);
            }

            step++;
            
            if (step >= sequence.length) {
                setTimeout(() => {
                    if (!isRevising && Math.random() > 0.5) {
                        // Branch to Revision
                        isRevising = true;
                        step = 2; // Loop back to Gemini
                        revisePath.style.opacity = "0.5";
                        reviseLabel.style.opacity = "1";
                        runStep();
                    } else {
                        // Advance to Archive / Reset
                        isRevising = false;
                        revisePath.style.opacity = "0";
                        reviseLabel.style.opacity = "0";
                        
                        // Archive Animation
                        archiveLine.style.opacity = "1";
                        archiveNode.style.opacity = "1";
                        taskToken.style.transition = 'transform 1.2s ease-in-out';
                        taskToken.setAttribute('transform', 'translate(1075, 100)');
                        
                        pipelineStatus.textContent = "Task Archived.";
                        pipelineStatus.style.color = "var(--ok)";

                        setTimeout(() => {
                            step = 0;
                            archiveLine.style.opacity = "0";
                            archiveNode.style.opacity = "0";
                            Object.values(artifacts).forEach(a => {
                                a.classList.remove('visible');
                                if (a.id === 'artifact-audit') {
                                    a.textContent = "Grade: A";
                                    a.style.borderColor = "var(--codex)";
                                }
                            });
                            runStep();
                        }, 4000);
                    }
                }, 2500);
            } else {
                setTimeout(runStep, 2500);
            }
        }

        runStep();
        pipelineInterval = true;
    }

    // 4. Scene 4: WarZone Animation
    function animateWarZone() {
        const doc = document.querySelector('.warzone-doc-forming');
        if (doc.classList.contains('visible')) return;

        // Bubbles rise automatically via CSS staggered transitions
        // After 2.5s, collapse them and show doc
        setTimeout(() => {
            const bubbles = document.querySelectorAll('.speech-bubbles-standalone .bubble');
            bubbles.forEach(b => {
                b.style.opacity = '0';
                b.style.transform = 'translateY(-20px) scale(0.8)';
            });
            doc.classList.add('visible');
        }, 3000);
    }

    // 5. Scene 5: Mini-Pipeline Loop
    let miniPipelineActive = false;
    function startMiniPipelineLoop() {
        if (miniPipelineActive || prefersReducedMotion) return;
        miniPipelineActive = true;

        const miniToken = document.getElementById('mini-token');
        const miniStations = document.querySelectorAll('.mini-station');
        const scene5 = document.getElementById('scene-5');
        const xPositions = [125, 375, 625, 875];
        let currentIdx = 0;

        function move() {
            // Pause loop if Scene 5 is out of view
            if (!scene5.classList.contains('in-view')) {
                setTimeout(move, 1000);
                return;
            }

            currentIdx = (currentIdx + 1) % xPositions.length;
            
            miniToken.style.transition = 'transform 1s ease-in-out';
            miniToken.setAttribute('transform', `translate(${xPositions[currentIdx] - 125}, 0)`);
            
            miniStations.forEach((s, i) => {
                s.style.opacity = i === currentIdx ? '1' : '0.3';
            });

            setTimeout(move, 2000);
        }
        
        move();
    }


    // 6. Scroll progress for scrubbing
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });

    function handleScroll() {
        if (prefersReducedMotion) return;

        const viewportHeight = window.innerHeight;
        
        scenes.forEach(scene => {
            const rect = scene.getBoundingClientRect();
            const sceneHeight = rect.height;
            
            let sceneProgress = (viewportHeight/2 - rect.top) / sceneHeight;
            sceneProgress = Math.max(0, Math.min(1, sceneProgress));
            
            scene.style.setProperty('--scroll-progress', sceneProgress);

            if (scene.id === 'scene-2') {
                if (sceneProgress > 0.1 && sceneProgress < 0.9) {
                    document.body.classList.add('scene-2-scrub');
                } else {
                    document.body.classList.remove('scene-2-scrub');
                }
            }
        });
    }

    // 7. Topology Path Initialization
    const lines = document.querySelectorAll('.hub-line, .cycle-line');
    lines.forEach(line => {
        const length = line.getTotalLength();
        line.style.strokeDasharray = length;
        line.style.strokeDashoffset = length;
    });
});
