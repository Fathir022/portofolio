document.addEventListener('DOMContentLoaded', () => {
    const FORMSPREE_ID = 'YOUR_FORM_ID'; // Ganti dengan ID Formspree kamu

    const world = document.getElementById('world');
    const camera = document.getElementById('camera');
    const scaler = document.getElementById('scaler');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageNum = document.getElementById('pageNum');
    const papers = Array.from(document.querySelectorAll('.paper'));
    const closeBtns = document.querySelectorAll('.close-btn');
    const themeToggle = document.getElementById('themeToggle');
    const contactForm = document.getElementById('contactForm');
    const shareBtns = document.querySelectorAll('.share-btn');

    const CONFIG = {
        PAPER_W: 800,
        PAPER_H: 1400,
        PAPER_WITH_GAP: 1000,
        ROT_X: 55,
        ROT_Z: -35,
    };

    const ROUTES = ['home', 'about', 'contact'];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let currentPage = 0;
    const totalPages = papers.length;
    let isFocused = false;

    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const toastEl = document.getElementById('toast');
    let toastTimer;
    function showToast(message, type = 'success') {
        toastEl.textContent = message;
        toastEl.className = `toast show${type === 'error' ? ' toast-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }

    function readHashPage() {
        const idx = ROUTES.indexOf(location.hash.slice(1));
        return idx >= 0 ? idx : null;
    }
    const initialIdx = readHashPage();
    if (initialIdx !== null) currentPage = initialIdx;
    if (!location.hash) history.replaceState({ page: currentPage }, '', `#${ROUTES[currentPage]}`);

    function handleURLChange() {
        const idx = readHashPage();
        if (idx !== null && idx !== currentPage) {
            currentPage = idx;
            updatePagination();
        }
    }
    window.addEventListener('popstate', handleURLChange);
    window.addEventListener('hashchange', handleURLChange);

    function pushRoute(index) {
        const target = `#${ROUTES[index]}`;
        if (location.hash !== target) history.pushState({ page: index }, '', target);
    }

    let rafId = null;
    let idleFrames = 0;
    const IDLE_THRESHOLD = 30;
    const PARALLAX_EPSILON = 0.01;

    function needsRender() {
        return Math.abs(targetParallaxX - currentParallaxX) > PARALLAX_EPSILON
            || Math.abs(targetParallaxY - currentParallaxY) > PARALLAX_EPSILON;
    }

    function tick() {
        if (document.hidden || prefersReducedMotion || isFocused) { 
            rafId = null; return; 
        }
        if (needsRender()) {
            currentParallaxX += (targetParallaxX - currentParallaxX) * 0.1;
            currentParallaxY += (targetParallaxY - currentParallaxY) * 0.1;
            camera.style.transform = `rotateX(${CONFIG.ROT_X + currentParallaxX}deg) rotateZ(${CONFIG.ROT_Z + currentParallaxY}deg)`;
            idleFrames = 0;
        } else {
            idleFrames++;
            if (idleFrames > IDLE_THRESHOLD) { rafId = null; return; }
        }
        rafId = requestAnimationFrame(tick);
    }

    function startAnimation() {
        if (rafId !== null || isFocused) return;
        idleFrames = 0;
        rafId = requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !prefersReducedMotion && !isFocused) startAnimation();
    });

    papers.forEach((paper, i) => {
        paper.style.left = `${i * CONFIG.PAPER_WITH_GAP}px`;
        paper.style.width = `${CONFIG.PAPER_W}px`;
        paper.style.height = `${CONFIG.PAPER_H}px`;
    });

    function handleResize() {
        if (isFocused) {
            scaler.style.transform = `scale(1)`;
            return;
        }

        const w = window.innerWidth;
        const h = window.innerHeight;
        let scale = 0.85;
        if (w < 1200) scale = 0.7;
        if (w < 900) scale = 0.55;
        if (w < 600) scale = 0.4;
        if (h < 900 && scale > 0.55) scale = 0.55;
        scaler.style.transform = `scale(${scale})`;
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    function updateButtons() {
        btnPrev.disabled = currentPage === 0;
        btnNext.disabled = currentPage === totalPages - 1;
        pageNum.textContent = String(currentPage + 1).padStart(2, '0');
    }

    function updatePagination() {
        updateButtons();
        const translateX = -(currentPage * CONFIG.PAPER_WITH_GAP);
        world.style.transform = `translate3d(${translateX}px, 0, 0)`;

        document.querySelectorAll('.nav-link').forEach((link, i) => {
            link.classList.toggle('active', i === currentPage);
        });

        if (isFocused) {
            papers.forEach((p, i) => {
                p.classList.toggle('is-focused', i === currentPage);
            });
        }
    }

    function navigateTo(index) {
        if (index < 0 || index >= totalPages || index === currentPage) return;
        currentPage = index;
        updatePagination();
        pushRoute(index);
    }

    updatePagination();

    function enterFocus(index) {
        if (isFocused) return;
        isFocused = true;
        currentPage = index;

        document.body.classList.add('is-focused');
        
        camera.style.transform = `rotateX(0deg) rotateZ(0deg)`;
        scaler.style.transform = `scale(1)`; 

        updatePagination();
        pushRoute(index);

        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

        const activeClose = papers[index].querySelector('.close-btn');
        if (activeClose) activeClose.focus({ preventScroll: true });
    }

    function exitFocus() {
        if (!isFocused) return;
        isFocused = false;

        document.body.classList.remove('is-focused');
        
        papers.forEach((p) => {
            p.classList.remove('is-focused');
            const inner = p.querySelector('.paper-inner');
            if (inner) inner.scrollTop = 0;
        });

        handleResize();
        
        targetParallaxX = targetParallaxY = 0;
        currentParallaxX = currentParallaxY = 0;
        camera.style.transform = `rotateX(${CONFIG.ROT_X}deg) rotateZ(${CONFIG.ROT_Z}deg)`;
        
        startAnimation();
    }

    papers.forEach((paper, i) => {
        paper.addEventListener('click', (e) => {
            if (e.target.closest('a, button, input, textarea, label, select, .close-btn, .share-btn, .theme-toggle, .project-card')) return;

            if (!isFocused) {
                enterFocus(i);
            }
        });

        paper.addEventListener('keydown', (e) => {
            if (e.target !== paper) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isFocused) enterFocus(i);
            }
        });
    });

    closeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            exitFocus();
        });
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFocused) { exitFocus(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); navigateTo(currentPage + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); navigateTo(currentPage - 1); }
    });

    document.querySelectorAll('[data-goto]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = parseInt(el.dataset.goto, 10);
            if (!isNaN(target)) navigateTo(target);
        });
    });

    btnPrev.addEventListener('click', () => navigateTo(currentPage - 1));
    btnNext.addEventListener('click', () => navigateTo(currentPage + 1));

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    window.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) || dt > 500) return;
        if (dx < 0) navigateTo(currentPage + 1);
        else navigateTo(currentPage - 1);
    }, { passive: true });

    shareBtns.forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const url = location.href;
            try {
                if (navigator.share) {
                    await navigator.share({ title: document.title, url });
                } else {
                    await navigator.clipboard.writeText(url);
                    showToast('Link copied to clipboard');
                }
            } catch (err) {}
        });
    });

    function handleParallax(clientX, clientY) {
        if (prefersReducedMotion || isFocused) return;
        const x = (clientX / window.innerWidth) * 2 - 1;
        const y = (clientY / window.innerHeight) * 2 - 1;
        targetParallaxX = y * 5;
        targetParallaxY = x * -5;
        startAnimation();
    }

    let mouseMovePending = false;
    let lastMouseEvent = null;
    window.addEventListener('mousemove', (e) => {
        lastMouseEvent = e;
        if (mouseMovePending) return;
        mouseMovePending = true;
        requestAnimationFrame(() => {
            if (lastMouseEvent) handleParallax(lastMouseEvent.clientX, lastMouseEvent.clientY);
            mouseMovePending = false;
        });
    });

    window.addEventListener('touchmove', (e) => {
        if (e.touches[0]) handleParallax(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    startAnimation();

    function updateClock() {
        const timeEl = document.getElementById('time');
        if (!timeEl) return;
        try {
            timeEl.textContent = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
            }).format(new Date());
        } catch {
            timeEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
    }
    updateClock();
    setInterval(updateClock, 30000);

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const original = btn.textContent;
            btn.textContent = 'SENDING...';
            btn.disabled = true;

            try {
                const data = {
                    name: contactForm.querySelector('#contact-name').value.trim(),
                    email: contactForm.querySelector('#contact-email').value.trim(),
                    message: contactForm.querySelector('#contact-message').value.trim(),
                };

                if (FORMSPREE_ID && FORMSPREE_ID !== 'YOUR_FORM_ID') {
                    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
                        method: 'POST',
                        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });
                    if (!res.ok) throw new Error('Send failed');
                } else {
                    await new Promise(r => setTimeout(r, 1000));
                    console.warn('[Portfolio] DEMO MODE. Set FORMSPREE_ID in script.js');
                }

                btn.textContent = '✓ SENT';
                contactForm.reset();
                showToast('Message sent successfully.');
                setTimeout(() => {
                    btn.textContent = original;
                    btn.disabled = false;
                }, 2500);
            } catch (err) {
                btn.textContent = original;
                btn.disabled = false;
                showToast('Failed to send message.', 'error');
            }
        });
    }

    requestAnimationFrame(() => {
        setTimeout(() => document.body.classList.add('loaded'), 50);
    });
});