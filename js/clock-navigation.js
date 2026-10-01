(function () {
    'use strict';

    const SECTIONS = [
        { id: 'home', title: 'HOME', code: '01', subtitle: 'SYSTEM INITIALIZED' },
        { id: 'about', title: 'ABOUT', code: '02', subtitle: 'DEVELOPER DOSSIER' },
        { id: 'skills', title: 'SKILLS', code: '03', subtitle: 'TECHNICAL MATRIX' },
        { id: 'projects', title: 'PROJECTS', code: '04', subtitle: 'SYSTEM ARTIFACTS' },
        { id: 'experience', title: 'EXPERIENCE', code: '05', subtitle: 'INDUSTRY INTERNSHIP' },
        { id: 'education', title: 'EDUCATION', code: '06', subtitle: 'ACADEMIC TIMELINE' },
        { id: 'certifications', title: 'CERTIFICATIONS', code: '07', subtitle: 'VERIFIED CREDENTIALS' },
        { id: 'achievements', title: 'ACHIEVEMENTS', code: '08', subtitle: 'RESEARCH & AWARDS' },
        { id: 'contact', title: 'CONTACT', code: '09', subtitle: 'COMMUNICATION PORT' }
    ];

    const TOTAL_SECTIONS = SECTIONS.length;
    const ANGLE_PER_SECTION = 360 / TOTAL_SECTIONS;

    let activeIndex = 0;
    let isTransitioning = false;
    const TRANSITION_DURATION = 850;

    let navRotorEl;
    let contentRotorEl;
    let navNodesLayerEl;
    let jumpDotsContainerEl;
    let navAngleDisplayEl;
    let centerSecCodeEl;
    let centerSecTitleEl;
    let centerSecSubtitleEl;
    let hudSecCodeEl;
    let hudSecNameEl;
    let contentPanels = [];

    function createCubicBezier(p1x, p1y, p2x, p2y) {
        const cx = 3.0 * p1x;
        const bx = 3.0 * (p2x - p1x) - cx;
        const ax = 1.0 - cx - bx;

        const cy = 3.0 * p1y;
        const by = 3.0 * (p2y - p1y) - cy;
        const ay = 1.0 - cy - by;

        function sampleCurveX(t) { return ((ax * t + bx) * t + cx) * t; }
        function sampleCurveY(t) { return ((ay * t + by) * t + cy) * t; }
        function sampleCurveDerivativeX(t) { return (3.0 * ax * t + 2.0 * bx) * t + cx; }

        function solveCurveX(x) {
            let t = x;
            for (let i = 0; i < 8; i++) {
                const x2 = sampleCurveX(t) - x;
                if (Math.abs(x2) < 1e-6) return t;
                const d2 = sampleCurveDerivativeX(t);
                if (Math.abs(d2) < 1e-6) break;
                t -= x2 / d2;
            }
            let t0 = 0.0, t1 = 1.0;
            t = x;
            if (t < t0) return t0;
            if (t > t1) return t1;
            while (t0 < t1) {
                const x2 = sampleCurveX(t);
                if (Math.abs(x2 - x) < 1e-6) return t;
                if (x > x2) t0 = t;
                else t1 = t;
                t = (t1 - t0) * 0.5 + t0;
            }
            return t;
        }

        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            return sampleCurveY(solveCurveX(x));
        };
    }

    const easeCinematic = createCubicBezier(0.22, 1.0, 0.36, 1.0);
    let activeAnimFrameId = null;

    function buildNavClockNodes() {
        if (!navNodesLayerEl) return;
        navNodesLayerEl.innerHTML = '';

        const isMobile = window.innerWidth <= 992;
        const radius = isMobile ? 54 : 114;

        SECTIONS.forEach((section, idx) => {
            const nodeWrap = document.createElement('div');
            nodeWrap.className = 'nav-node-item';
            nodeWrap.dataset.index = idx;

            const angleDeg = 90 - (idx * ANGLE_PER_SECTION);

            nodeWrap.style.transform = `rotate(${angleDeg}deg) translateY(-${radius}px)`;

            const btn = document.createElement('button');
            btn.className = `nav-node-btn ${idx === activeIndex ? 'active' : ''}`;
            btn.setAttribute('aria-label', `Navigate to ${section.title}`);
            btn.dataset.jumpIndex = idx;

            btn.innerHTML = `
                <div class="nav-node-marker">
                    <span class="nav-node-dot"></span>
                </div>
                <span class="nav-node-code mono">${section.code}</span>
                <span class="nav-node-label mono">${section.title}</span>
            `;

            btn.style.transform = `translate(-50%, -50%) rotate(-${angleDeg}deg)`;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                goToSection(idx);
            });

            nodeWrap.appendChild(btn);
            navNodesLayerEl.appendChild(nodeWrap);
        });
    }

    function buildJumpDots() {
        if (!jumpDotsContainerEl) return;
        jumpDotsContainerEl.innerHTML = '';

        SECTIONS.forEach((sec, idx) => {
            const tick = document.createElement('div');
            tick.className = `jump-tick ${idx === activeIndex ? 'active' : ''}`;
            tick.title = `${sec.code} - ${sec.title}`;
            tick.setAttribute('role', 'button');
            tick.setAttribute('aria-label', `Jump to section ${sec.title}`);
            tick.addEventListener('click', () => goToSection(idx));
            jumpDotsContainerEl.appendChild(tick);
        });
    }

    function updateNodeOrientations(currentNavRotation) {
        const buttons = document.querySelectorAll('.nav-node-btn');
        buttons.forEach((btn, idx) => {
            const initialAngle = 90 - (idx * ANGLE_PER_SECTION);
            const counterAngle = -(initialAngle + currentNavRotation);
            btn.style.transform = `translate(-50%, -50%) rotate(${counterAngle}deg)`;
        });
    }

    function goToSection(targetIndex) {
        if (targetIndex < 0 || targetIndex >= TOTAL_SECTIONS) return;
        if (targetIndex === activeIndex && !isTransitioning) return;
        if (isTransitioning) return;

        isTransitioning = true;
        const prevIndex = activeIndex;
        const isForward = targetIndex >= prevIndex;
        activeIndex = targetIndex;

        if (window.AudioEngine && window.AudioEngine.playSystemBeep) {
            window.AudioEngine.playSystemBeep(isForward);
        } else if (window.AudioEngine && window.AudioEngine.playTick) {
            window.AudioEngine.playTick();
        }

        const navRotation = activeIndex * ANGLE_PER_SECTION;
        const contentRotation = -(activeIndex * ANGLE_PER_SECTION);

        if (navRotorEl) {
            navRotorEl.style.transform = `rotate(${navRotation}deg)`;
            updateNodeOrientations(navRotation);
        }

        if (contentRotorEl) {
            contentRotorEl.style.transform = `rotate(${contentRotation}deg)`;
        }

        const currentSec = SECTIONS[activeIndex];

        if (navAngleDisplayEl) {
            navAngleDisplayEl.innerHTML = `${(navRotation % 360).toFixed(1)}&deg;`;
        }

        if (centerSecCodeEl) centerSecCodeEl.textContent = `${currentSec.code} / 09`;
        if (centerSecTitleEl) centerSecTitleEl.textContent = currentSec.title;
        if (centerSecSubtitleEl) centerSecSubtitleEl.textContent = currentSec.subtitle;

        if (hudSecCodeEl) hudSecCodeEl.textContent = currentSec.code;
        if (hudSecNameEl) hudSecNameEl.textContent = currentSec.title;

        const nodeBtns = document.querySelectorAll('.nav-node-btn');
        nodeBtns.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === activeIndex);
        });

        const jumpTicks = document.querySelectorAll('.jump-tick');
        jumpTicks.forEach((tick, idx) => {
            tick.classList.toggle('active', idx === activeIndex);
        });

        const prevPanel = contentPanels[prevIndex];
        const nextPanel = contentPanels[activeIndex];

        if (!prevPanel || prevPanel === nextPanel) {
            if (nextPanel) nextPanel.classList.add('active');
            isTransitioning = false;
            return;
        }

        runContinuousArcTransition(prevPanel, nextPanel, isForward);
    }

    function runContinuousArcTransition(prevPanel, nextPanel, isForward) {
        if (activeAnimFrameId) {
            cancelAnimationFrame(activeAnimFrameId);
            activeAnimFrameId = null;
        }

        const duration = TRANSITION_DURATION;
        const startTime = performance.now();

        const radiusX = Math.round(window.innerWidth * 0.28);
        const radiusY = Math.round(window.innerHeight * 1.15);

        if (prevPanel && prevPanel !== nextPanel) {
            prevPanel.style.display = 'flex';
            prevPanel.style.pointerEvents = 'none';
        }
        if (nextPanel) {
            nextPanel.style.display = 'flex';
            nextPanel.style.pointerEvents = 'none';
            nextPanel.scrollTop = 0;
        }

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(Math.max(elapsed / duration, 0), 1);
            const easeP = easeCinematic(progress);

            if (prevPanel && prevPanel !== nextPanel) {

                const thetaOut = isForward
                    ? Math.PI - (Math.PI * 0.5) * easeP
                    : Math.PI + (Math.PI * 0.5) * easeP;

                const xOut = radiusX * (1 + Math.cos(thetaOut));
                const yOut = -radiusY * Math.sin(thetaOut);

                prevPanel.style.transform = `translate3d(${xOut.toFixed(2)}px, ${yOut.toFixed(2)}px, 0)`;

                const opacityOut = progress <= 0.65 ? 1 : Math.max(0, 1 - (progress - 0.65) / 0.35);
                prevPanel.style.opacity = opacityOut.toFixed(3);
            }

            if (nextPanel) {

                const thetaIn = isForward
                    ? (1.5 * Math.PI) - (Math.PI * 0.5) * easeP
                    : (0.5 * Math.PI) + (Math.PI * 0.5) * easeP;

                const xIn = radiusX * (1 + Math.cos(thetaIn));
                const yIn = -radiusY * Math.sin(thetaIn);

                nextPanel.style.transform = `translate3d(${xIn.toFixed(2)}px, ${yIn.toFixed(2)}px, 0)`;

                const opacityIn = progress >= 0.35 ? 1 : Math.min(1, progress / 0.35);
                nextPanel.style.opacity = opacityIn.toFixed(3);
            }

            if (progress < 1) {
                activeAnimFrameId = requestAnimationFrame(step);
            } else {
                activeAnimFrameId = null;

                if (prevPanel && prevPanel !== nextPanel) {
                    prevPanel.classList.remove('active');
                    prevPanel.style.display = '';
                    prevPanel.style.transform = '';
                    prevPanel.style.opacity = '';
                    prevPanel.style.pointerEvents = '';
                }
                if (nextPanel) {
                    nextPanel.classList.add('active');
                    nextPanel.style.display = '';
                    nextPanel.style.transform = '';
                    nextPanel.style.opacity = '';
                    nextPanel.style.pointerEvents = '';
                }
                isTransitioning = false;
            }
        }

        activeAnimFrameId = requestAnimationFrame(step);
    }

    function nextSection() {
        if (activeIndex < TOTAL_SECTIONS - 1) {
            goToSection(activeIndex + 1);
        }
    }

    function prevSection() {
        if (activeIndex > 0) {
            goToSection(activeIndex - 1);
        }
    }

    let accumulatedDelta = 0;
    let wheelDebounceTimer;

    function handleWheel(e) {
        e.preventDefault();

        if (isTransitioning) return;

        accumulatedDelta += e.deltaY;

        clearTimeout(wheelDebounceTimer);
        wheelDebounceTimer = setTimeout(() => {
            accumulatedDelta = 0;
        }, 150);

        const SCROLL_THRESHOLD = 40;

        if (accumulatedDelta > SCROLL_THRESHOLD) {
            accumulatedDelta = 0;
            nextSection();
        } else if (accumulatedDelta < -SCROLL_THRESHOLD) {
            accumulatedDelta = 0;
            prevSection();
        }
    }

    let touchStartY = 0;
    let touchStartX = 0;

    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }
    }

    function handleTouchEnd(e) {
        if (isTransitioning || e.changedTouches.length === 0) return;

        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchStartY - touchEndY;
        const deltaX = touchStartX - touchEndX;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 35) {
            if (deltaY > 0) {
                nextSection();
            } else {
                prevSection();
            }
        }
    }

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowDown':
            case 'PageDown':
            case 'ArrowRight':
                e.preventDefault();
                nextSection();
                break;
            case 'ArrowUp':
            case 'PageUp':
            case 'ArrowLeft':
                e.preventDefault();
                prevSection();
                break;
            case 'Home':
                e.preventDefault();
                goToSection(0);
                break;
            case 'End':
                e.preventDefault();
                goToSection(TOTAL_SECTIONS - 1);
                break;
        }
    }

    function initClockNavigation() {
        navRotorEl = document.getElementById('nav-clock-rotor');
        contentRotorEl = document.getElementById('content-clock-rotor');
        navNodesLayerEl = document.getElementById('nav-nodes-layer');
        jumpDotsContainerEl = document.getElementById('nav-jump-dots');
        navAngleDisplayEl = document.getElementById('nav-angle-display');
        centerSecCodeEl = document.getElementById('center-sec-code');
        centerSecTitleEl = document.getElementById('center-sec-title');
        centerSecSubtitleEl = document.getElementById('center-sec-subtitle');
        hudSecCodeEl = document.getElementById('hud-sec-code');
        hudSecNameEl = document.getElementById('hud-sec-name');

        contentPanels = Array.from(document.querySelectorAll('.content-section-panel'));

        buildNavClockNodes();
        buildJumpDots();

        document.querySelectorAll('[data-jump-to]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetIdx = parseInt(btn.dataset.jumpTo, 10);
                if (!isNaN(targetIdx)) {
                    goToSection(targetIdx);
                }
            });
        });

        window.addEventListener('wheel', handleWheel, { passive: false });

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });

        window.addEventListener('keydown', handleKeyDown);

        window.addEventListener('resize', () => {
            buildNavClockNodes();
            updateNodeOrientations(activeIndex * ANGLE_PER_SECTION);
        });

        goToSection(0);
    }

    window.ClockNav = {
        goToSection,
        nextSection,
        prevSection,
        getActiveIndex: () => activeIndex,
        getSections: () => SECTIONS
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClockNavigation);
    } else {
        initClockNavigation();
    }
})();
