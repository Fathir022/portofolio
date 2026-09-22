const grid = document.getElementById('portfolioGrid');
const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    let releaseTimeout;

    // Memulai efek animasi (INSTAN)
    const activate = () => {
        grid.setAttribute('data-interact', 'true');
        card.setAttribute('data-active', 'true');
    };

    // Mengakhiri efek animasi
    const deactivate = () => {
        grid.removeAttribute('data-interact');
        card.removeAttribute('data-active');
    };

    // Saat jari MENYENTUH layar ATAU mouse ditekan (Tanpa delay sama sekali)
    card.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; // Abaikan klik kanan
        clearTimeout(releaseTimeout);
        activate();
    });

    // Saat jari DIANGKAT ATAU mouse dilepas
    card.addEventListener('pointerup', () => {
        clearTimeout(releaseTimeout);
        // Jeda 120ms ini adalah rahasianya: Walaupun Anda melakukan Tap kilat, 
        // kartu dijamin akan membesar dulu sebelum kembali membal.
        releaseTimeout = setTimeout(deactivate, 120);
    });

    // Saat jari MENGGESER layar (Scroll Mobile)
    card.addEventListener('pointercancel', () => {
        clearTimeout(releaseTimeout);
        deactivate(); // Animasi dibatalkan seketika agar scroll lancar
    });

    // Saat kursor mouse keluar batas kartu
    card.addEventListener('pointerleave', () => {
        clearTimeout(releaseTimeout);
        deactivate();
    });

    // Dukungan Aksesibilitas Keyboard (Tab + Enter/Spasi)
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clearTimeout(releaseTimeout);
            activate();
            releaseTimeout = setTimeout(deactivate, 200);
        }
    });
});