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
    const ANGLE_PER_SECTION = 360 / TOTAL_SECTIONS; // 40 degrees

    let activeIndex = 0;
    let currentClockAngle = 0; // Cumulative angle in degrees
    let isTransitioning = false;
    let queuedTarget = null; // Max 1 queued section change
    const TRANSITION_DURATION = 850;

    // Buffer tolerance for boundary detection
    const EDGE_THRESHOLD = 5;
    // Threshold for intentional vertical section change swipe
    const SWIPE_THRESHOLD = 50;

    let navRotorEl;
    let contentRotorEl;
    let navNodesLayerEl;
    let navClockHousingEl;
    let jumpDotsContainerEl;
    let navAngleDisplayEl;
    let centerSecCodeEl;
    let centerSecTitleEl;
    let centerSecSubtitleEl;
    let hudSecCodeEl;
    let hudSecNameEl;
    let contentPanels = [];
    let activeAnimFrameId = null;

    // Cubic bezier ease matching --transition-clock
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

    // Shortest logical rotation delta on circle of TOTAL_SECTIONS
    function calculateShortestLogicalDelta(fromIndex, toIndex) {
        let diff = toIndex - fromIndex;
        const half = TOTAL_SECTIONS / 2;
        if (diff > half) {
            diff -= TOTAL_SECTIONS;
        } else if (diff < -half) {
            diff += TOTAL_SECTIONS;
        }
        return diff;
    }

    // Build interactive node markers on the clock dial
    function buildNavClockNodes() {
        if (!navNodesLayerEl) return;
        navNodesLayerEl.innerHTML = '';

        // Derive orbital radius dynamically from the clock housing width
        // The SVG orbital circle is r=114 on a 340x340 viewBox (114/340 = 0.3353)
        const housingWidth = navClockHousingEl && navClockHousingEl.clientWidth > 0
            ? navClockHousingEl.clientWidth
            : (window.innerWidth <= 992 ? 220 : 320);
        const radius = Math.round(housingWidth * (114 / 340));

        SECTIONS.forEach((section, idx) => {
            const nodeWrap = document.createElement('div');
            nodeWrap.className = 'nav-node-item';
            nodeWrap.dataset.index = idx;

            // 90deg puts index 0 at 3 o'clock (aligned with fixed pointer)
            const angleDeg = 90 - (idx * ANGLE_PER_SECTION);
            nodeWrap.style.transform = `rotate(${angleDeg}deg) translateY(-${radius}px)`;

            const btn = document.createElement('button');
            btn.className = `nav-node-btn ${idx === activeIndex ? 'active' : ''}`;
            btn.setAttribute('aria-label', `Navigate to ${section.title}`);
            btn.setAttribute('type', 'button');
            btn.dataset.jumpIndex = idx;

            btn.innerHTML = `
                <div class="nav-node-marker">
                    <span class="nav-node-dot"></span>
                </div>
                <span class="nav-node-code mono">${section.code}</span>
                <span class="nav-node-label mono">${section.title}</span>
            `;

            // Marker click handler - direct tap navigation
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                goToSection(idx, false);
            });

            nodeWrap.appendChild(btn);
            navNodesLayerEl.appendChild(nodeWrap);
        });

        updateNodeOrientations(currentClockAngle);
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
            tick.addEventListener('click', () => goToSection(idx, false));
            jumpDotsContainerEl.appendChild(tick);
        });
    }

    // Keep all labels counter-rotated so they stay upright regardless of clock angle
    function updateNodeOrientations(currentNavRotation) {
        const buttons = document.querySelectorAll('.nav-node-btn');
        buttons.forEach((btn, idx) => {
            const initialAngle = 90 - (idx * ANGLE_PER_SECTION);
            const counterAngle = -(initialAngle + currentNavRotation);
            btn.style.transform = `translate(-50%, -50%) rotate(${counterAngle}deg)`;
        });
    }

    // Primary synchronized navigation function
    function goToSection(targetIndex, startAtBottom = false) {
        if (targetIndex < 0 || targetIndex >= TOTAL_SECTIONS) return;

        // If target is already active and no transition is running
        if (targetIndex === activeIndex && !isTransitioning) return;

        // Rapid swipes queueing: queue max ONE additional section change
        if (isTransitioning) {
            queuedTarget = { index: targetIndex, startAtBottom: startAtBottom };
            return;
        }

        isTransitioning = true;
        const prevIndex = activeIndex;
        const diff = calculateShortestLogicalDelta(prevIndex, targetIndex);
        const isForward = diff >= 0;

        // Update cumulative clock angle by shortest logical rotation
        currentClockAngle += diff * ANGLE_PER_SECTION;

        // SHARED STATE: activeSection controls both systems
        activeIndex = targetIndex;

        // Audio feedback
        if (window.AudioEngine && window.AudioEngine.playSystemBeep) {
            window.AudioEngine.playSystemBeep(isForward);
        } else if (window.AudioEngine && window.AudioEngine.playTick) {
            window.AudioEngine.playTick();
        }

        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const transitionStyle = prefersReducedMotion ? 'none' : 'transform 850ms cubic-bezier(0.22, 1.0, 0.36, 1.0)';

        // Left clock rotation
        if (navRotorEl) {
            navRotorEl.style.transition = transitionStyle;
            navRotorEl.style.transform = `rotate(${currentClockAngle}deg)`;
            updateNodeOrientations(currentClockAngle);
        }

        // Right content rotor counter-rotation
        if (contentRotorEl) {
            contentRotorEl.style.transition = transitionStyle;
            contentRotorEl.style.transform = `rotate(${-currentClockAngle}deg)`;
        }

        // Telemetry & HUD updates
        const currentSec = SECTIONS[activeIndex];
        if (navAngleDisplayEl) {
            const normalizedAngle = ((currentClockAngle % 360) + 360) % 360;
            navAngleDisplayEl.innerHTML = `${normalizedAngle.toFixed(1)}&deg;`;
        }

        if (centerSecCodeEl) centerSecCodeEl.textContent = `${currentSec.code} / 09`;
        if (centerSecTitleEl) centerSecTitleEl.textContent = currentSec.title;
        if (centerSecSubtitleEl) centerSecSubtitleEl.textContent = currentSec.subtitle;

        if (hudSecCodeEl) hudSecCodeEl.textContent = currentSec.code;
        if (hudSecNameEl) hudSecNameEl.textContent = currentSec.title;

        // Active node styling
        const nodeBtns = document.querySelectorAll('.nav-node-btn');
        nodeBtns.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === activeIndex);
        });

        // Jump ticks styling
        const jumpTicks = document.querySelectorAll('.jump-tick');
        jumpTicks.forEach((tick, idx) => {
            tick.classList.toggle('active', idx === activeIndex);
        });

        const prevPanel = contentPanels[prevIndex];
        const nextPanel = contentPanels[activeIndex];

        if (!prevPanel || prevPanel === nextPanel) {
            if (nextPanel) {
                nextPanel.classList.add('active');
                if (startAtBottom) {
                    nextPanel.scrollTop = Math.max(0, nextPanel.scrollHeight - nextPanel.clientHeight);
                } else {
                    nextPanel.scrollTop = 0;
                }
            }
            finishTransition();
            return;
        }

        // Reduced motion handling
        if (prefersReducedMotion) {
            prevPanel.classList.remove('active');
            prevPanel.style.display = '';
            prevPanel.style.transform = '';
            prevPanel.style.opacity = '';
            prevPanel.style.pointerEvents = '';
            nextPanel.classList.add('active');
            nextPanel.style.display = '';
            nextPanel.style.transform = '';
            nextPanel.style.opacity = '';
            nextPanel.style.pointerEvents = '';
            if (startAtBottom) {
                nextPanel.scrollTop = Math.max(0, nextPanel.scrollHeight - nextPanel.clientHeight);
            } else {
                nextPanel.scrollTop = 0;
            }
            finishTransition();
            return;
        }

        // Run synchronized mechanical arc transition
        runContinuousArcTransition(prevPanel, nextPanel, isForward, startAtBottom, finishTransition);
    }

    function finishTransition() {
        isTransitioning = false;
        if (queuedTarget !== null) {
            const next = queuedTarget;
            queuedTarget = null;
            goToSection(next.index, next.startAtBottom);
        }
    }

    // Scaled mechanical curved path transition
    // BOTTOM-CENTER -> LEFT/CLOSER TO NAVIGATION CLOCK -> TOP-CENTER
    function runContinuousArcTransition(prevPanel, nextPanel, isForward, startAtBottom, onComplete) {
        if (activeAnimFrameId) {
            cancelAnimationFrame(activeAnimFrameId);
            activeAnimFrameId = null;
        }

        const duration = TRANSITION_DURATION;
        const startTime = performance.now();

        const viewportEl = document.getElementById('content-clock-viewport');
        const rect = viewportEl ? viewportEl.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
        const isMobile = window.innerWidth <= 992;

        // Scale curve radii cleanly to available content area
        const radiusX = isMobile
            ? Math.round(Math.min(rect.width * 0.32, 130))
            : Math.round(window.innerWidth * 0.28);
        const radiusY = isMobile
            ? Math.round(rect.height * 1.05)
            : Math.round(window.innerHeight * 1.15);

        if (prevPanel && prevPanel !== nextPanel) {
            prevPanel.style.display = isMobile ? 'block' : 'flex';
            prevPanel.style.pointerEvents = 'none';
        }
        if (nextPanel) {
            nextPanel.style.display = isMobile ? 'block' : 'flex';
            nextPanel.style.pointerEvents = 'none';
            if (startAtBottom && isMobile) {
                nextPanel.scrollTop = Math.max(0, nextPanel.scrollHeight - nextPanel.clientHeight);
            } else {
                nextPanel.scrollTop = 0;
            }
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
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }

        activeAnimFrameId = requestAnimationFrame(step);
    }

    function nextSection() {
        const target = (activeIndex + 1) % TOTAL_SECTIONS;
        goToSection(target, false);
    }

    function prevSection() {
        const target = (activeIndex - 1 + TOTAL_SECTIONS) % TOTAL_SECTIONS;
        goToSection(target, true);
    }

    // Mouse wheel navigation on Desktop / Laptop
    let accumulatedWheelDelta = 0;
    let wheelDebounceTimer = null;

    function handleWheel(e) {
        const activePanel = document.querySelector('.content-section-panel.active');
        if (!activePanel) return;

        const st = activePanel.scrollTop;
        const ch = activePanel.clientHeight;
        const sh = activePanel.scrollHeight;
        const isScrollable = (sh > ch + EDGE_THRESHOLD);
        const isAtBottom = isScrollable ? (st + ch >= sh - EDGE_THRESHOLD) : true;
        const isAtTop = isScrollable ? (st <= EDGE_THRESHOLD) : true;

        if (e.deltaY > 0) {
            // Scrolling downward through content
            if (!isAtBottom) {
                // Allow native content scroll down
                accumulatedWheelDelta = 0;
                return;
            }
            // Already at bottom: accumulate wheel delta to trigger NEXT SECTION
            e.preventDefault();
            accumulatedWheelDelta += e.deltaY;
            clearTimeout(wheelDebounceTimer);
            wheelDebounceTimer = setTimeout(() => { accumulatedWheelDelta = 0; }, 200);

            if (accumulatedWheelDelta >= 70) {
                accumulatedWheelDelta = 0;
                nextSection();
            }
        } else if (e.deltaY < 0) {
            // Scrolling upward through content
            if (!isAtTop) {
                // Allow native content scroll up
                accumulatedWheelDelta = 0;
                return;
            }
            // Already at top: accumulate wheel delta to trigger PREVIOUS SECTION
            e.preventDefault();
            accumulatedWheelDelta += e.deltaY;
            clearTimeout(wheelDebounceTimer);
            wheelDebounceTimer = setTimeout(() => { accumulatedWheelDelta = 0; }, 200);

            if (accumulatedWheelDelta <= -70) {
                accumulatedWheelDelta = 0;
                prevSection();
            }
        }
    }

    // ========================================================
    // MOBILE SECTION SCROLL LOCK - TOUCH GESTURE HANDLING
    // ========================================================
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchIgnored = false;
    let touchIsClock = false;
    let touchStartIsAtBottom = false;
    let touchStartIsAtTop = false;
    let touchStartIsScrollable = false;
    let activePanelAtTouchStart = null;

    function handleTouchStart(e) {
        if (e.touches.length !== 1) return;

        touchIgnored = false;
        const target = e.target;

        // 1. Gesture conflict prevention: form inputs and text selection
        if (target.closest('input, textarea, select, [contenteditable="true"]')) {
            touchIgnored = true;
            return;
        }

        // 2. Active lightbox or modal dialog
        const lightbox = document.getElementById('cert-lightbox');
        if (lightbox && lightbox.classList.contains('active')) {
            touchIgnored = true;
            return;
        }

        // 3. Selecting text
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
            touchIgnored = true;
            return;
        }

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = performance.now();

        // Check if touch is on the navigation clock or inside section content
        touchIsClock = !!target.closest('.clock-nav-column');

        if (!touchIsClock) {
            const activePanel = document.querySelector('.content-section-panel.active');
            activePanelAtTouchStart = activePanel;

            if (activePanel) {
                const st = activePanel.scrollTop;
                const ch = activePanel.clientHeight;
                const sh = activePanel.scrollHeight;

                touchStartIsScrollable = (sh > ch + EDGE_THRESHOLD);
                // Did gesture begin while ALREADY at the bottom boundary?
                touchStartIsAtBottom = touchStartIsScrollable
                    ? (st + ch >= sh - EDGE_THRESHOLD)
                    : true;
                // Did gesture begin while ALREADY at the top boundary?
                touchStartIsAtTop = touchStartIsScrollable
                    ? (st <= EDGE_THRESHOLD)
                    : true;
            } else {
                touchStartIsScrollable = false;
                touchStartIsAtBottom = true;
                touchStartIsAtTop = true;
            }
        } else {
            activePanelAtTouchStart = null;
            touchStartIsScrollable = false;
            touchStartIsAtBottom = true;
            touchStartIsAtTop = true;
        }
    }

    function handleTouchEnd(e) {
        if (touchIgnored || isTransitioning || e.changedTouches.length === 0) return;

        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
            return;
        }

        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchStartY - touchEndY; // Positive = SWIPE UP, Negative = SWIPE DOWN
        const deltaX = touchStartX - touchEndX;
        const absDeltaY = Math.abs(deltaY);
        const absDeltaX = Math.abs(deltaX);

        // Check if gesture is an intentional vertical swipe (at least 50px, predominantly vertical)
        if (absDeltaY < SWIPE_THRESHOLD || absDeltaY <= absDeltaX * 1.25) {
            return;
        }

        // Swiping directly on the navigation clock always triggers section navigation
        if (touchIsClock) {
            if (deltaY > 0) {
                nextSection();
            } else {
                prevSection();
            }
            return;
        }

        // Swiping on content: apply MOBILE SECTION SCROLL LOCK rules
        const activePanel = activePanelAtTouchStart || document.querySelector('.content-section-panel.active');
        if (!activePanel) return;

        const currentScrollTop = activePanel.scrollTop;
        const currentClientHeight = activePanel.clientHeight;
        const currentScrollHeight = activePanel.scrollHeight;
        const isCurrentlyScrollable = (currentScrollHeight > currentClientHeight + EDGE_THRESHOLD);
        const isCurrentlyAtBottom = isCurrentlyScrollable
            ? (currentScrollTop + currentClientHeight >= currentScrollHeight - EDGE_THRESHOLD)
            : true;
        const isCurrentlyAtTop = isCurrentlyScrollable
            ? (currentScrollTop <= EDGE_THRESHOLD)
            : true;

        if (deltaY > 0) {
            // USER SWIPED UP (Attempting to scroll content down or advance to NEXT section)
            // Rule: Scrolling inside a section never changes the section.
            // If gesture started before reaching the bottom, allow normal scrolling and do NOT change section!
            if (!touchStartIsAtBottom) {
                return;
            }

            // Only after reaching the bottom boundary, an additional intentional upward swipe advances
            if (isCurrentlyAtBottom) {
                nextSection();
            }
        } else {
            // USER SWIPED DOWN (Attempting to scroll content up or return to PREVIOUS section)
            // Rule: If gesture started before reaching the top, allow normal scrolling and do NOT change section!
            if (!touchStartIsAtTop) {
                return;
            }

            // Only after reaching the top boundary, an additional intentional downward swipe returns
            if (isCurrentlyAtTop) {
                prevSection();
            }
        }
    }

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

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
                goToSection(0, false);
                break;
            case 'End':
                e.preventDefault();
                goToSection(TOTAL_SECTIONS - 1, false);
                break;
        }
    }

    function initClockNavigation() {
        navRotorEl = document.getElementById('nav-clock-rotor');
        contentRotorEl = document.getElementById('content-clock-rotor');
        navNodesLayerEl = document.getElementById('nav-nodes-layer');
        navClockHousingEl = document.getElementById('nav-clock-housing');
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

        // Update indicator text for touch devices
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const guidanceTextEl = document.querySelector('.guidance-text');
        if (guidanceTextEl && isTouchDevice) {
            guidanceTextEl.textContent = 'SWIPE TO ROTATE';
        }

        // In-page jump buttons
        document.querySelectorAll('[data-jump-to]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetIdx = parseInt(btn.dataset.jumpTo, 10);
                if (!isNaN(targetIdx)) {
                    goToSection(targetIdx, false);
                }
            });
        });

        // Use passive touch listeners so native momentum scroll is 100% smooth and non-blocking
        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('keydown', handleKeyDown);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                buildNavClockNodes();
            }, 100);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                buildNavClockNodes();
            }, 200);
        });

        // Initialize active section 0 (HOME)
        goToSection(0, false);
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
