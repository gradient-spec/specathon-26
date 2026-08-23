/**
 * font-loader.js
 * Promotes the Google Fonts stylesheet from media="print" to media="all"
 * once the page has loaded, replicating the previous inline onload="this.media='all'"
 * handler in a CSP-safe external script.
 */
(function () {
  var sheet = document.getElementById('google-fonts-sheet');
  if (!sheet) return;
  if (sheet.addEventListener) {
    sheet.addEventListener('load', function () { sheet.media = 'all'; });
  }
  // Fallback: if the link is already loaded (cached), set immediately.
  if (sheet.sheet) { sheet.media = 'all'; }
})();
