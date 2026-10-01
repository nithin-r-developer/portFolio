(function () {
    'use strict';

    const loaderEl = document.getElementById('system-loader');
    const deviceCore = document.getElementById('device-core');
    const loaderHologram = document.getElementById('loader-hologram');

    let loaderDismissed = false;

    function dismissLoader() {
        if (loaderDismissed) return;
        loaderDismissed = true;

        if (window.AudioEngine && window.AudioEngine.playActivate) {
            window.AudioEngine.playActivate();
        }

        if (loaderHologram) {
            loaderHologram.classList.add('visible');
        }

        setTimeout(() => {
            if (loaderEl) {
                loaderEl.classList.add('loaded');
            }
            document.body.classList.remove('loading-state');
            document.body.classList.add('system-ready');

            window.dispatchEvent(new CustomEvent('system:ready'));
        }, 550);
    }

    function initLoaderSequence() {

        setTimeout(() => {
            if (deviceCore) {
                deviceCore.classList.add('expanded');
            }
        }, 200);

        setTimeout(() => {
            if (deviceCore) {
                deviceCore.classList.add('activating');
            }
            if (window.AudioEngine && window.AudioEngine.playTick) {
                window.AudioEngine.playTick(1100);
            }
        }, 850);

        setTimeout(() => {
            if (deviceCore) {
                deviceCore.classList.add('rotation-finished');
                deviceCore.classList.add('pulse-emit');
            }
            if (window.AudioEngine && window.AudioEngine.playTick) {
                window.AudioEngine.playTick(1400);
            }
        }, 2250);

        setTimeout(() => {
            if (loaderHologram) {
                loaderHologram.classList.add('visible');
            }
            if (window.AudioEngine && window.AudioEngine.playModeSwitch) {
                window.AudioEngine.playModeSwitch();
            }
        }, 2400);

        setTimeout(() => {
            dismissLoader();
        }, 3850);
    }

    if (loaderEl) {
        loaderEl.style.cursor = 'pointer';
        loaderEl.addEventListener('click', (e) => {
            e.stopPropagation();
            dismissLoader();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
            if (!loaderDismissed) dismissLoader();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoaderSequence);
    } else {
        initLoaderSequence();
    }

    window.dismissLoader = dismissLoader;
})();
