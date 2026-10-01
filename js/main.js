(function () {
    'use strict';

    function initSkillFilters() {
        const tabs = document.querySelectorAll('.skill-tab');
        const cards = document.querySelectorAll('.skill-node-card');
        if (!tabs.length || !cards.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const targetCat = tab.dataset.skillCat;

                if (window.AudioEngine && window.AudioEngine.playTick) {
                    window.AudioEngine.playTick(1000);
                }

                cards.forEach(card => {
                    const cardCat = card.dataset.category;
                    if (targetCat === 'all' || cardCat === targetCat) {
                        card.classList.remove('dimmed');
                    } else {
                        card.classList.add('dimmed');
                    }
                });
            });
        });
    }

    function initProjectSwitcher() {
        const projTabs = document.querySelectorAll('.proj-tab-btn');
        const projCards = document.querySelectorAll('.project-display-card');
        if (!projTabs.length || !projCards.length) return;

        projTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.projTarget;
                if (!targetId) return;

                projTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (window.AudioEngine && window.AudioEngine.playModeSwitch) {
                    window.AudioEngine.playModeSwitch();
                }

                projCards.forEach(card => {
                    if (card.id === targetId) {
                        card.classList.add('active');
                    } else {
                        card.classList.remove('active');
                    }
                });
            });
        });
    }

    function initCertificateModal() {
        const lightbox = document.getElementById('cert-lightbox');
        const backdrop = document.getElementById('modal-backdrop');
        const closeBtn = document.getElementById('modal-close');
        const modalImg = document.getElementById('modal-cert-img');
        const modalTitle = document.getElementById('modal-cert-title');
        const certTriggers = document.querySelectorAll('.cert-preview-frame');

        if (!lightbox) return;

        function openModal(src, title) {
            if (modalImg) {
                modalImg.src = src;
                modalImg.alt = title;
            }
            if (modalTitle) {
                modalTitle.textContent = title.toUpperCase();
            }
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');

            if (window.AudioEngine && window.AudioEngine.playTick) {
                window.AudioEngine.playTick(1200);
            }
        }

        function closeModal() {
            lightbox.classList.remove('active');
            lightbox.setAttribute('aria-hidden', 'true');
        }

        certTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const src = trigger.dataset.certSrc;
                const title = trigger.dataset.certTitle || 'Verified Credential';
                if (src) openModal(src, title);
            });
        });

        if (backdrop) backdrop.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeModal();
            }
        });
    }

    function initTransmissionForm() {
        const form = document.getElementById('transmission-form');
        const submitBtn = document.getElementById('submit-packet-btn');
        const statusFeed = document.getElementById('form-status-feed');
        if (!form || !submitBtn) return;

        const nameInput = document.getElementById('sender-name');
        const emailInput = document.getElementById('sender-email');
        const messageInput = document.getElementById('sender-message');

        const nameErr = document.getElementById('name-error');
        const emailErr = document.getElementById('email-error');
        const messageErr = document.getElementById('message-error');

        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            let isValid = true;

            if (nameErr) nameErr.classList.remove('visible');
            if (emailErr) emailErr.classList.remove('visible');
            if (messageErr) messageErr.classList.remove('visible');

            if (!nameInput.value.trim()) {
                if (nameErr) nameErr.classList.add('visible');
                isValid = false;
            }

            if (!nameInput || !validateEmail(emailInput.value.trim())) {
                if (emailErr) emailErr.classList.add('visible');
                isValid = false;
            }

            if (!messageInput.value.trim()) {
                if (messageErr) messageErr.classList.add('visible');
                isValid = false;
            }

            if (!isValid) {
                if (window.AudioEngine && window.AudioEngine.playTick) {
                    window.AudioEngine.playTick(400);
                }
                return;
            }

            submitBtn.disabled = true;
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="btn-text">ENCRYPTING & TRANSMITTING...</span>';

            if (statusFeed) {
                statusFeed.className = 'form-status-feed';
                statusFeed.textContent = '> ENCRYPTING PACKET | DISPATCHING TO r.nithinthedeveloper@gmail.com';
            }

            if (window.AudioEngine && window.AudioEngine.playModeSwitch) {
                window.AudioEngine.playModeSwitch();
            }

            setTimeout(() => {
                if (statusFeed) {
                    statusFeed.className = 'form-status-feed success';
                    statusFeed.textContent = '✓ TRANSMISSION DELIVERED: Packet logged successfully!';
                }

                const mailtoUrl = `mailto:r.nithinthedeveloper@gmail.com?subject=${encodeURIComponent(`Portfolio Inquiry from ${nameInput.value.trim()}`)}&body=${encodeURIComponent(`Sender: ${nameInput.value.trim()}\nEmail: ${emailInput.value.trim()}\n\nMessage:\n${messageInput.value.trim()}`)}`;

                setTimeout(() => {
                    window.location.href = mailtoUrl;
                }, 800);

                form.reset();
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-text">TRANSMISSION CONFIRMED ✓</span>';

                setTimeout(() => {
                    submitBtn.innerHTML = originalBtnHtml;
                }, 3500);
            }, 1000);
        });
    }

    function initSystem() {
        initSkillFilters();
        initProjectSwitcher();
        initCertificateModal();
        initTransmissionForm();

        console.log(
            '%c[DEV TRACKER OS v3.4 | NITHIN R | DUAL CLOCK INTERFACE ACTIVE]%c\n' +
            'Left Clock: Navigation (Clockwise)\n' +
            'Right Clock: Content (Anticlockwise)\n' +
            'Degree Delta: 40° per sector\n' +
            'System Status: READY',
            'color: #00ff66; font-family: monospace; font-size: 13px; font-weight: bold;',
            'color: #8d9c92; font-family: monospace; font-size: 11px;'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSystem);
    } else {
        initSystem();
    }
})();
