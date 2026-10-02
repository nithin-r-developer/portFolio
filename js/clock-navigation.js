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
    let isSectionTransitioning = false;
    let isInitialized = false;
    let lastNavigationTime = 0;
    let queuedTarget = null; // Max 1 queued section change (for rotary snap / explicit click)
    const TRANSITION_DURATION = 850;
    const NAVIGATION_COOLDOWN = 250; // ms cooldown lock after transition completes

    // Boundary detection tolerance (handles mobile fractional pixels, dynamic viewports, padding)
    const BOUNDARY_TOLERANCE = 24;
    // Movement distance thresholds for mobile boundary swipe navigation
    const MOBILE_MOVE_NAV_THRESHOLD = 40;
    const MOBILE_END_NAV_THRESHOLD = 35;
    const MOBILE_FLICK_NAV_THRESHOLD = 28;
    const WHEEL_NAV_THRESHOLD = 50; // delta for intentional desktop wheel gesture

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
    let activePointerLabelEl;
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

    // Dynamic active section name readout at fixed 3 o'clock pointer and below half-circle arc
    let mobileRotaryNameEl = null;
    let mobileRotaryCodeEl = null;

    function updateActivePointerLabel(sectionOrTitle, isForward = true) {
        if (!activePointerLabelEl) {
            activePointerLabelEl = document.getElementById('active-pointer-label');
        }
        if (!mobileRotaryNameEl) {
            mobileRotaryNameEl = document.getElementById('mobile-rotary-name');
        }
        if (!mobileRotaryCodeEl) {
            mobileRotaryCodeEl = document.getElementById('mobile-rotary-code');
        }

        const title = typeof sectionOrTitle === 'string' ? sectionOrTitle : (sectionOrTitle && sectionOrTitle.title ? sectionOrTitle.title : 'HOME');
        const code = typeof sectionOrTitle === 'object' && sectionOrTitle && sectionOrTitle.code ? sectionOrTitle.code : null;

        if (activePointerLabelEl && activePointerLabelEl.textContent !== title) {
            activePointerLabelEl.classList.add('fade-transition');
            setTimeout(() => {
                activePointerLabelEl.textContent = title;
                activePointerLabelEl.classList.remove('fade-transition');
            }, 80);
        }

        if (mobileRotaryNameEl && mobileRotaryNameEl.textContent !== title) {
            const animClass = isForward ? 'anim-forward' : 'anim-backward';
            mobileRotaryNameEl.classList.add(animClass);
            setTimeout(() => {
                mobileRotaryNameEl.textContent = title;
                if (mobileRotaryCodeEl && code) {
                    mobileRotaryCodeEl.textContent = code;
                }
                mobileRotaryNameEl.classList.remove(animClass);
            }, 90);
        }
    }

    // Build interactive node markers on the clock dial
    function buildNavClockNodes() {
        if (!navNodesLayerEl) return;
        navNodesLayerEl.innerHTML = '';

        // Derive orbital radius dynamically from the clock housing width
        // The SVG orbital circle is r=114 on a 340x340 viewBox (114/340 = 0.3353)
        const housingWidth = navClockHousingEl && navClockHousingEl.clientWidth > 0
            ? navClockHousingEl.clientWidth
            : (window.innerWidth <= 992 ? 72 : 320);
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
                if (performance.now() - lastRotaryDragTimestamp < 200) return;
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

    function getActivePanel() {
        return contentPanels[activeIndex] || document.querySelector('.content-section-panel.active');
    }

    function isPanelAtBottom(panel) {
        if (!panel) return true;
        const remaining = panel.scrollHeight - (panel.scrollTop + panel.clientHeight);
        return remaining <= BOUNDARY_TOLERANCE;
    }

    function isPanelAtTop(panel) {
        if (!panel) return true;
        return panel.scrollTop <= BOUNDARY_TOLERANCE;
    }

    function isPanelScrollable(panel) {
        if (!panel) return false;
        return panel.scrollHeight > (panel.clientHeight + BOUNDARY_TOLERANCE);
    }

    // Primary synchronized navigation function
    function goToSection(targetIndex, startAtBottom = false, explicitAngle = null) {
        if (targetIndex < 0 || targetIndex >= TOTAL_SECTIONS) return;

        // If target is already active and system is initialized and no transition is running and not explicit snap
        if (isInitialized && targetIndex === activeIndex && !isSectionTransitioning && explicitAngle === null) return;

        // Rapid input protection: if already transitioning, at most one target can be queued (for explicit rotary snap / click)
        if (isSectionTransitioning) {
            if (explicitAngle !== null) {
                queuedTarget = { index: targetIndex, startAtBottom: startAtBottom, explicitAngle: explicitAngle };
            }
            return;
        }

        isSectionTransitioning = true;
        const prevIndex = activeIndex;
        const diff = calculateShortestLogicalDelta(prevIndex, targetIndex);
        const isForward = diff >= 0;

        // Update cumulative clock angle by shortest logical rotation or explicit snap angle
        if (explicitAngle !== null) {
            currentClockAngle = explicitAngle;
        } else {
            currentClockAngle += diff * ANGLE_PER_SECTION;
        }

        // SHARED STATE: activeSection controls both systems
        activeIndex = targetIndex;

        // Audio feedback
        if (window.AudioEngine && window.AudioEngine.playSystemBeep) {
            window.AudioEngine.playSystemBeep(isForward);
        } else if (window.AudioEngine && window.AudioEngine.playTick) {
            window.AudioEngine.playTick();
        }

        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = explicitAngle !== null ? '400ms' : '850ms';
        const transitionStyle = prefersReducedMotion ? 'none' : `transform ${duration} cubic-bezier(0.22, 1.0, 0.36, 1.0)`;

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

        // Telemetry & Dynamic Pointer Readout
        const currentSec = SECTIONS[activeIndex];
        updateActivePointerLabel(currentSec, isForward);

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
            contentPanels.forEach((p, idx) => {
                p.classList.toggle('active', idx === activeIndex);
            });
            if (nextPanel) {
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
            contentPanels.forEach((p, idx) => {
                p.classList.toggle('active', idx === activeIndex);
                p.style.display = '';
                p.style.transform = '';
                p.style.opacity = '';
                p.style.pointerEvents = '';
            });
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
        isSectionTransitioning = false;
        lastNavigationTime = performance.now();
        isInitialized = true;

        if (queuedTarget !== null) {
            const next = queuedTarget;
            queuedTarget = null;
            goToSection(next.index, next.startAtBottom, next.explicitAngle || null);
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
            if (startAtBottom) {
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

                // Robust cleanup across all panels
                contentPanels.forEach((panel, idx) => {
                    if (idx === activeIndex) {
                        panel.classList.add('active');
                        panel.style.display = '';
                        panel.style.transform = '';
                        panel.style.opacity = '';
                        panel.style.pointerEvents = '';
                    } else {
                        panel.classList.remove('active');
                        panel.style.display = '';
                        panel.style.transform = '';
                        panel.style.opacity = '';
                        panel.style.pointerEvents = '';
                    }
                });

                if (startAtBottom && nextPanel) {
                    nextPanel.scrollTop = Math.max(0, nextPanel.scrollHeight - nextPanel.clientHeight);
                }

                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }

        activeAnimFrameId = requestAnimationFrame(step);
    }

    function nextSection() {
        if (activeIndex >= TOTAL_SECTIONS - 1) return;
        goToSection(activeIndex + 1, false);
    }

    function prevSection() {
        if (activeIndex <= 0) return;
        goToSection(activeIndex - 1, true);
    }

    // ========================================================
    // DIRECT ROTARY INTERACTION (POINTER EVENTS)
    // Desktop: Full clock mouse drag. Mobile: Half-circle touch drag.
    // ========================================================
    let isDraggingRotary = false;
    let rotaryCenterX = 0;
    let rotaryCenterY = 0;
    let lastPointerAngle = 0;
    let rotaryDragStartAngle = 0;
    let accumulatedRotaryAngle = 0;
    let rotaryHasMoved = false;
    let activeRotaryPointerId = null;
    let lastRotaryDragTimestamp = 0;
    let lastHoveredIndex = 0;

    function handleRotaryPointerDown(e) {
        if (isSectionTransitioning) return;
        if (e.button !== undefined && e.button !== 0) return; // Only primary button / touch

        const housing = document.getElementById('nav-clock-housing');
        if (!housing) return;

        // Pointer capture tracks rotation smoothly even if finger strays slightly outside the arc
        try {
            housing.setPointerCapture(e.pointerId);
            activeRotaryPointerId = e.pointerId;
        } catch (err) {
            activeRotaryPointerId = null;
        }

        const isMobile = window.innerWidth <= 992;
        const rect = housing.getBoundingClientRect();

        // Calculate imaginary circle center in client coordinates
        // On mobile, the housing is anchored to the left edge with translateX(-50%)
        rotaryCenterX = isMobile ? (rect.right - (housing.offsetWidth / 2)) : (rect.left + rect.width / 2);
        rotaryCenterY = rect.top + (housing.offsetHeight / 2);

        // Movement angle calculated relative to the center of the imaginary circle
        const deltaX = isMobile ? Math.max(e.clientX - rotaryCenterX, 2) : (e.clientX - rotaryCenterX);
        const deltaY = e.clientY - rotaryCenterY;

        lastPointerAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        rotaryDragStartAngle = lastPointerAngle;
        accumulatedRotaryAngle = currentClockAngle;
        rotaryHasMoved = false;
        isDraggingRotary = true;
        lastHoveredIndex = activeIndex;

        housing.classList.add('is-interacting');

        if (navRotorEl) navRotorEl.style.transition = 'none';
        if (contentRotorEl) contentRotorEl.style.transition = 'none';
    }

    function handleRotaryPointerMove(e) {
        if (!isDraggingRotary) return;
        if (activeRotaryPointerId !== null && e.pointerId !== activeRotaryPointerId) return;

        const deltaX = e.clientX - rotaryCenterX;
        const deltaY = e.clientY - rotaryCenterY;

        const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        let stepDelta = currentAngle - lastPointerAngle;

        // Full-circle seam crossing normalization (-180° to +180°)
        if (stepDelta > 180) stepDelta -= 360;
        if (stepDelta < -180) stepDelta += 360;

        // Check if movement exceeds threshold to distinguish from a simple tap
        if (!rotaryHasMoved && (Math.abs(currentAngle - rotaryDragStartAngle) > 2.0 || Math.abs(stepDelta) > 0.8)) {
            rotaryHasMoved = true;
        }

        if (!rotaryHasMoved) return;

        accumulatedRotaryAngle += stepDelta;
        lastPointerAngle = currentAngle;

        // Rotate dial in real time
        if (navRotorEl) {
            navRotorEl.style.transform = `rotate(${accumulatedRotaryAngle}deg)`;
            updateNodeOrientations(accumulatedRotaryAngle);
        }
        if (contentRotorEl) {
            contentRotorEl.style.transform = `rotate(${-accumulatedRotaryAngle}deg)`;
        }

        // Determine nearest section aligned with 3 o'clock pointer
        // anglePerSection = 360 / totalSections
        const rawSection = Math.round(accumulatedRotaryAngle / ANGLE_PER_SECTION);
        const nearestIndex = ((rawSection % TOTAL_SECTIONS) + TOTAL_SECTIONS) % TOTAL_SECTIONS;

        if (nearestIndex !== lastHoveredIndex) {
            const isForward = stepDelta >= 0;
            lastHoveredIndex = nearestIndex;

            // Immediately update dynamic section readout below arc and at pointer
            updateActivePointerLabel(SECTIONS[nearestIndex], isForward);

            // Preview active node marker
            const nodeBtns = document.querySelectorAll('.nav-node-btn');
            nodeBtns.forEach((btn, idx) => {
                btn.classList.toggle('active', idx === nearestIndex);
            });

            const jumpTicks = document.querySelectorAll('.jump-tick');
            jumpTicks.forEach((tick, idx) => {
                tick.classList.toggle('active', idx === nearestIndex);
            });

            if (window.AudioEngine && window.AudioEngine.playTick) {
                window.AudioEngine.playTick(1200);
            }

            if (hudSecCodeEl) hudSecCodeEl.textContent = SECTIONS[nearestIndex].code;
            if (hudSecNameEl) hudSecNameEl.textContent = SECTIONS[nearestIndex].title;
        }
    }

    function handleRotaryPointerUp(e) {
        if (!isDraggingRotary) return;
        if (activeRotaryPointerId !== null && e.pointerId !== activeRotaryPointerId) return;

        const housing = document.getElementById('nav-clock-housing');
        if (housing && activeRotaryPointerId !== null) {
            try {
                housing.releasePointerCapture(activeRotaryPointerId);
            } catch (err) {}
        }
        if (housing) {
            housing.classList.remove('is-interacting');
        }
        activeRotaryPointerId = null;
        isDraggingRotary = false;
        lastRotaryDragTimestamp = performance.now();

        if (!rotaryHasMoved) {
            // Tap/click without drag: restore current angle smoothly
            if (navRotorEl) {
                navRotorEl.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
                navRotorEl.style.transform = `rotate(${currentClockAngle}deg)`;
                updateNodeOrientations(currentClockAngle);
            }
            if (contentRotorEl) {
                contentRotorEl.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
                contentRotorEl.style.transform = `rotate(${-currentClockAngle}deg)`;
            }
            return;
        }

        // Section snapping: calculate nearest 40° interval
        // anglePerSection = 360 / totalSections
        const rawSection = Math.round(accumulatedRotaryAngle / ANGLE_PER_SECTION);
        const targetIndex = ((rawSection % TOTAL_SECTIONS) + TOTAL_SECTIONS) % TOTAL_SECTIONS;
        const snapAngle = rawSection * ANGLE_PER_SECTION;

        // Smoothly snap to the nearest section, synchronize portfolio content, and trigger beep
        // Never leave the half-circle positioned between sections!
        if (targetIndex !== activeIndex) {
            goToSection(targetIndex, false, snapAngle);
        } else {
            // Snapped back to same section: animate dial to exact snapAngle
            currentClockAngle = snapAngle;
            if (navRotorEl) {
                navRotorEl.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
                navRotorEl.style.transform = `rotate(${snapAngle}deg)`;
                updateNodeOrientations(snapAngle);
            }
            if (contentRotorEl) {
                contentRotorEl.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
                contentRotorEl.style.transform = `rotate(${-snapAngle}deg)`;
            }
            if (window.AudioEngine && window.AudioEngine.playSystemBeep) {
                window.AudioEngine.playSystemBeep(true);
            }
            updateActivePointerLabel(SECTIONS[activeIndex], true);

            const nodeBtns = document.querySelectorAll('.nav-node-btn');
            nodeBtns.forEach((btn, idx) => {
                btn.classList.toggle('active', idx === activeIndex);
            });
            const jumpTicks = document.querySelectorAll('.jump-tick');
            jumpTicks.forEach((tick, idx) => {
                tick.classList.toggle('active', idx === activeIndex);
            });
        }
    }

    // ========================================================
    // DESKTOP MOUSE WHEEL & TRACKPAD NAVIGATION
    // One physical wheel gesture = exactly one section.
    // Transition lock + debounce cooldown prevents section skipping.
    // ========================================================
    let accumulatedWheelDelta = 0;
    let wheelGestureTimer = null;
    let isWheelLocked = false;
    let desktopScrollWasActive = false;
    let desktopScrollActiveTimer = null;

    function handleWheel(e) {
        const now = performance.now();

        // 1. Controlled transition lock: Ignore wheel during transition or cooldown
        if (isSectionTransitioning || (now - lastNavigationTime < NAVIGATION_COOLDOWN)) {
            e.preventDefault();
            return;
        }

        // 2. Trackpad gesture lock: Absorb rapid subsequent events from the same physical swipe/flick
        if (isWheelLocked) {
            e.preventDefault();
            clearTimeout(wheelGestureTimer);
            wheelGestureTimer = setTimeout(() => {
                isWheelLocked = false;
                accumulatedWheelDelta = 0;
            }, 200);
            return;
        }

        const activePanel = getActivePanel();
        if (!activePanel) return;

        const scrollable = isPanelScrollable(activePanel);
        const atBottom = isPanelAtBottom(activePanel);
        const atTop = isPanelAtTop(activePanel);

        if (e.deltaY > 0) {
            // Scrolling DOWN
            if (scrollable && !atBottom) {
                // Inner content still scrollable below: let native scroll handle it
                accumulatedWheelDelta = 0;
                desktopScrollWasActive = true;
                clearTimeout(desktopScrollActiveTimer);
                desktopScrollActiveTimer = setTimeout(() => {
                    desktopScrollWasActive = false;
                }, 200);
                return;
            }

            // At bottom boundary:
            // If the user just reached bottom during continuous scrolling, do NOT advance in same gesture
            if (desktopScrollWasActive) {
                e.preventDefault();
                clearTimeout(desktopScrollActiveTimer);
                desktopScrollActiveTimer = setTimeout(() => {
                    desktopScrollWasActive = false;
                }, 200);
                return;
            }

            // Boundary stop: at last section (CONTACT), stop
            if (activeIndex >= TOTAL_SECTIONS - 1) {
                return;
            }

            e.preventDefault();
            accumulatedWheelDelta += e.deltaY;
            clearTimeout(wheelGestureTimer);
            wheelGestureTimer = setTimeout(() => {
                accumulatedWheelDelta = 0;
            }, 200);

            if (accumulatedWheelDelta >= WHEEL_NAV_THRESHOLD) {
                accumulatedWheelDelta = 0;
                isWheelLocked = true;
                nextSection();
            }
        } else if (e.deltaY < 0) {
            // Scrolling UP
            if (scrollable && !atTop) {
                // Inner content still scrollable above: let native scroll handle it
                accumulatedWheelDelta = 0;
                desktopScrollWasActive = true;
                clearTimeout(desktopScrollActiveTimer);
                desktopScrollActiveTimer = setTimeout(() => {
                    desktopScrollWasActive = false;
                }, 200);
                return;
            }

            // At top boundary:
            if (desktopScrollWasActive) {
                e.preventDefault();
                clearTimeout(desktopScrollActiveTimer);
                desktopScrollActiveTimer = setTimeout(() => {
                    desktopScrollWasActive = false;
                }, 200);
                return;
            }

            // Boundary stop: at first section (HOME), stop
            if (activeIndex <= 0) {
                return;
            }

            e.preventDefault();
            accumulatedWheelDelta += e.deltaY;
            clearTimeout(wheelGestureTimer);
            wheelGestureTimer = setTimeout(() => {
                accumulatedWheelDelta = 0;
            }, 200);

            if (accumulatedWheelDelta <= -WHEEL_NAV_THRESHOLD) {
                accumulatedWheelDelta = 0;
                isWheelLocked = true;
                prevSection();
            }
        }
    }

    // ========================================================
    // MOBILE NATURAL CONTENT SCROLL & BOUNDARY GESTURES
    // Native vertical scrolling on content is completely uninhibited.
    // Intentional swipe only triggers section change at settled boundaries.
    // ========================================================
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    let isTrackingTouch = false;
    let touchStartedAtBottom = false;
    let touchStartedAtTop = false;
    let touchNavTriggered = false;
    let lastScrollTimestamp = 0;

    function handleContentTouchStart(e) {
        // Do not intercept if touch is on rotary dial
        if (e.target.closest('#nav-clock-housing') || e.target.closest('.nav-node-btn')) {
            isTrackingTouch = false;
            return;
        }

        if (isSectionTransitioning || (performance.now() - lastNavigationTime < NAVIGATION_COOLDOWN)) {
            isTrackingTouch = false;
            return;
        }

        if (!e.touches || e.touches.length !== 1) {
            isTrackingTouch = false;
            return;
        }

        const touch = e.touches[0];
        touchStartY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartTime = performance.now();
        isTrackingTouch = true;
        touchNavTriggered = false;

        const activePanel = getActivePanel();
        const scrollable = isPanelScrollable(activePanel);
        const atBottom = isPanelAtBottom(activePanel);
        const atTop = isPanelAtTop(activePanel);

        // Momentum check: if a native scroll happened within the last 80ms,
        // the user's touch is to stop momentum, not to trigger boundary navigation.
        const isMomentumActive = (performance.now() - lastScrollTimestamp < 80);

        if (isMomentumActive) {
            touchStartedAtBottom = false;
            touchStartedAtTop = false;
        } else if (!scrollable) {
            // Content fits within viewport; can navigate in either direction
            touchStartedAtBottom = true;
            touchStartedAtTop = true;
        } else {
            touchStartedAtBottom = atBottom;
            touchStartedAtTop = atTop;
        }
    }

    function handleContentTouchMove(e) {
        if (!isTrackingTouch || isSectionTransitioning || touchNavTriggered) return;
        if (!e.touches || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const deltaY = touchStartY - touch.clientY; // positive = dragged finger UP (scroll down)
        const deltaX = touchStartX - touch.clientX;

        // Ensure movement is primarily vertical
        if (Math.abs(deltaY) < Math.abs(deltaX) * 0.8) {
            return;
        }

        if (deltaY >= MOBILE_MOVE_NAV_THRESHOLD) {
            // Dragging UP -> Wants to navigate DOWN to next section
            if (touchStartedAtBottom && activeIndex < TOTAL_SECTIONS - 1) {
                touchNavTriggered = true;
                isTrackingTouch = false;
                nextSection();
            }
        } else if (deltaY <= -MOBILE_MOVE_NAV_THRESHOLD) {
            // Dragging DOWN -> Wants to navigate UP to previous section
            if (touchStartedAtTop && activeIndex > 0) {
                touchNavTriggered = true;
                isTrackingTouch = false;
                prevSection();
            }
        }
    }

    function handleContentTouchEnd(e) {
        if (!isTrackingTouch || isSectionTransitioning || touchNavTriggered) {
            isTrackingTouch = false;
            return;
        }
        isTrackingTouch = false;

        const changedTouch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
        if (!changedTouch) return;

        const deltaY = touchStartY - changedTouch.clientY;
        const deltaX = touchStartX - changedTouch.clientX;
        const duration = performance.now() - touchStartTime;

        // Ensure movement is primarily vertical
        if (Math.abs(deltaY) < Math.abs(deltaX) * 0.8) {
            return;
        }

        // Quick flick vs steady swipe
        const isFlick = duration < 320;
        const threshold = isFlick ? MOBILE_FLICK_NAV_THRESHOLD : MOBILE_END_NAV_THRESHOLD;

        if (deltaY >= threshold) {
            if (touchStartedAtBottom && activeIndex < TOTAL_SECTIONS - 1) {
                touchNavTriggered = true;
                nextSection();
            }
        } else if (deltaY <= -threshold) {
            if (touchStartedAtTop && activeIndex > 0) {
                touchNavTriggered = true;
                prevSection();
            }
        }
    }

    function handlePanelScroll() {
        lastScrollTimestamp = performance.now();
    }

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (isSectionTransitioning || (performance.now() - lastNavigationTime < NAVIGATION_COOLDOWN)) return;

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
        activePointerLabelEl = document.getElementById('active-pointer-label');
        mobileRotaryNameEl = document.getElementById('mobile-rotary-name');
        mobileRotaryCodeEl = document.getElementById('mobile-rotary-code');

        contentPanels = Array.from(document.querySelectorAll('.content-section-panel'));

        buildNavClockNodes();
        buildJumpDots();

        // Rotary interaction using Pointer Events (Desktop mouse drag & Mobile half-circle touch drag)
        if (navClockHousingEl) {
            navClockHousingEl.addEventListener('pointerdown', handleRotaryPointerDown);
        }
        window.addEventListener('pointermove', handleRotaryPointerMove);
        window.addEventListener('pointerup', handleRotaryPointerUp);
        window.addEventListener('pointercancel', handleRotaryPointerUp);

        // Mobile touch scrolling and boundary navigation (passive: never blocks native scrolling)
        window.addEventListener('touchstart', handleContentTouchStart, { passive: true });
        window.addEventListener('touchmove', handleContentTouchMove, { passive: true });
        window.addEventListener('touchend', handleContentTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleContentTouchEnd, { passive: true });

        // Scroll listeners on each panel to monitor momentum & boundaries
        contentPanels.forEach(panel => {
            panel.addEventListener('scroll', handlePanelScroll, { passive: true });
        });

        // Update guidance indicator
        const guidanceTextEl = document.querySelector('.guidance-text');
        if (guidanceTextEl) {
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            guidanceTextEl.textContent = isTouchDevice ? 'ROTATE DIAL' : 'SCROLL TO ROTATE';
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

        // Desktop mouse wheel navigation and keyboard controls
        window.addEventListener('wheel', handleWheel, { passive: false });
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
        isInitialized = true;
    }

    window.ClockNav = {
        goToSection,
        nextSection,
        prevSection,
        getActiveIndex: () => activeIndex,
        getSections: () => SECTIONS,
        isTransitioning: () => isSectionTransitioning,
        isSectionTransitioning: () => isSectionTransitioning
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClockNavigation);
    } else {
        initClockNavigation();
    }
})();
