(function () {
    'use strict';

    let audioCtx = null;
    let audioEnabled = false;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSystemBeep(isForward = true) {
        if (!audioEnabled) return;

        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const comp = ctx.createDynamicsCompressor();
            comp.threshold.setValueAtTime(-12, now);
            comp.knee.setValueAtTime(4, now);
            comp.ratio.setValueAtTime(3, now);
            comp.attack.setValueAtTime(0.001, now);
            comp.release.setValueAtTime(0.05, now);
            comp.connect(ctx.destination);

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();

            osc1.type = 'sine';

            if (isForward) {

                osc1.frequency.setValueAtTime(1480, now);
                osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.035);
                osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08);
            } else {

                osc1.frequency.setValueAtTime(1560, now);
                osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.035);
                osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.08);
            }

            gain1.gain.setValueAtTime(0.0001, now);
            gain1.gain.linearRampToValueAtTime(0.045, now + 0.006);
            gain1.gain.exponentialRampToValueAtTime(0.015, now + 0.06);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

            osc1.connect(gain1);
            gain1.connect(comp);

            osc1.start(now);
            osc1.stop(now + 0.16);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();

            osc2.type = 'sine';
            const confirmFreq = isForward ? 880 : 784;
            osc2.frequency.setValueAtTime(confirmFreq, now + 0.025);
            osc2.frequency.exponentialRampToValueAtTime(confirmFreq * 0.98, now + 0.14);

            gain2.gain.setValueAtTime(0.0001, now + 0.025);
            gain2.gain.linearRampToValueAtTime(0.025, now + 0.038);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

            osc2.connect(gain2);
            gain2.connect(comp);

            osc2.start(now + 0.025);
            osc2.stop(now + 0.18);

        } catch (e) {

        }
    }

    const playOmnitrixTransform = playSystemBeep;

    function playTick(customFreq) {
        if (!audioEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            const baseFreq = customFreq || 880;
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, ctx.currentTime + 0.035);

            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch (e) {

        }
    }

    function playModeSwitch() {
        if (!audioEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.03, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {

        }
    }

    function playActivate() {
        if (!audioEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';

            osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime);

            osc1.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.2);
            osc2.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.25);
            osc2.stop(ctx.currentTime + 0.25);
        } catch (e) {

        }
    }

    function initAudioToggle() {
        const toggleBtn = document.getElementById('audio-toggle');
        const toggleLabel = document.getElementById('audio-label');

        function updateToggleUI() {
            if (!toggleBtn) return;
            const iconWrap = toggleBtn.querySelector('.audio-icon');
            if (audioEnabled) {
                toggleBtn.classList.add('active');
                if (toggleLabel) toggleLabel.textContent = 'AUDIO: ON';
                if (iconWrap) {
                    iconWrap.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
                }
            } else {
                toggleBtn.classList.remove('active');
                if (toggleLabel) toggleLabel.textContent = 'AUDIO: OFF';
                if (iconWrap) {
                    iconWrap.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
                }
            }
        }

        updateToggleUI();

        const unlockAudio = () => {
            getAudioContext();
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('wheel', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio, { passive: true });
        window.addEventListener('wheel', unlockAudio, { passive: true });
        window.addEventListener('touchstart', unlockAudio, { passive: true });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                audioEnabled = !audioEnabled;
                if (audioEnabled) {
                    getAudioContext();
                    playSystemBeep(true);
                }
                updateToggleUI();
            });
        }
    }

    function generateBezelTicks() {
        const tickGroup = document.querySelector('.clock-degree-ticks');
        if (!tickGroup) return;

        tickGroup.innerHTML = '';
        const cx = 170;
        const cy = 170;
        const rOuter = 162;

        for (let angle = 0; angle < 360; angle += 5) {
            const rad = (angle - 90) * Math.PI / 180;
            const isMajor = angle % 40 === 0;
            const isMedium = angle % 20 === 0;

            const tickLen = isMajor ? 10 : (isMedium ? 6 : 3);
            const rInner = rOuter - tickLen;

            const x1 = cx + rOuter * Math.cos(rad);
            const y1 = cy + rOuter * Math.sin(rad);
            const x2 = cx + rInner * Math.cos(rad);
            const y2 = cy + rInner * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);

            if (isMajor) {
                line.setAttribute('stroke', '#00ff66');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('opacity', '0.85');
            } else if (isMedium) {
                line.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
                line.setAttribute('stroke-width', '1');
            } else {
                line.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
                line.setAttribute('stroke-width', '0.8');
            }

            tickGroup.appendChild(line);
        }
    }

    function generateContentRadials() {
        const radialsGroup = document.getElementById('c-rotor-radials');
        if (!radialsGroup) return;

        radialsGroup.innerHTML = '';
        const cx = 450;
        const cy = 450;
        const rInner = 240;
        const rOuter = 410;

        for (let i = 0; i < 9; i++) {
            const angle = i * 40;
            const rad = (angle - 90) * Math.PI / 180;

            const x1 = cx + rInner * Math.cos(rad);
            const y1 = cy + rInner * Math.sin(rad);
            const x2 = cx + rOuter * Math.cos(rad);
            const y2 = cy + rOuter * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'c-radial-line');
            radialsGroup.appendChild(line);
        }
    }

    function initCustomCursor() {
        const tracker = document.getElementById('cursor-tracker');
        if (!tracker || window.innerWidth <= 992) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let trackerX = mouseX;
        let trackerY = mouseY;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }, { passive: true });

        const interactiveSelectors = 'button, a, input, textarea, .nav-node-btn, .skill-node-card, .jump-tick, .cert-preview-frame';
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest(interactiveSelectors)) {
                tracker.classList.add('hovering');
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest(interactiveSelectors)) {
                tracker.classList.remove('hovering');
            }
        });

        function renderCursor() {
            trackerX += (mouseX - trackerX) * 0.22;
            trackerY += (mouseY - trackerY) * 0.22;
            tracker.style.transform = `translate3d(${trackerX}px, ${trackerY}px, 0)`;
            requestAnimationFrame(renderCursor);
        }
        requestAnimationFrame(renderCursor);
    }

    function initAnimations() {
        initAudioToggle();
        generateBezelTicks();
        generateContentRadials();
        initCustomCursor();
    }

    window.AudioEngine = {
        playSystemBeep,
        playOmnitrixTransform: playSystemBeep,
        playTick,
        playModeSwitch,
        playActivate,
        isAudioEnabled: () => audioEnabled
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimations);
    } else {
        initAnimations();
    }
})();
