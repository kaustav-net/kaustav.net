(function () {
  'use strict';

  var overlay = document.getElementById('search-overlay');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var btnOpen = document.getElementById('search-btn');
  var btnClose = document.getElementById('search-close');
  var fuse = null;
  var indexLoaded = false;

  function openSearch() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    input.value = '';
    results.innerHTML = '';
    setTimeout(function () { input.focus(); }, 50);
    if (!indexLoaded) { loadIndex(); }
  }

  function closeSearch() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    input.value = '';
    results.innerHTML = '';
  }

  function loadIndex() {
    fetch('/index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        fuse = new Fuse(data, {
          keys: [
            { name: 'title', weight: 0.35 },
            { name: 'tags', weight: 0.25 },
            { name: 'description', weight: 0.2 },
            { name: 'content', weight: 0.2 }
          ],
          includeScore: true,
          includeMatches: true,
          threshold: 0.4,
          ignoreLocation: true,
          minMatchCharLength: 2
        });
        indexLoaded = true;
      });
  }

  function doSearch() {
    var query = input.value.trim();
    if (!query || !fuse) {
      results.innerHTML = query && !fuse
        ? '<p class="search-msg">Loading index...</p>'
        : '';
      return;
    }

    var hits = fuse.search(query, { limit: 10 });

    if (hits.length === 0) {
      results.innerHTML = '<p class="search-msg">No results found for "' +
        escapeHtml(query) + '"</p>';
      return;
    }

    var html = '<ul class="search-result-list">';
    hits.forEach(function (hit) {
      var item = hit.item;
      var snippet = getSnippet(item.content, query);
      html += '<li class="search-result-item">' +
        '<a href="' + escapeHtml(item.permalink) + '">' +
        '<span class="search-result-title">' + escapeHtml(item.title) + '</span>' +
        (item.date ? '<span class="search-result-date">' + item.date + '</span>' : '') +
        '</a>' +
        (snippet ? '<p class="search-result-snippet">' + snippet + '</p>' : '') +
        (item.tags ? '<div class="search-result-tags">' +
          item.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') +
          '</div>' : '') +
        '</li>';
    });
    html += '</ul>';
    results.innerHTML = html;
  }

  function getSnippet(content, query) {
    if (!content) return '';
    var lower = content.toLowerCase();
    var terms = query.toLowerCase().split(/\s+/);
    var idx = -1;
    for (var i = 0; i < terms.length; i++) {
      idx = lower.indexOf(terms[i]);
      if (idx !== -1) break;
    }
    if (idx === -1) idx = 0;
    var start = Math.max(0, idx - 60);
    var end = Math.min(content.length, idx + 120);
    var snippet = (start > 0 ? '...' : '') +
      content.substring(start, end).replace(/\n/g, ' ') +
      (end < content.length ? '...' : '');
    // Bold the matching terms
    terms.forEach(function (term) {
      if (term.length < 2) return;
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      snippet = snippet.replace(re, '<mark>$1</mark>');
    });
    return snippet;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Event listeners
  btnOpen.addEventListener('click', openSearch);
  btnClose.addEventListener('click', closeSearch);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSearch();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('active')) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeSearch();
    }
  });

  var debounceTimer;
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 150);
  });
})();
