/* =========================================================
   PORTFOLIO — MOTION + INTERACTION LAYER
   Zero dependencies. Vanilla JS, WAAPI, IntersectionObserver.
   ========================================================= */
(() => {
    'use strict';

    const FORMSPREE_ID = 'YOUR_FORM_ID';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const docEl = document.documentElement;
    const body = document.body;
    const scene = $('#scene');
    const scaler = $('#scaler');
    const camera = $('#camera');
    const world = $('#world');
    const papers = $$('.paper');
    const focusLayer = $('#focusLayer');
    const focusStage = $('#focusStage');
    const focusProgress = $('#focusProgress');
    const pageNum = $('#pageNum');
    const btnPrev = $('#btnPrev');
    const btnNext = $('#btnNext');
    const uiControls = $('.ui-controls');
    const themeToggles = $$('.theme-toggle');
    const contactForm = $('#contactForm');
    const toastEl = $('#toast');
    const toastMessage = $('.toast__message', toastEl);
    const cursorEl = $('#cursor');
    const navMenu = $('#paper-home .nav-menu');
    const navPill = $('#paper-home .nav-pill');
    const navLinks = $$('.nav-link');

    const ROUTES = ['home', 'about', 'contact'];
    const MOBILE_BREAKPOINT = 768;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');

    const css = getComputedStyle(docEl);
    let PAPER_W = parseFloat(css.getPropertyValue('--paper-w')) || 780;
    let PAPER_H = parseFloat(css.getPropertyValue('--paper-h')) || 1320;
    let PAPER_GAP = parseFloat(css.getPropertyValue('--paper-gap')) || 980;

    function isMobileLayout() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    // Flat layout measures its own gap from the viewport; media query values
    // like min() do not parse back to a number, so JS overrides both sides.
    function refreshPaperLayout() {
        if (isMobileLayout()) {
            PAPER_GAP = Math.min(window.innerWidth * 0.92, 480) + 24;
        } else {
            const styles = getComputedStyle(docEl);
            PAPER_W = parseFloat(styles.getPropertyValue('--paper-w')) || 780;
            PAPER_H = parseFloat(styles.getPropertyValue('--paper-h')) || 1320;
            PAPER_GAP = parseFloat(styles.getPropertyValue('--paper-gap')) || 980;
        }
        docEl.style.setProperty('--paper-gap', `${PAPER_GAP}px`);
        papers.forEach((paper, index) => {
            paper.style.setProperty('--paper-x', `${index * PAPER_GAP}px`);
        });
    }

    const CONFIG = {
        rotX: 52,
        rotZ: -32,
        parallaxX: 4.5,
        parallaxY: -4.5,
        focusDuration: 700,
        wheelLock: 700,
    };

    let reducedMotion = reduceQuery.matches;
    let finePointer = finePointerQuery.matches;

    const state = {
        currentPage: 0,
        total: papers.length,
        isFocused: false,
        isTransitioning: false,
        activeVT: null,
        focusedPaper: null,
        focusOrigin: null,
        lastFocused: null,
        focusObserver: null,
        dragMoved: false,
        wheelLocked: false,
        parallaxRaf: null,
        parallax: { x: 0, y: 0, tx: 0, ty: 0 },
        cursorReady: false,
    };

    /* =====================================================
       UTILITIES
       ===================================================== */
    function readHashPage() {
        const index = ROUTES.indexOf(location.hash.slice(1));
        return index >= 0 ? index : null;
    }

    function pushRoute(index) {
        const target = `#${ROUTES[index]}`;
        if (location.hash !== target) {
            history.pushState({ page: index }, '', target);
        }
    }

    function getFocusable(container) {
        if (!container) return [];
        return $$('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
            .filter((el) => {
                if (el.closest('.paper-open')) return false;
                if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
                return el.offsetParent !== null;
            });
    }

    function settleTransition(transition, done, timeout = 900) {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            done();
        };
        const timer = setTimeout(() => {
            try {
                if (transition && typeof transition.skipTransition === 'function') {
                    transition.skipTransition();
                }
            } catch (error) {}
            finish();
        }, timeout);
        if (transition && transition.finished && typeof transition.finished.then === 'function') {
            transition.finished.then(finish, finish);
        } else {
            finish();
        }
    }

    // Snapshots are taken before `ready`; after that the live DOM can animate again.
    function releaseTransitionStyles(transition) {
        const release = () => docEl.classList.remove('no-transition');
        if (transition && transition.ready && typeof transition.ready.then === 'function') {
            transition.ready.then(release, release);
        } else {
            release();
        }
    }

    function trackTransition(transition, paper) {
        state.activeVT = transition;
        releaseTransitionStyles(transition);
        settleTransition(transition, () => {
            if (state.activeVT !== transition) return;
            state.activeVT = null;
            docEl.classList.remove('no-transition');
            if (paper) paper.style.viewTransitionName = '';
        });
    }

    function setWorldX(x, animate = true) {
        world.classList.toggle('is-dragging', !animate);
        world.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    function getWorldX() {
        return -(state.currentPage * PAPER_GAP);
    }

    function positionNavPill() {
        if (!navMenu || !navPill) return;
        const active = navMenu.querySelector('.nav-link.active');
        if (!active) return;
        navPill.style.width = `${active.offsetWidth}px`;
        navPill.style.transform = `translateX(${active.offsetLeft}px)`;
    }

    function rollNumber(el, value) {
        if (!el || el.textContent === value) return;
        el.textContent = value;
        if (reducedMotion) return;
        el.animate(
            [
                { opacity: 0, transform: 'translateY(70%)' },
                { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
    }

    function updateButtons() {
        if (btnPrev) btnPrev.disabled = state.currentPage === 0;
        if (btnNext) btnNext.disabled = state.currentPage === state.total - 1;
    }

    function cameraAngles() {
        if (isMobileLayout()) {
            return { x: 0, z: 0 };
        }
        return { x: CONFIG.rotX, z: CONFIG.rotZ };
    }

    function updateScale() {
        if (isMobileLayout()) {
            scaler.style.transform = 'none';
            return;
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        const base = Math.max(
            0.20,
            Math.min((width * 0.90) / PAPER_W, (height * 0.92) / PAPER_H, 0.92)
        );

        // The 3D projection can be wider than the flat paper and its bounding
        // box sits off-centre. Measure it at scale 1 (transitions off) and work
        // out the largest scale that keeps the current page fully on screen.
        const paper = papers[state.currentPage] || papers[0];
        let scale = base;
        if (paper && !state.isFocused) {
            scaler.style.transition = 'none';
            scaler.style.transform = 'scale(1)';
            const rect = paper.getBoundingClientRect();
            if (rect.width && rect.height) {
                const cx = width / 2;
                const cy = height / 2;
                const dx = Math.max(Math.abs(rect.left - cx), Math.abs(rect.right - cx));
                const dy = Math.max(Math.abs(rect.top - cy), Math.abs(rect.bottom - cy));
                const fit = Math.min(1, (width * 0.47) / dx, (height * 0.47) / dy);
                scale = Math.min(base, fit);
            }
            scaler.style.transform = `scale(${Math.max(0.18, scale)})`;
            void scaler.offsetWidth;
            scaler.style.transition = '';
        } else {
            scaler.style.transform = `scale(${base})`;
        }
    }

    function resetCamera() {
        if (state.parallaxRaf) {
            cancelAnimationFrame(state.parallaxRaf);
            state.parallaxRaf = null;
        }
        state.parallax.x = 0;
        state.parallax.y = 0;
        state.parallax.tx = 0;
        state.parallax.ty = 0;
        const angles = cameraAngles();
        camera.style.transform = `rotateX(${angles.x}deg) rotateZ(${angles.z}deg)`;
    }

    /* =====================================================
       REVEALS
       ===================================================== */
    function revealElements(container, { stagger = 55, scrollRoot = null } = {}) {
        if (!container) return;
        const items = $$('[data-reveal]', container);
        if (!items.length) return;

        if (reducedMotion) {
            items.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        const pending = items.filter((el) => !el.classList.contains('is-visible'));
        if (!pending.length) return;

        if (scrollRoot) {
            if (state.focusObserver) state.focusObserver.disconnect();
            let batchIndex = 0;
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;
                        const el = entry.target;
                        observer.unobserve(el);
                        el.style.setProperty('--reveal-delay', `${batchIndex * stagger}ms`);
                        el.classList.add('is-visible');
                        batchIndex += 1;
                    });
                },
                { root: scrollRoot, threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
            );
            pending.forEach((el) => observer.observe(el));
            state.focusObserver = observer;
            return;
        }

        pending.forEach((el, index) => {
            el.style.setProperty('--reveal-delay', `${index * stagger}ms`);
            el.classList.add('is-visible');
        });
    }

    /* =====================================================
       NAVIGATION
       ===================================================== */
    function updatePagination() {
        setWorldX(getWorldX(), true);
        updateButtons();
        if (pageNum) rollNumber(pageNum, String(state.currentPage + 1).padStart(2, '0'));
        navLinks.forEach((link, index) => {
            link.classList.toggle('active', index === state.currentPage);
            if (index === state.currentPage) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        positionNavPill();
    }

    function navigateTo(index, { updateHash = true } = {}) {
        if (state.isFocused) return;
        if (index < 0 || index >= state.total || index === state.currentPage) return;
        state.currentPage = index;
        updatePagination();
        if (updateHash) pushRoute(index);
        revealElements(papers[index], { stagger: 55 });
    }

    /* =====================================================
       FOCUS MODE
       ===================================================== */
    function updateFocusProgress() {
        if (!state.isFocused || !state.focusedPaper || !focusProgress) return;
        const inner = state.focusedPaper.querySelector('.paper-inner');
        if (!inner) return;
        const max = inner.scrollHeight - inner.clientHeight;
        const progress = max > 0 ? inner.scrollTop / max : 0;
        focusProgress.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }

    function finishFocusEnter(paper) {
        state.isTransitioning = false;
        paper.style.transformOrigin = '';

        const close = paper.querySelector('.close-btn');
        if (close) close.focus({ preventScroll: true });

        const inner = paper.querySelector('.paper-inner');
        if (inner) {
            inner.scrollTop = 0;
            revealElements(paper, { scrollRoot: inner, stagger: 40 });
        }
        updateFocusProgress();
    }

    function enterFocus(index) {
        if (state.isFocused || state.isTransitioning) return;
        const paper = papers[index];
        if (!paper) return;

        paper.getAnimations().forEach((animation) => animation.cancel());

        const oldRect = paper.getBoundingClientRect();
        state.isFocused = true;
        state.isTransitioning = true;
        state.focusedPaper = paper;
        state.lastFocused = paper.querySelector('.paper-open') || document.activeElement;
        state.focusOrigin = { parent: paper.parentElement, next: paper.nextSibling };

        paper.style.setProperty('--lift', '0px');
        paper.style.setProperty('--rx', '0deg');
        paper.style.setProperty('--ry', '0deg');

        const update = () => {
            focusStage.appendChild(paper);
            paper.classList.add('is-focused');
            paper.style.animation = 'none';
            scene.inert = true;
            uiControls.inert = true;

            body.classList.add('is-focused');
            focusLayer.classList.add('is-active');
            focusLayer.setAttribute('aria-hidden', 'false');

            const labelledBy = paper.getAttribute('aria-labelledby');
            if (labelledBy) focusLayer.setAttribute('aria-labelledby', labelledBy);

            const inner = paper.querySelector('.paper-inner');
            if (inner) inner.scrollTop = 0;

            state.currentPage = index;
            updatePagination();
            pushRoute(index);
            resetCamera();
            finishFocusEnter(paper);
        };

        if (typeof document.startViewTransition === 'function' && !reducedMotion) {
            docEl.classList.add('no-transition');
            paper.style.viewTransitionName = 'active-paper';
            try {
                const transition = document.startViewTransition(update);
                trackTransition(transition, paper);
            } catch (error) {
                docEl.classList.remove('no-transition');
                update();
                fallbackFocusIn(paper, oldRect);
            }
        } else if (reducedMotion) {
            update();
        } else {
            update();
            fallbackFocusIn(paper, oldRect);
        }
    }

    function fallbackFocusIn(paper, oldRect) {
        paper.style.transformOrigin = 'top left';
        const newRect = paper.getBoundingClientRect();
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        const sx = oldRect.width / newRect.width;
        const sy = oldRect.height / newRect.height;

        const animation = paper.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.65 },
                { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
            ],
            { duration: CONFIG.focusDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );

        animation.finished.catch(() => {});
    }

    function finishFocusExit() {
        state.isTransitioning = false;
        if (focusProgress) focusProgress.style.width = '0%';
        const target = state.lastFocused;
        if (target && target.isConnected) {
            target.focus({ preventScroll: true });
        } else if (state.focusedPaper) {
            const fallback = state.focusedPaper.querySelector('.paper-open');
            if (fallback) fallback.focus({ preventScroll: true });
        }
        state.lastFocused = null;
        state.focusedPaper = null;
    }

    function exitFocus() {
        if (!state.isFocused || state.isTransitioning) return;
        const paper = state.focusedPaper;
        if (!paper) return;

        state.isTransitioning = true;

        if (state.focusObserver) {
            state.focusObserver.disconnect();
            state.focusObserver = null;
        }

        const update = () => {
            state.isFocused = false;

            paper.classList.remove('is-focused');
            paper.style.animation = '';
            paper.style.transform = '';
            paper.style.transformOrigin = '';

            const origin = state.focusOrigin;
            if (origin && origin.parent) {
                if (origin.next && origin.next.parentNode === origin.parent) {
                    origin.parent.insertBefore(paper, origin.next);
                } else {
                    origin.parent.appendChild(paper);
                }
            }

            const inner = paper.querySelector('.paper-inner');
            if (inner) inner.scrollTop = 0;

            const openButton = paper.querySelector('.paper-open');
            if (openButton) openButton.focus({ preventScroll: true });

            body.classList.remove('is-focused');
            focusLayer.classList.remove('is-active');
            focusLayer.setAttribute('aria-hidden', 'true');
            focusLayer.removeAttribute('aria-labelledby');

            scene.inert = false;
            uiControls.inert = false;

            state.focusOrigin = null;
            state.currentPage = Number.parseInt(paper.dataset.index, 10) || 0;

            updatePagination();
            resetCamera();
            finishFocusExit();
        };

        if (typeof document.startViewTransition === 'function' && !reducedMotion) {
            docEl.classList.add('no-transition');
            paper.style.viewTransitionName = 'active-paper';
            try {
                const transition = document.startViewTransition(update);
                trackTransition(transition, paper);
            } catch (error) {
                docEl.classList.remove('no-transition');
                update();
            }
        } else if (reducedMotion) {
            update();
        } else {
            const animation = paper.animate(
                [
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                    { opacity: 0, transform: 'translateY(10px) scale(0.98)' },
                ],
                { duration: 240, easing: 'ease-in' }
            );
            animation.finished
                .catch(() => {})
                .finally(() => {
                    update();
                });
        }
    }

    /* =====================================================
       PARALLAX
       ===================================================== */
    function startParallax() {
        if (reducedMotion || state.isFocused || state.parallaxRaf) return;
        state.parallaxRaf = requestAnimationFrame(tickParallax);
    }

    function tickParallax() {
        state.parallaxRaf = null;
        if (reducedMotion || state.isFocused) return;

        const p = state.parallax;
        p.x += (p.tx - p.x) * 0.08;
        p.y += (p.ty - p.y) * 0.08;

        const angles = cameraAngles();
        camera.style.transform = `rotateX(${angles.x + p.x}deg) rotateZ(${angles.z + p.y}deg)`;

        if (Math.abs(p.tx - p.x) > 0.01 || Math.abs(p.ty - p.y) > 0.01) {
            state.parallaxRaf = requestAnimationFrame(tickParallax);
        }
    }

    /* =====================================================
       TILT + MAGNETIC
       ===================================================== */
    function initTilt() {
        $$('[data-tilt]').forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                if (reducedMotion || event.pointerType !== 'mouse' || state.isFocused) return;
                const rect = card.getBoundingClientRect();
                const px = (event.clientX - rect.left) / rect.width - 0.5;
                const py = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.setProperty('--tilt-x', `${(-py * 3).toFixed(2)}deg`);
                card.style.setProperty('--tilt-y', `${(px * 3).toFixed(2)}deg`);
                card.style.setProperty('--tilt-lift', '-4px');
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
                card.style.setProperty('--tilt-lift', '0px');
            });
        });
    }

    function initMagnetic() {
        $$('.magnetic').forEach((el) => {
            el.addEventListener('pointermove', (event) => {
                if (reducedMotion || event.pointerType !== 'mouse') return;
                const rect = el.getBoundingClientRect();
                const x = (event.clientX - rect.left - rect.width / 2) * 0.08;
                const y = (event.clientY - rect.top - rect.height / 2) * 0.10;
                el.style.setProperty('--mx', `${x.toFixed(1)}px`);
                el.style.setProperty('--my', `${y.toFixed(1)}px`);
            });

            el.addEventListener('pointerleave', () => {
                el.style.setProperty('--mx', '0px');
                el.style.setProperty('--my', '0px');
            });
        });
    }

    /* =====================================================
       CURSOR
       ===================================================== */
    function initCursor() {
        if (state.cursorReady) {
            if (!reducedMotion && finePointer) body.classList.add('has-cursor');
            return;
        }
        if (!finePointer || reducedMotion || isMobileLayout()) return;

        state.cursorReady = true;
        body.classList.add('has-cursor');

        const dot = $('.cursor__dot', cursorEl);
        const ring = $('.cursor__ring', cursorEl);
        const label = $('.cursor__label', cursorEl);

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ringX = mouseX;
        let ringY = mouseY;
        let raf = null;

        function placeDot() {
            dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        }

        function tick() {
            raf = null;
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
            placeDot();
            if (Math.abs(mouseX - ringX) > 0.1 || Math.abs(mouseY - ringY) > 0.1) {
                raf = requestAnimationFrame(tick);
            }
        }

        placeDot();

        window.addEventListener(
            'pointermove',
            (event) => {
                if (event.pointerType !== 'mouse' || reducedMotion) return;
                mouseX = event.clientX;
                mouseY = event.clientY;
                if (!raf) raf = requestAnimationFrame(tick);
            },
            { passive: true }
        );

        document.addEventListener('pointerover', (event) => {
            const target = event.target.closest('a, button, input, textarea, select, [data-cursor], .paper');
            if (!target) {
                cursorEl.classList.remove('is-hover', 'has-label', 'is-text');
                label.textContent = '';
                return;
            }

            const isText = Boolean(target.closest('input, textarea, select'));
            cursorEl.classList.toggle('is-text', isText);

            let text = target.getAttribute('data-cursor') || '';
            if (target.matches('.paper.is-focused')) text = '';
            cursorEl.classList.add('is-hover');
            cursorEl.classList.toggle('has-label', Boolean(text));
            label.textContent = text;
        });

        document.addEventListener('pointerdown', () => cursorEl.classList.add('is-down'));
        document.addEventListener('pointerup', () => cursorEl.classList.remove('is-down'));
    }

    /* =====================================================
       THEME
       ===================================================== */
    function applyTheme(theme) {
        docEl.dataset.theme = theme;
        try {
            localStorage.setItem('theme', theme);
        } catch (error) {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0B0C' : '#F4F1EB');
        themeToggles.forEach((button) => button.setAttribute('aria-pressed', String(theme === 'dark')));
    }

    function toggleTheme(origin) {
        if (!themeToggles.length) return;
        const next = docEl.dataset.theme === 'dark' ? 'light' : 'dark';

        if (typeof document.startViewTransition === 'function' && !reducedMotion && !state.isTransitioning) {
            const anchor = origin || themeToggles.find((button) => button.offsetParent !== null) || themeToggles[0];
            const rect = anchor.getBoundingClientRect();
            docEl.style.setProperty('--theme-x', `${rect.left + rect.width / 2}px`);
            docEl.style.setProperty('--theme-y', `${rect.top + rect.height / 2}px`);
            state.isTransitioning = true;
            docEl.classList.add('no-transition');
            try {
                const transition = document.startViewTransition(() => applyTheme(next));
                state.activeVT = transition;
                releaseTransitionStyles(transition);
                settleTransition(
                    transition,
                    () => {
                        state.isTransitioning = false;
                        if (state.activeVT !== transition) return;
                        state.activeVT = null;
                        docEl.classList.remove('no-transition');
                    },
                    900
                );
            } catch (error) {
                docEl.classList.remove('no-transition');
                state.isTransitioning = false;
                applyTheme(next);
            }
        } else {
            applyTheme(next);
        }
    }

    /* =====================================================
       TOAST
       ===================================================== */
    let toastTimer = null;

    function showToast(message, type = 'success') {
        if (!toastEl || !toastMessage) return;
        toastEl.classList.remove('show');
        toastEl.classList.remove('toast-error');
        void toastEl.offsetWidth;
        toastMessage.textContent = message;
        toastEl.classList.toggle('toast-error', type === 'error');
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
    }

    /* =====================================================
       FORM
       ===================================================== */
    function validateInput(input) {
        const group = input.closest('.input-group');
        let valid = input.value.trim() !== '';
        if (valid && input.type === 'email') {
            valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        }
        if (group) group.classList.toggle('is-invalid', !valid);
        input.setAttribute('aria-invalid', String(!valid));
        return valid;
    }

    function initForm() {
        if (!contactForm) return;
        const inputs = $$('.form-input', contactForm);

        inputs.forEach((input) => {
            const group = input.closest('.input-group');
            const sync = () => {
                if (group) group.classList.toggle('has-value', input.value.trim() !== '');
            };

            input.addEventListener('input', () => {
                sync();
                if (group && group.classList.contains('is-invalid')) validateInput(input);
            });
            input.addEventListener('blur', () => {
                if (input.value.trim()) validateInput(input);
            });
            sync();
        });

        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            let firstInvalid = null;

            inputs.forEach((input) => {
                if (!validateInput(input) && !firstInvalid) firstInvalid = input;
            });

            if (firstInvalid) {
                firstInvalid.focus();
                showToast('Please complete the form.', 'error');
                return;
            }

            const button = contactForm.querySelector('button[type="submit"]');
            if (!button) return;

            button.disabled = true;
            button.classList.remove('is-success');
            button.classList.add('is-loading');

            try {
                const data = {
                    name: $('#contact-name').value.trim(),
                    email: $('#contact-email').value.trim(),
                    message: $('#contact-message').value.trim(),
                };

                if (FORMSPREE_ID && FORMSPREE_ID !== 'YOUR_FORM_ID') {
                    const response = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
                        method: 'POST',
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });
                    if (!response.ok) throw new Error('Send failed');
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    console.warn('[Portfolio] DEMO MODE. Set FORMSPREE_ID in script.js');
                }

                button.classList.remove('is-loading');
                button.classList.add('is-success');
                contactForm.reset();
                inputs.forEach((input) => {
                    const group = input.closest('.input-group');
                    if (group) group.classList.remove('has-value', 'is-invalid');
                    input.removeAttribute('aria-invalid');
                });
                showToast('Message sent successfully.');

                setTimeout(() => {
                    button.classList.remove('is-success');
                    button.disabled = false;
                }, 2500);
            } catch (error) {
                button.classList.remove('is-loading');
                button.disabled = false;
                showToast('Failed to send message.', 'error');
                button.animate(
                    [
                        { transform: 'translateX(0)' },
                        { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' },
                        { transform: 'translateX(0)' },
                    ],
                    { duration: 300, easing: 'ease-in-out' }
                );
            }
        });
    }

    /* =====================================================
       CLOCK + SHARE + IMAGES
       ===================================================== */
    let lastClock = '';

    function updateClock() {
        const timeEl = document.getElementById('time');
        if (!timeEl) return;

        let text;
        try {
            text = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date());
        } catch (error) {
            text = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }

        if (text === lastClock) return;
        lastClock = text;
        timeEl.textContent = text;

        if (!reducedMotion) {
            timeEl.animate(
                [
                    { opacity: 0, transform: 'translateY(4px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                ],
                { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
        }
    }

    function initShare() {
        $$('.share-btn').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!reducedMotion) {
                    button.animate(
                        [
                            { transform: 'scale(1)' },
                            { transform: 'scale(0.86)' },
                            { transform: 'scale(1)' },
                        ],
                        { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
                    );
                }

                const url = location.href;
                try {
                    if (navigator.share) {
                        await navigator.share({ title: document.title, url });
                    } else {
                        await navigator.clipboard.writeText(url);
                        showToast('Link copied to clipboard');
                    }
                } catch (error) {
                    try {
                        await navigator.clipboard.writeText(url);
                        showToast('Link copied to clipboard');
                    } catch (clipboardError) {}
                }
            });
        });
    }

    function initImages() {
        $$('.img-wrapper img').forEach((img) => {
            const handleError = () => {
                const wrapper = img.parentElement;
                if (!wrapper) return;
                wrapper.classList.add('bg-placeholder');
                wrapper.setAttribute('data-mark', '');
                wrapper.setAttribute('role', 'img');
                wrapper.setAttribute('aria-label', img.alt || 'Project image');
                img.remove();
            };
            img.addEventListener('error', handleError);
            if (img.complete && img.naturalWidth === 0) handleError();
        });
    }

    /* =====================================================
       INPUT: WHEEL / DRAG / KEYS
       ===================================================== */
    function initWheel() {
        scene.addEventListener(
            'wheel',
            (event) => {
                if (state.isFocused || reducedMotion) return;
                if (event.ctrlKey) return;
                const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                if (Math.abs(delta) < 14) return;
                // On the flat layout the paper content scrolls; keep wheel there.
                const inner = event.target.closest && event.target.closest('.paper-inner');
                if (inner && inner.scrollHeight > inner.clientHeight + 4) return;
                event.preventDefault();
                if (state.wheelLocked) return;
                state.wheelLocked = true;
                navigateTo(state.currentPage + (delta > 0 ? 1 : -1));
                setTimeout(() => {
                    state.wheelLocked = false;
                }, CONFIG.wheelLock);
            },
            { passive: false }
        );
    }

    function initDrag() {
        let drag = null;

        scene.addEventListener('pointerdown', (event) => {
            if (state.isFocused) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (event.target.closest('a, button, input, textarea, label, select, .paper-open, .close-btn, .share-btn, .theme-toggle, .project-card')) return;

            drag = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                baseX: getWorldX(),
                moved: false,
            };
            world.classList.add('is-dragging');
        });

        scene.addEventListener('pointermove', (event) => {
            if (!drag || event.pointerId !== drag.id) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.moved && Math.abs(dx) > 6) {
                drag.moved = true;
                try {
                    scene.setPointerCapture(event.pointerId);
                } catch (error) {}
            }
            if (!drag.moved) return;

            if (reducedMotion) {
                state.dragMoved = true;
                return;
            }

            let x = drag.baseX + dx;
            const minX = -(state.total - 1) * PAPER_GAP;
            if (x > 0) x *= 0.32;
            if (x < minX) x = minX + (x - minX) * 0.32;

            world.style.transform = `translate3d(${x}px, 0, 0)`;
            state.dragMoved = true;
        });

        function endDrag(event) {
            if (!drag) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            const moved = drag.moved;
            drag = null;
            world.classList.remove('is-dragging');

            if (moved && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
                navigateTo(state.currentPage + (dx < 0 ? 1 : -1));
            } else {
                setWorldX(getWorldX(), true);
            }

            setTimeout(() => {
                state.dragMoved = false;
            }, 60);
        }

        scene.addEventListener('pointerup', endDrag);
        scene.addEventListener('pointercancel', endDrag);
    }

    function initClicks() {
        if (btnPrev) {
            btnPrev.addEventListener('click', () => navigateTo(state.currentPage - 1));
        }
        if (btnNext) {
            btnNext.addEventListener('click', () => navigateTo(state.currentPage + 1));
        }

        document.addEventListener('click', (event) => {
            const skipLink = event.target.closest('.skip-link');
            if (skipLink) {
                event.preventDefault();
                const target = document.getElementById('world');
                if (target) target.focus({ preventScroll: true });
                return;
            }

            const closeTrigger = event.target.closest('[data-close]');
            if (closeTrigger) {
                event.preventDefault();
                exitFocus();
                return;
            }

            const openTrigger = event.target.closest('[data-open]');
            if (openTrigger && !state.isFocused) {
                event.preventDefault();
                const paper = openTrigger.closest('.paper');
                const index = paper ? Number.parseInt(paper.dataset.index, 10) : NaN;
                if (!Number.isNaN(index)) enterFocus(index);
                return;
            }

            const navTrigger = event.target.closest('[data-goto]');
            if (navTrigger) {
                event.preventDefault();
                const index = Number.parseInt(navTrigger.dataset.goto, 10);
                if (Number.isNaN(index)) return;
                if (state.isFocused) {
                    exitFocus();
                    setTimeout(() => navigateTo(index), reducedMotion ? 0 : 820);
                } else {
                    navigateTo(index);
                }
                return;
            }

            if (state.isFocused || state.dragMoved) return;
            if (event.target.closest('a, button, input, textarea, label, select, .share-btn, .theme-toggle, .project-card')) return;

            const paper = event.target.closest('.paper');
            if (!paper) return;
            const index = Number.parseInt(paper.dataset.index, 10);
            if (!Number.isNaN(index)) enterFocus(index);
        });
    }

    function initKeyboard() {
        window.addEventListener('keydown', (event) => {
            if (state.isFocused) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    exitFocus();
                }
                return;
            }

            if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                navigateTo(state.currentPage + 1);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateTo(state.currentPage - 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                navigateTo(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                navigateTo(state.total - 1);
            }
        });

        papers.forEach((paper) => {
            paper.addEventListener('keydown', (event) => {
                if (event.target !== paper || state.isFocused) return;
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.preventDefault();
                    enterFocus(Number.parseInt(paper.dataset.index, 10));
                }
            });
        });

        focusLayer.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab' || !state.isFocused || !state.focusedPaper) return;
            const focusable = getFocusable(state.focusedPaper);
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        document.addEventListener('focusin', (event) => {
            if (!state.isFocused || !state.focusedPaper) return;
            if (focusLayer.contains(event.target)) return;
            const close = state.focusedPaper.querySelector('.close-btn');
            if (close) close.focus({ preventScroll: true });
        });
    }

    /* =====================================================
       PARALLAX + PAPER TILT LISTENERS
       ===================================================== */
    function initPointerMotion() {
        scene.addEventListener(
            'pointermove',
            (event) => {
                if (event.pointerType !== 'mouse' || reducedMotion || state.isFocused || isMobileLayout()) return;
                const nx = (event.clientX / window.innerWidth) * 2 - 1;
                const ny = (event.clientY / window.innerHeight) * 2 - 1;
                state.parallax.tx = ny * CONFIG.parallaxX;
                state.parallax.ty = nx * CONFIG.parallaxY;
                startParallax();
            },
            { passive: true }
        );

        scene.addEventListener('pointerleave', () => {
            state.parallax.tx = 0;
            state.parallax.ty = 0;
            startParallax();
        });

        papers.forEach((paper) => {
            paper.addEventListener('pointerenter', (event) => {
                if (reducedMotion || event.pointerType !== 'mouse' || state.isFocused || isMobileLayout()) return;
                paper.style.setProperty('--lift', '6px');
            });

            paper.addEventListener('pointermove', (event) => {
                if (reducedMotion || event.pointerType !== 'mouse' || state.isFocused || isMobileLayout()) return;
                const rect = paper.getBoundingClientRect();
                const px = (event.clientX - rect.left) / rect.width - 0.5;
                const py = (event.clientY - rect.top) / rect.height - 0.5;
                paper.style.setProperty('--rx', `${(-py * 1.8).toFixed(2)}deg`);
                paper.style.setProperty('--ry', `${(px * 1.8).toFixed(2)}deg`);
            });

            paper.addEventListener('pointerleave', () => {
                paper.style.setProperty('--lift', '0px');
                paper.style.setProperty('--rx', '0deg');
                paper.style.setProperty('--ry', '0deg');
            });
        });
    }

    /* =====================================================
       RESIZE + ROUTES
       ===================================================== */
    function initResize() {
        let raf = null;
        window.addEventListener(
            'resize',
            () => {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = null;
                    refreshPaperLayout();
                    resetCamera();
                    updateScale();
                    setWorldX(getWorldX(), true);
                    positionNavPill();
                    updateFocusProgress();
                    if (!reducedMotion && finePointer) {
                        if (!isMobileLayout()) initCursor();
                        else if (state.cursorReady) body.classList.remove('has-cursor');
                    }
                });
            },
            { passive: true }
        );
    }

    function initRoutes() {
        const handleURLChange = () => {
            const index = readHashPage();
            if (index === null) return;

            if (state.isFocused) {
                exitFocus();
                setTimeout(() => navigateTo(index), reducedMotion ? 0 : 820);
            } else {
                navigateTo(index);
            }
        };

        window.addEventListener('popstate', handleURLChange);
        window.addEventListener('hashchange', handleURLChange);
    }

    /* =====================================================
       LOAD
       ===================================================== */
    function animatePapersIn() {
        if (reducedMotion) return;
        papers.forEach((paper, index) => {
            paper.animate(
                [
                    { opacity: 0, transform: 'translate(-50%, calc(-50% + 80px)) scale(0.96)' },
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                ],
                {
                    duration: 950,
                    delay: 90 * index + 100,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            );
        });
    }

    function initMotionPreference() {
        const handleChange = (event) => {
            reducedMotion = event.matches;

            if (reducedMotion) {
                body.classList.remove('has-cursor');
                resetCamera();
                $$('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
            } else {
                if (finePointer) initCursor();
                startParallax();
            }
        };

        if (typeof reduceQuery.addEventListener === 'function') {
            reduceQuery.addEventListener('change', handleChange);
        } else if (typeof reduceQuery.addListener === 'function') {
            reduceQuery.addListener(handleChange);
        }

        // Hybrid devices: enable the custom cursor only while a mouse is attached.
        if (typeof finePointerQuery.addEventListener === 'function') {
            finePointerQuery.addEventListener('change', (event) => {
                finePointer = event.matches;
                if (finePointer && !reducedMotion) {
                    initCursor();
                } else {
                    body.classList.remove('has-cursor');
                }
            });
        }
    }

    function boot() {
        papers.forEach((paper) => {
            const inner = paper.querySelector('.paper-inner');
            if (inner) inner.addEventListener('scroll', updateFocusProgress, { passive: true });
        });
        refreshPaperLayout();

        const initialIndex = readHashPage();
        if (initialIndex !== null) state.currentPage = initialIndex;
        if (!location.hash) {
            history.replaceState({ page: state.currentPage }, '', `#${ROUTES[state.currentPage]}`);
        }

        if (themeToggles.length) {
            themeToggles.forEach((button) => {
                button.setAttribute('aria-pressed', String(docEl.dataset.theme === 'dark'));
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    toggleTheme(button);
                });
            });
        }

        resetCamera();
        setWorldX(getWorldX(), false);
        updateScale();
        updatePagination();
        initTilt();
        initMagnetic();
        initCursor();
        initForm();
        initShare();
        initImages();
        initWheel();
        initDrag();
        initClicks();
        initKeyboard();
        initPointerMotion();
        initResize();
        initRoutes();
        initMotionPreference();
        updateClock();
        setInterval(updateClock, 30000);

        animatePapersIn();
        body.classList.remove('is-loading');
        body.classList.add('is-loaded');

        setTimeout(() => {
            revealElements(papers[state.currentPage], { stagger: 60 });
            positionNavPill();
        }, 360);

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(positionNavPill).catch(() => {});
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
