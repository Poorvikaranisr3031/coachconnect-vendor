const API = '/api';
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
let sessionUser = null;
let vendor = null;
let items = [];
let toastTimer = null;

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const iconFor = category => ({ Snacks:'🥪', Meals:'🍛', Beverages:'☕', Breakfast:'🥞', Desserts:'🍮', Other:'🍽️' }[category] || '🍽️');
const isAvailable = item => Boolean(item.available);

async function request(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
}

function go(page) {
  if (!['dashboard', 'menu', 'profile'].includes(page)) page = 'dashboard';
  if (page !== 'dashboard' && !sessionUser) {
    sessionStorage.setItem('afterLoginPage', page);
    location.href = '/login?next=/';
    return;
  }
  $$('.page').forEach(section => section.classList.add('hidden'));
  $('#page-' + page)?.classList.remove('hidden');
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  $('#crumb').textContent = ({ dashboard:'Overview', menu:'Menu & availability', profile:'Stall details' })[page];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
$('#today-label').textContent = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
$('#auth-button').addEventListener('click', async () => {
  if (!sessionUser) { location.href = '/login?next=/'; return; }
  if (confirm('Sign out of CoachConnect?')) {
    try {
      await fetch('/api/password-auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      if (window.hatchable?.auth?.signOut) await window.hatchable.auth.signOut();
    } finally { location.reload(); }
  }
});
$('#gate-signin').addEventListener('click', () => location.href = '/login?next=/');

async function init() {
  try {
    const response = await fetch('/api/password-auth', { credentials: 'same-origin' });
    const session = await response.json();
    sessionUser = session?.user || null;
  } catch (error) {
    sessionUser = null;
  }
  $('#auth-button').textContent = sessionUser ? 'Sign out' : 'Vendor sign in';
  $('#account-state').textContent = sessionUser ? (sessionUser.email || 'Signed in') : 'Sign in to edit your stall';
  $('#vendor-gate').classList.toggle('hidden', Boolean(sessionUser));
  if (!sessionUser) return;
  await loadVendor();
  await loadMenu();
  const next = sessionStorage.getItem('afterLoginPage');
  if (next) {
    sessionStorage.removeItem('afterLoginPage');
    go(next);
  }
}

async function loadVendor() {
  try {
    vendor = await request('/vendor');
    const fields = {
      'stall-name': vendor?.stall_name || '',
      station: vendor?.station || '',
      platform: vendor?.platform || '',
      location: vendor?.stall_location || '',
      'served-coaches': vendor?.served_coaches || '',
      contact: vendor?.contact_name || '',
      'contact-phone': vendor?.contact_phone || ''
    };
    Object.entries(fields).forEach(([id, value]) => { $('#' + id).value = value; });
    renderProfile();
    renderStats();
    renderSetupChecklist();
  } catch (error) {
    toast(error.message);
  }
}

$('#stall-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!sessionUser) return;
  const button = $('#save-profile');
  button.disabled = true;
  $('#profile-message').textContent = 'Saving…';
  const body = {
    stall_name: $('#stall-name').value.trim(),
    station: $('#station').value.trim(),
    platform: $('#platform').value.trim(),
    stall_location: $('#location').value.trim(),
    served_coaches: $('#served-coaches').value.trim(),
    contact_name: $('#contact').value.trim(),
    contact_phone: $('#contact-phone').value.trim()
  };
  try {
    vendor = await request('/vendor', 'PUT', body);
    $('#served-coaches').value = vendor.served_coaches || '';
    renderProfile();
    renderStats();
    $('#profile-message').textContent = 'Stall details saved successfully.';
    toast('Stall details saved.');
  } catch (error) {
    $('#profile-message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function coachList() {
  return String(vendor?.served_coaches || '').split(/[\n,;]+/).map(value => value.trim().toUpperCase()).filter(Boolean);
}

function renderProfile() {
  const element = $('#profile-summary');
  if (!vendor) {
    element.innerHTML = '<div class="empty-inline">Save your stall name, station and coach coverage in Stall details to get started.</div>';
    return;
  }
  const coaches = coachList();
  element.innerHTML = '<div class="profile-title">' + esc(vendor.stall_name) + '</div>' +
    '<div class="profile-detail">⌖ ' + esc(vendor.station) + (vendor.platform ? ' · ' + esc(vendor.platform) : '') + '</div>' +
    (vendor.stall_location ? '<div class="profile-detail">' + esc(vendor.stall_location) + '</div>' : '') +
    '<div class="coach-chip-list">' + (coaches.length ? coaches.map(coach => '<span class="coach-chip">' + esc(coach) + '</span>').join('') : '<span class="muted">Coach coverage not set</span>') + '</div>' +
    (vendor.contact_name ? '<div class="profile-detail">Contact: ' + esc(vendor.contact_name) + '</div>' : '') +
    '<span class="profile-chip">✓ Profile saved</span>';
}

async function loadMenu() {
  try {
    items = await request('/menu');
    renderMenu();
    renderStats();
    renderReadiness();
    renderSetupChecklist();
  } catch (error) {
    if (!String(error.message).includes('401')) toast(error.message);
  }
}

function renderStats() {
  if (!sessionUser) return;
  const available = items.filter(isAvailable).length;
  $('#stat-items').textContent = items.length;
  $('#stat-available').textContent = available;
  $('#stat-unavailable').textContent = items.length - available;
  const coaches = coachList();
  $('#stat-coaches').textContent = coaches.length ? (coaches.includes('ALL') ? 'All coaches' : coaches.length + (coaches.length === 1 ? ' coach' : ' coaches')) : 'Not set';
  renderSetupChecklist();
}

function renderSetupChecklist() {
  const signedIn = Boolean(sessionUser);
  const profileReady = Boolean(vendor?.stall_name && vendor?.station && coachList().length);
  const menuReady = items.length > 0;
  const availableReady = items.some(isAvailable);
  const steps = [
    { done: profileReady, title: 'Add stall details', detail: 'Stall name, station and coaches served', page: 'profile' },
    { done: menuReady, title: 'Create your menu', detail: 'Add the items and prices you offer', page: 'menu' },
    { done: availableReady, title: 'Mark items available', detail: 'Passengers only see items marked available', page: 'menu' }
  ];
  const count = steps.filter(step => step.done).length;
  $('#setup-count').textContent = count + ' of ' + steps.length + ' complete';
  $('#setup-checklist').innerHTML = steps.map(step => '<button type="button" class="setup-step" data-page="' + step.page + '"><span class="setup-check ' + (step.done ? 'is-done' : '') + '">' + (step.done ? '✓' : '·') + '</span><span class="setup-step-copy"><strong>' + step.title + '</strong><small>' + step.detail + '</small></span><span class="setup-step-status ' + (step.done ? 'is-done' : '') + '">' + (step.done ? 'Complete' : 'Finish setup') + ' →</span></button>').join('');
  if (!signedIn) $('#setup-checklist').innerHTML = '<div class="empty-inline">Sign in to check your setup progress.</div>';
}

function renderReadiness() {
  const available = items.filter(isAvailable).length;
  const unavailable = items.length - available;
  $('#menu-readiness').innerHTML =
    '<div class="readiness-row"><span class="readiness-dot ready"></span><div><strong>' + available + ' available item' + (available === 1 ? '' : 's') + '</strong><small>Visible to passengers</small></div></div>' +
    '<div class="readiness-row"><span class="readiness-dot paused"></span><div><strong>' + unavailable + ' unavailable item' + (unavailable === 1 ? '' : 's') + '</strong><small>Hidden until you switch them on</small></div></div>' +
    (!vendor ? '<p class="muted readiness-note">Complete your stall details to finish setting up your listing.</p>' : '');
}

function renderMenu() {
  const query = ($('#menu-search').value || '').trim().toLowerCase();
  const filter = $('#menu-filter').value;
  const shown = items.filter(item => {
    const matchesQuery = !query || [item.name, item.category, item.description].some(value => String(value || '').toLowerCase().includes(query));
    const matchesFilter = filter === 'all' || (filter === 'available' && isAvailable(item)) ||
      (filter === 'unavailable' && !isAvailable(item));
    return matchesQuery && matchesFilter;
  });
  $('#menu-rows').innerHTML = shown.map(item => {
    const available = isAvailable(item);
    return '<tr><td><div class="item-cell"><span class="item-avatar">' + iconFor(item.category) + '</span><div><strong>' + esc(item.name) + '</strong><small>' + esc(item.description || 'No description') + '</small></div></div></td>' +
      '<td><span class="category-pill">' + esc(item.category) + '</span></td><td><strong>' + money(item.price) + '</strong></td>' +
      '<td><button class="availability-toggle ' + (available ? 'is-available' : 'is-unavailable') + '" type="button" data-toggle="' + esc(item.id) + '" aria-label="Toggle availability for ' + esc(item.name) + '">' + (available ? '● Available' : '○ Unavailable') + '</button></td>' +
      '<td><div class="row-actions"><button class="icon-action" type="button" data-edit="' + esc(item.id) + '">Edit</button><button class="icon-action delete" type="button" data-delete="' + esc(item.id) + '">Delete</button></div></td></tr>';
  }).join('');
  $('#menu-empty').classList.toggle('hidden', shown.length > 0);
  $('#stat-items').textContent = items.length;
}

$('#menu-search').addEventListener('input', renderMenu);
$('#menu-filter').addEventListener('change', renderMenu);
$('#add-item').addEventListener('click', () => openItemModal());
$('#close-modal').addEventListener('click', closeItemModal);
$('#cancel-modal').addEventListener('click', closeItemModal);
$('#item-modal').addEventListener('click', event => { if (event.target.id === 'item-modal') closeItemModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeItemModal(); });

function openItemModal(item) {
  if (!sessionUser) { go('menu'); return; }
  if (!vendor) { go('profile'); toast('Save your stall details first.'); return; }
  $('#item-form').reset();
  $('#edit-id').value = item?.id || '';
  $('#edit-name').value = item?.name || '';
  $('#edit-description').value = item?.description || '';
  $('#edit-category').value = item?.category || 'Snacks';
  $('#edit-price').value = item?.price ?? '';
  // Stock counts are intentionally not part of the vendor workflow.
  $('#edit-available').checked = item ? Boolean(item.available) : true;
  $('#modal-title').textContent = item ? 'Edit menu item' : 'Add menu item';
  $('#save-item').textContent = item ? 'Save changes' : 'Add item';
  $('#item-message').textContent = '';
  $('#item-modal').classList.remove('hidden');
  $('#edit-name').focus();
}
function closeItemModal() { $('#item-modal').classList.add('hidden'); }

$('#item-form').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#edit-id').value;
  const button = $('#save-item');
  button.disabled = true;
  const body = {
    name: $('#edit-name').value.trim(),
    description: $('#edit-description').value.trim(),
    category: $('#edit-category').value,
    price: Number($('#edit-price').value),
    available: $('#edit-available').checked
  };
  if (!body.name || !Number.isFinite(body.price) || body.price < 0) {
    $('#item-message').textContent = 'Enter an item name and a valid non-negative price.';
    button.disabled = false;
    return;
  }
  try {
    const saved = await request('/menu', id ? 'PUT' : 'POST', { ...body, ...(id ? { id } : {}) });
    if (id) items = items.map(item => item.id === id ? saved : item);
    else items.unshift(saved);
    closeItemModal();
    renderMenu();
    renderStats();
    renderReadiness();
    toast(id ? 'Menu item updated.' : 'Menu item added.');
  } catch (error) {
    $('#item-message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]');
  const remove = event.target.closest('[data-delete]');
  const toggle = event.target.closest('[data-toggle]');
  if (edit) {
    const item = items.find(entry => entry.id === edit.dataset.edit);
    if (item) openItemModal(item);
  }
  if (remove) {
    const item = items.find(entry => entry.id === remove.dataset.delete);
    if (item && confirm('Delete "' + item.name + '" from your menu?')) {
      remove.disabled = true;
      try {
        await request('/menu', 'DELETE', { id: item.id });
        items = items.filter(entry => entry.id !== item.id);
        renderMenu(); renderStats(); renderReadiness(); renderSetupChecklist();
        toast('Menu item deleted.');
      } catch (error) { toast(error.message); }
      finally { remove.disabled = false; }
    }
  }
  if (toggle) {
    const item = items.find(entry => entry.id === toggle.dataset.toggle);
    if (!item) return;
    // Availability is controlled only by the vendor's toggle.
    toggle.disabled = true;
    try {
      const updated = await request('/menu', 'PUT', { ...item, available: !isAvailable(item) });
      items = items.map(entry => entry.id === item.id ? updated : entry);
      renderMenu(); renderStats(); renderReadiness(); renderSetupChecklist();
      toast(isAvailable(updated) ? 'Item marked available.' : 'Item marked unavailable.');
    } catch (error) { toast(error.message); }
    finally { toggle.disabled = false; }
  }
});

init();