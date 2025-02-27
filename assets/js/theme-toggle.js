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
    
    // Run when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeToggle);
        console.log('Waiting for DOMContentLoaded event');
    } else {
        // DOM already loaded, run immediately
        initThemeToggle();
        console.log('DOM already loaded, initializing immediately');
    }
})();