document.addEventListener('DOMContentLoaded', () => {
    const world = document.getElementById('world');
    const camera = document.getElementById('camera');
    const scaler = document.getElementById('scaler');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageNum = document.getElementById('pageNum');
    const papers = document.querySelectorAll('.paper');
    const closeBtns = document.querySelectorAll('.close-btn');
    const uiControls = document.querySelector('.ui-controls');
    const pageIndicator = document.querySelector('.page-indicator');
    
    let currentPage = 0;
    const totalPages = 3;
    const paperWidthWithGap = 1000; // 800px width + 200px gap
    let isFullscreen = false;

    // Rotasi isometrik dasar
    const baseRotX = 55;
    const baseRotZ = -35;
    
    // Tracking pergerakan mouse (parallax)
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    // Mengatur skala responsif saat mode 3D
    function handleResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        let scale = 1;
        if (w < 1200) scale = 0.8;
        if (w < 900) scale = 0.6;
        if (w < 600) scale = 0.45;
        if (h < 900 && scale > 0.6) scale = 0.6;
        
        scaler.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', handleResize);
    handleResize(); 

    // Setup posisi awal kertas
    papers.forEach((paper, i) => {
        paper.style.left = `${i * paperWidthWithGap}px`;
        
        paper.addEventListener('click', (e) => {
            if (!isFullscreen && !e.target.closest('.close-btn')) {
                enterFullscreen(i);
            }
        });
    });
    
    // Tombol close (silang)
    closeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            exitFullscreen();
        });
    });

    // Update tombol navigasi dan posisi dunia 3D
    function updatePagination() {
        btnPrev.disabled = currentPage === 0;
        btnNext.disabled = currentPage === totalPages - 1;
        pageNum.textContent = currentPage + 1;
        
        if (isFullscreen) return; 

        const translateX = -(currentPage * paperWidthWithGap);
        world.style.transform = `translate3d(${translateX}px, 0, 0)`;
    }

    updatePagination();
    
    // Logika Fullscreen (Datar & Bisa di-scroll)
    function enterFullscreen(index) {
        isFullscreen = true;
        currentPage = index;
        
        document.body.classList.add('is-fullscreen');
        camera.classList.add('snap-mode'); 
        
        // Sembunyikan navigasi UI
        uiControls.style.opacity = '0';
        uiControls.style.pointerEvents = 'none';
        pageIndicator.style.opacity = '0';
        
        // Atur rotasi menjadi datar dan paksa skala ke 1 agar tidak terlalu zoom
        camera.style.transform = `rotateX(0deg) rotateZ(0deg)`;
        scaler.style.transform = `scale(1)`; 
        
        papers.forEach((paper, i) => {
            paper.classList.add('is-fullscreen');
            
            // Pertahankan lebar 800px, tapi batasi tinggi sesuai layar agar bisa di-scroll
            paper.style.width = 'min(800px, 100vw)';
            paper.style.height = '100vh';
            paper.style.overflowY = 'auto'; // Aktifkan scroll
            
            if (i === index) {
                const closeBtn = paper.querySelector('.close-btn');
                closeBtn.style.opacity = '1';
                closeBtn.style.pointerEvents = 'auto';
            }
        });
        
        // Geser dunia 3D sesuai posisi
        world.style.transform = `translate3d(-${index * paperWidthWithGap}px, 0, 0)`;
        updatePagination(); 
    }
    
    // Keluar dari mode datar
    function exitFullscreen() {
        isFullscreen = false;
        document.body.classList.remove('is-fullscreen');
        camera.classList.add('snap-mode');
        
        // Tampilkan navigasi UI kembali
        uiControls.style.opacity = '1';
        uiControls.style.pointerEvents = 'auto';
        pageIndicator.style.opacity = '1';
        
        papers.forEach((paper, i) => {
            paper.classList.remove('is-fullscreen');
            
            // Kembalikan ke ukuran 3D asli (800x1200) dan sembunyikan scroll
            paper.style.width = '800px';
            paper.style.height = '1200px';
            paper.style.overflowY = 'hidden';
            paper.scrollTop = 0;
            
            const closeBtn = paper.querySelector('.close-btn');
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
        });
        
        // Kembalikan skala responsif 3D
        handleResize(); 
        updatePagination(); 
        
        // Reset pergerakan mouse
        targetParallaxX = 0;
        targetParallaxY = 0;
        currentParallaxX = 0;
        currentParallaxY = 0;
        
        setTimeout(() => {
            if (!isFullscreen) camera.classList.remove('snap-mode');
        }, 800);
    }

    // Navigasi Next & Prev
    btnPrev.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updatePagination();
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            updatePagination();
        }
    });

    // Efek Parallax Kursor saat mode 3D
    window.addEventListener('mousemove', (e) => {
        if (isFullscreen) return; 
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;

        targetParallaxX = y * 5; 
        targetParallaxY = x * -5; 
    });

    // Loop animasi agar pergerakan mulus
    function animate() {
        if (!isFullscreen) {
            currentParallaxX += (targetParallaxX - currentParallaxX) * 0.1;
            currentParallaxY += (targetParallaxY - currentParallaxY) * 0.1;

            const finalRotX = baseRotX + currentParallaxX;
            const finalRotZ = baseRotZ + currentParallaxY;
            
            camera.style.transform = `rotateX(${finalRotX}deg) rotateZ(${finalRotZ}deg)`;
        }
        
        requestAnimationFrame(animate);
    }
    animate();
    
    // Jam digital untuk halaman kontak
    setInterval(() => {
        const now = new Date();
        const timeEl = document.getElementById('time');
        if(timeEl) timeEl.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);
});