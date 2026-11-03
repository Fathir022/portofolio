// Tailwind Configuration
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'paper': '#f4f4f0',
                'bg-dark': '#2b2b2b',
                'text-dark': '#1a1a1a',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'],
                'serif': ['Playfair Display', 'serif'],
            }
        }
    }
}

// 3D Scene and UI Logic
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
    const paperWidthWithGap = 1000; // 800px width + 200px gap (represented by the left positions)
    let isFullscreen = false;

    // Base Isometric Rotation
    const baseRotX = 55;
    const baseRotZ = -35;
    
    // Mouse Parallax tracking
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    // Handle responsive scaling
    function handleResize() {
        if (isFullscreen) return; // Don't scale down in fullscreen
        const w = window.innerWidth;
        const h = window.innerHeight;
        // If screen is smaller than the paper height/width, scale it down
        let scale = 1;
        if (w < 1200) scale = 0.8;
        if (w < 900) scale = 0.6;
        if (w < 600) scale = 0.45;
        if (h < 900 && scale > 0.6) scale = 0.6;
        
        scaler.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Init

    // Setup Papers initial positions dynamically
    papers.forEach((paper, i) => {
        paper.style.left = `${i * paperWidthWithGap}px`;
        
        // Click to fullscreen
        paper.addEventListener('click', (e) => {
            if (!isFullscreen && !e.target.closest('.close-btn')) {
                enterFullscreen(i);
            }
        });
    });
    
    // Close buttons
    closeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent paper click event
            exitFullscreen();
        });
    });

    // Update Pagination
    function updatePagination() {
        // Update buttons
        btnPrev.disabled = currentPage === 0;
        btnNext.disabled = currentPage === totalPages - 1;
        pageNum.textContent = currentPage + 1;
        
        if (isFullscreen) return; // Skip updating world 3D position if fullscreen

        // Move the world container to center the active paper
        const translateX = -(currentPage * paperWidthWithGap);
        world.style.transform = `translate3d(${translateX}px, 0, 0)`;
    }

    // Init 
    updatePagination();
    
    // Fullscreen Logic
    function enterFullscreen(index) {
        isFullscreen = true;
        currentPage = index;
        
        document.body.classList.add('is-fullscreen');
        camera.classList.add('snap-mode'); // Enable smooth snapping for camera
        
        // Hide UI
        uiControls.style.opacity = '0';
        uiControls.style.pointerEvents = 'none';
        pageIndicator.style.opacity = '0';
        
        // Reset Camera & Scaler
        camera.style.transform = `rotateX(0deg) rotateZ(0deg)`;
        scaler.style.transform = `scale(1)`;
        
        // Expand Papers to viewport size
        papers.forEach((paper, i) => {
            paper.style.width = '100vw';
            paper.style.height = '100vh';
            paper.style.left = `${i * 100}vw`;
            paper.classList.add('overflow-y-auto', 'is-fullscreen');
            
            if (i === index) {
                const closeBtn = paper.querySelector('.close-btn');
                closeBtn.style.opacity = '1';
                closeBtn.style.pointerEvents = 'auto';
            }
        });
        
        // Move world to selected paper in viewport units
        world.style.transform = `translate3d(-${index * 100}vw, 0, 0)`;
        updatePagination(); // Updates pagination numbers
    }
    
    function exitFullscreen() {
        isFullscreen = false;
        document.body.classList.remove('is-fullscreen');
        camera.classList.add('snap-mode');
        
        // Show UI
        uiControls.style.opacity = '1';
        uiControls.style.pointerEvents = 'auto';
        pageIndicator.style.opacity = '1';
        
        // Restore Papers to 3D dimensions
        papers.forEach((paper, i) => {
            paper.style.width = '800px';
            paper.style.height = '1200px';
            paper.style.left = `${i * paperWidthWithGap}px`;
            paper.classList.remove('overflow-y-auto', 'is-fullscreen');
            paper.scrollTop = 0;
            
            const closeBtn = paper.querySelector('.close-btn');
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
        });
        
        handleResize(); // Restores dynamic scaling
        updatePagination(); // Restores world translation
        
        // Reset parallax targets so it doesn't jump abruptly when snap-mode is removed
        targetParallaxX = 0;
        targetParallaxY = 0;
        currentParallaxX = 0;
        currentParallaxY = 0;
        
        // Remove snap-mode after transition completes to restore linear mouse parallax
        setTimeout(() => {
            if (!isFullscreen) camera.classList.remove('snap-mode');
        }, 800);
    }

    // Button Listeners
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

    // Parallax Effect
    window.addEventListener('mousemove', (e) => {
        if (isFullscreen) return; // Disable parallax calculation in fullscreen
        // Normalize mouse position from -1 to 1
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;

        // Max rotation delta in degrees
        targetParallaxX = y * 5; 
        targetParallaxY = x * -5; 
    });

    // Animation Loop for smooth parallax
    function animate() {
        if (!isFullscreen) {
            // Lerp (Linear Interpolation) for smooth settling
            currentParallaxX += (targetParallaxX - currentParallaxX) * 0.1;
            currentParallaxY += (targetParallaxY - currentParallaxY) * 0.1;

            // Apply rotation to the camera wrapper
            const finalRotX = baseRotX + currentParallaxX;
            const finalRotZ = baseRotZ + currentParallaxY;
            
            camera.style.transform = `rotateX(${finalRotX}deg) rotateZ(${finalRotZ}deg)`;
        }
        
        requestAnimationFrame(animate);
    }
    animate();
    
    // Simple clock for the contact page
    setInterval(() => {
        const now = new Date();
        document.getElementById('time').textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);
});