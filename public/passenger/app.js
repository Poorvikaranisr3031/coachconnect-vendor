(function () {
  var API = (window.__HATCHABLE__ && window.__HATCHABLE__.api) || '/api';
  var form = document.getElementById('searchForm');
  var message = document.getElementById('searchMessage');
  var section = document.getElementById('resultsSection');
  var results = document.getElementById('results');
  var empty = document.getElementById('emptyState');
  var count = document.getElementById('resultCount');
  function say(text, type) { message.textContent = text; message.className = 'message ' + (type || ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(value) { var n = Number(value); return Number.isFinite(n) ? '₹' + (n % 1 ? n.toFixed(2) : n.toFixed(0)) : String(value == null ? '' : value); }
  var passengerReady = false;
  var locationVerified = false;
  try { locationVerified = sessionStorage.getItem('cc_passenger_location_verified') === '1'; } catch (e) {}
  Array.prototype.forEach.call(form.querySelectorAll('input,button'), function (el) { el.disabled = true; });
  say('Checking passenger sign-in…');
  fetch('/api/passenger-auth', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) { if (!response.ok) throw new Error('Please sign in to continue.'); return response.json(); }).then(function (data) {
    if (!locationVerified || !data.user) { location.replace('/passenger/login?next=%2Fpassenger%2Ftrack-train'); return; }
    passengerReady = true;
    Array.prototype.forEach.call(form.querySelectorAll('input,button'), function (el) { el.disabled = false; });
    say('Signed in. Enter your railway station and coach to search available menus.', 'success');
  }).catch(function () {
    say('Please verify your live location and sign in to search stalls and menus. Redirecting to passenger sign-in…', 'error');
    location.replace('/passenger/login?next=%2Fpassenger%2F');
  });
  form.addEventListener('submit', async function (event) {
    if (!passengerReady) { event.preventDefault(); say('Please sign in as a passenger before searching.', 'error'); return; }
    event.preventDefault();
    var station = document.getElementById('station').value.trim();
    var coach = document.getElementById('coach').value.trim().toUpperCase().replace(/\s+/g, '');
    if (!station || station.length > 150) { say('Enter a valid railway station name.', 'error'); return; }
    if (!/^[A-Z0-9-]{1,12}$/.test(coach)) { say('Enter a coach number such as S4 or B2.', 'error'); document.getElementById('coach').focus(); return; }
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Searching…'; results.innerHTML = ''; empty.classList.add('hidden'); section.classList.remove('hidden');
    document.getElementById('resultsTitle').textContent = 'Stalls serving coach ' + coach; count.textContent = 'Loading…';
    try {
      var query = '?station=' + encodeURIComponent(station) + '&coach=' + encodeURIComponent(coach);
      var response = await fetch(API + '/public/stalls' + query, { headers: { Accept: 'application/json' } });
      var data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load stalls. Please try again.');
      var stalls = Array.isArray(data.stalls) ? data.stalls : [];
      count.textContent = stalls.length + ' stall' + (stalls.length === 1 ? '' : 's');
      if (!stalls.length) { empty.classList.remove('hidden'); say('Search complete. No matching stalls are registered yet.', ''); return; }
      empty.classList.add('hidden');
      results.innerHTML = stalls.map(function (stall) {
        var menu = (stall.menu_items || []).map(function (item) {
          return '<div class="menu-item"><span>' + escapeHtml(item.name) + (item.category ? ' <span class="stall-meta">· ' + escapeHtml(item.category) + '</span>' : '') + '</span><span class="price">' + escapeHtml(money(item.price)) + '</span></div>';
        }).join('');
        var coaches = (stall.served_coaches || []).map(function (c) { return '<span class="tag">' + escapeHtml(c === 'ALL' ? 'All coaches' : c) + '</span>'; }).join('');
        return '<article class="stall"><h3>' + escapeHtml(stall.stall_name || 'Railway food stall') + '</h3><div class="stall-meta">🚉 ' + escapeHtml(stall.station || station) + ' · Platform ' + escapeHtml(stall.platform || 'Not specified') + '<br>📍 ' + escapeHtml(stall.stall_location || 'Location not specified') + '</div><div class="tag-row">' + coaches + '</div><div class="menu"><h4>Available menu</h4>' + (menu || '<p class="stall-meta">No available items listed.</p>') + '</div></article>';
      }).join('');
      say('Search complete. Showing registered stalls with available menu items.', 'success');
    } catch (error) {
      count.textContent = 'Unavailable'; empty.classList.remove('hidden');
      empty.querySelector('h3').textContent = 'Could not load stalls';
      empty.querySelector('p').textContent = error.message || 'Please try again.';
      say(error.message || 'Could not load stalls.', 'error');
    } finally { button.disabled = false; button.textContent = 'Find stalls'; }
  });
})();