const heroBanner = document.getElementById('heroBanner');
const mainContent = document.getElementById('mainContent');
const aboutBtn = document.getElementById('aboutBtn');
const backBtn = document.getElementById('backBtn'); // Referensi tombol kembali

// Saat Tombol 'About Me' Diklik (Layar Mengecil)
aboutBtn.addEventListener('click', () => {
    heroBanner.classList.remove('hero-mode');
    heroBanner.classList.add('sidebar-mode');
    
    mainContent.classList.remove('hidden-cards');
    mainContent.classList.add('show-cards');
});

// Saat Tombol 'Kembali' (Panah) Diklik (Layar Membesar ke Awal)
backBtn.addEventListener('click', () => {
    heroBanner.classList.remove('sidebar-mode');
    heroBanner.classList.add('hero-mode');
    
    mainContent.classList.remove('show-cards');
    mainContent.classList.add('hidden-cards');
});

// ===============================================
// LOGIKA ANIMASI KARTU MATERIAL 3
// ===============================================
const grid = document.getElementById('portfolioGrid');
const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    let releaseTimeout;

    const activate = () => {
        grid.setAttribute('data-interact', 'true');
        card.setAttribute('data-active', 'true');
    };

    const deactivate = () => {
        grid.removeAttribute('data-interact');
        card.removeAttribute('data-active');
    };

    card.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; 
        clearTimeout(releaseTimeout);
        activate();
    });

    card.addEventListener('pointerup', () => {
        clearTimeout(releaseTimeout);
        releaseTimeout = setTimeout(deactivate, 120);
    });

    card.addEventListener('pointercancel', () => {
        clearTimeout(releaseTimeout);
        deactivate(); 
    });

    card.addEventListener('pointerleave', () => {
        clearTimeout(releaseTimeout);
        deactivate();
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clearTimeout(releaseTimeout);
            activate();
            releaseTimeout = setTimeout(deactivate, 200);
        }
    });
});