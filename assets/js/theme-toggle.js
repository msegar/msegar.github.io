// Theme toggle functionality
(function() {
    console.log('Theme toggle script loaded');
    
    function initThemeToggle() {
        console.log('Initializing theme toggle');
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        
        if (!themeToggleBtn) {
            console.error('Theme toggle button not found in the DOM');
            return;
        }
        
        console.log('Theme toggle button found:', themeToggleBtn);
        
        // Check for saved theme preference or respect OS preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        console.log('Saved theme:', savedTheme);
        console.log('Prefers dark:', prefersDark);
        
        // Apply the appropriate theme
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            console.log('Set initial theme to dark');
        } else {
            console.log('Using light theme (default)');
        }
        
        // Toggle theme when button is clicked
        themeToggleBtn.addEventListener('click', function() {
            console.log('Theme toggle button clicked');
            const currentTheme = document.documentElement.getAttribute('data-theme');
            console.log('Current theme:', currentTheme);
            
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            console.log('Switching to:', newTheme);
            
            document.documentElement.setAttribute('data-theme', newTheme === 'light' ? null : 'dark');
            localStorage.setItem('theme', newTheme);
            
            console.log('Theme switched to:', newTheme);
        });
        
        console.log('Theme toggle initialized successfully');
    }

    function initMobileNav() {
        const header = document.querySelector('header .container');
        const nav = document.querySelector('header nav');

        if (!header || !nav) {
            return;
        }

        // Guard against double-insertion (script could run more than once)
        if (header.querySelector('.nav-toggle')) {
            return;
        }

        // Create the hamburger button and place it in the header
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'nav-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '<span class="nav-toggle-icon">☰</span>';
        header.appendChild(toggleBtn);

        function closeMenu() {
            nav.classList.remove('nav-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
            nav.querySelectorAll('.dropdown.active').forEach(function(d) {
                d.classList.remove('active');
            });
        }

        // Toggle the whole mobile menu open/closed
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = nav.classList.toggle('nav-open');
            toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (!isOpen) {
                nav.querySelectorAll('.dropdown.active').forEach(function(d) {
                    d.classList.remove('active');
                });
            }
        });

        // Innovations (and any) dropdown: tap to expand inline
        nav.querySelectorAll('.dropdown > .nav-link').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                link.parentElement.classList.toggle('active');
            });
        });

        // Tapping an actual destination link closes the menu
        nav.querySelectorAll('a[href]').forEach(function(link) {
            link.addEventListener('click', function() {
                closeMenu();
            });
        });

        // Tapping outside the nav closes the menu
        document.addEventListener('click', function(e) {
            if (nav.classList.contains('nav-open') &&
                !nav.contains(e.target) &&
                !toggleBtn.contains(e.target)) {
                closeMenu();
            }
        });

        // Resizing up to desktop resets the menu state
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMenu();
            }
        });
    }

    function init() {
        initThemeToggle();
        initMobileNav();
    }

    // Run when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        console.log('Waiting for DOMContentLoaded event');
    } else {
        // DOM already loaded, run immediately
        init();
        console.log('DOM already loaded, initializing immediately');
    }
})();