// Email obfuscation: the address is stored reversed + base64 and only turned
// into a mailto: link when a person interacts with the link (hover, focus,
// touch, click). Scrapers that grep the HTML or render the page without
// interacting never see a finished address.
(function() {
    var ENCODED = '=UWbuIXYnV2cAJWZ35Cd0FWb';

    function address() {
        return atob(ENCODED.split('').reverse().join(''));
    }

    function arm(link) {
        if (!link.dataset.armed) {
            link.href = 'mailto:' + address();
            link.dataset.armed = '1';
        }
    }

    document.querySelectorAll('a[data-contact]').forEach(function(link) {
        ['mouseenter', 'focus', 'touchstart'].forEach(function(evt) {
            link.addEventListener(evt, function() { arm(link); }, { passive: true });
        });
        link.addEventListener('click', function() { arm(link); });
    });
})();
