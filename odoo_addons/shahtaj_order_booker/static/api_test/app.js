/* Shahtaj order booker API explorer — mirrors Odoo booker flow for Flutter devs */
(function () {
  const STORAGE_KEY = 'shahtaj_api_test_v2';

  const ENDPOINT_CATALOG = [
    {
      path: '/api/shahtaj/v1/auth/login',
      auth: false,
      params: [
        { name: 'database', required: true, type: 'string' },
        { name: 'login', required: true, type: 'string' },
        { name: 'password', required: true, type: 'string' },
      ],
    },
    {
      path: '/api/shahtaj/v1/auth/me',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/tasks/today',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/tasks/check-in',
      auth: true,
      params: [
        { name: 'task_id', required: true, type: 'int' },
        { name: 'latitude', required: true, type: 'float' },
        { name: 'longitude', required: true, type: 'float' },
      ],
    },
    {
      path: '/api/shahtaj/v1/tasks/skip',
      auth: true,
      params: [{ name: 'task_id', required: true, type: 'int' }],
    },
    {
      path: '/api/shahtaj/v1/tasks/notes',
      auth: true,
      params: [
        { name: 'task_id', required: true, type: 'int' },
        { name: 'notes', required: false, type: 'string' },
      ],
    },
    {
      path: '/api/shahtaj/v1/visits/active',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/visits/mine',
      auth: true,
      params: [{ name: 'limit', required: false, type: 'int', default: '50' }],
    },
    {
      path: '/api/shahtaj/v1/visits/get',
      auth: true,
      params: [{ name: 'visit_id', required: true, type: 'int' }],
    },
    {
      path: '/api/shahtaj/v1/visits/line/add',
      auth: true,
      params: [
        { name: 'visit_id', required: true, type: 'int' },
        { name: 'product_id', required: true, type: 'int' },
        { name: 'quantity', required: false, type: 'float', default: '1' },
      ],
    },
    {
      path: '/api/shahtaj/v1/visits/line/update',
      auth: true,
      params: [
        { name: 'line_id', required: true, type: 'int' },
        { name: 'quantity', required: false, type: 'float' },
        { name: 'price_unit', required: false, type: 'float' },
      ],
    },
    {
      path: '/api/shahtaj/v1/visits/line/remove',
      auth: true,
      params: [{ name: 'line_id', required: true, type: 'int' }],
    },
    {
      path: '/api/shahtaj/v1/visits/place-order',
      auth: true,
      params: [{ name: 'visit_id', required: true, type: 'int' }],
    },
    {
      path: '/api/shahtaj/v1/visits/end-without-order',
      auth: true,
      params: [{ name: 'visit_id', required: true, type: 'int' }],
    },
    {
      path: '/api/shahtaj/v1/visits/notes',
      auth: true,
      params: [
        { name: 'visit_id', required: true, type: 'int' },
        { name: 'notes', required: false, type: 'string' },
      ],
    },
    {
      path: '/api/shahtaj/v1/products/list',
      auth: true,
      params: [
        { name: 'visit_id', required: false, type: 'int', note: 'Adjusts qty_bookable for active visit cart' },
        { name: 'limit', required: false, type: 'int', default: '500' },
        { name: 'offset', required: false, type: 'int', default: '0' },
      ],
    },
    {
      path: '/api/shahtaj/v1/schedule/weekly',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/targets/mine',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/shops/register',
      auth: true,
      params: [
        { name: 'name', required: true, type: 'string' },
        { name: 'owner_name', required: true, type: 'string' },
        { name: 'owner_phone', required: true, type: 'string' },
        { name: 'latitude', required: true, type: 'float' },
        { name: 'longitude', required: true, type: 'float' },
        { name: 'zone_id', required: false, type: 'int' },
        { name: 'route_id', required: false, type: 'int' },
        { name: 'credit_limit', required: false, type: 'float' },
        { name: 'legacy_balance', required: false, type: 'float' },
        { name: 'owner_cnic_front', required: false, type: 'base64' },
        { name: 'owner_cnic_back', required: false, type: 'base64' },
        { name: 'owner_photo', required: false, type: 'base64' },
        { name: 'shop_exterior_photo', required: false, type: 'base64' },
      ],
    },
    {
      path: '/api/shahtaj/v1/shops/mine',
      auth: true,
      params: [],
    },
    {
      path: '/api/shahtaj/v1/shops/get',
      auth: true,
      params: [
        { name: 'shop_id', required: true, type: 'int' },
        { name: 'include_photos', required: false, type: 'bool', default: 'true' },
      ],
    },
  ];

  const state = {
    apiKey: null,
    database: null,
    user: null,
    onlineStatus: null,
    tasks: [],
    selectedTask: null,
    visit: null,
    lastCompletedVisit: null,
    products: [],
  };

  const $ = (id) => document.getElementById(id);

  const IMAGE_FIELD_RE = /photo|cnic|image/i;

  function sanitizeBodyForLog(body) {
    if (!body || typeof body !== 'object') return body || {};
    const out = {};
    Object.entries(body).forEach(([key, value]) => {
      if (typeof value === 'string' && (IMAGE_FIELD_RE.test(key) || value.startsWith('data:image'))) {
        out[key] = `<base64 image, ${value.length} chars>`;
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function catalogForPath(path) {
    return ENDPOINT_CATALOG.find((e) => e.path === path);
  }

  function logEntry(path, body, result) {
    const el = $('api-log');
    const time = new Date().toLocaleTimeString();
    const catalog = catalogForPath(path);
    const wrap = document.createElement('div');
    wrap.className = `log-entry ${result.kind}`;

    let html = `<div class="log-time">[${time}] POST ${path}</div>`;
    html += `<div class="log-meta">Auth: ${path.includes('/auth/login') ? 'none (login)' : 'Bearer token'}</div>`;

    if (catalog && catalog.params.length) {
      html += '<div class="log-section-title">Expected params</div><ul class="log-params">';
      catalog.params.forEach((p) => {
        const req = p.required ? 'required' : 'optional';
        const def = p.default ? `, default ${p.default}` : '';
        html += `<li><code>${p.name}</code> <span class="muted">(${req}, ${p.type}${def})</span></li>`;
      });
      html += '</ul>';
    } else if (catalog) {
      html += '<div class="log-meta muted">No body params — Bearer token only</div>';
    }

    html += '<div class="log-section-title">Request body</div>';
    html += `<pre class="log-json">${escapeHtml(JSON.stringify(sanitizeBodyForLog(body || {}), null, 2))}</pre>`;

    html += `<div class="log-section-title">${result.kind === 'ok' ? 'Response' : 'Error'}</div>`;
    html += `<pre class="log-json">${escapeHtml(JSON.stringify(result.data, null, 2))}</pre>`;

    wrap.innerHTML = html;
    el.prepend(wrap);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderEndpointReference() {
    const el = $('endpoint-reference');
    let html = '<h3>Endpoint reference (all POST, JSON body)</h3>';
    html += '<p class="hint">Every call except <code>auth/login</code> needs <code>Authorization: Bearer &lt;api_key&gt;</code>.</p>';
    html += '<table class="ref-table"><thead><tr><th>Endpoint</th><th>Auth</th><th>Body params</th></tr></thead><tbody>';
    ENDPOINT_CATALOG.forEach((ep) => {
      const params = ep.params.length
        ? ep.params.map((p) => {
            const mark = p.required ? '*' : '';
            const def = p.default ? ` = ${p.default}` : '';
            return `<code>${p.name}${mark}</code> (${p.type}${def})`;
          }).join('<br/>')
        : '<span class="muted">{} empty</span>';
      html += `<tr>
        <td><code>${ep.path}</code></td>
        <td>${ep.auth ? 'Bearer' : '—'}</td>
        <td>${params}</td>
      </tr>`;
    });
    html += '</tbody></table><p class="hint">* = required</p>';
    el.innerHTML = html;
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      apiKey: state.apiKey,
      database: state.database,
      user: state.user,
    }));
  }

  function showApp() {
    $('screen-login').classList.add('hidden');
    $('screen-app').classList.remove('hidden');
    $('header-user').classList.remove('hidden');
    const userLabel = state.user
      ? `${state.user.name} (${state.user.login})`
      : 'Connected';
    $('session-user').textContent = userLabel;
    const pill = $('session-status');
    if (state.onlineStatus) {
      pill.textContent = state.onlineStatus;
      pill.className = `status-pill status-${state.onlineStatus}`;
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  }

  function showLogin() {
    $('screen-login').classList.remove('hidden');
    $('screen-app').classList.add('hidden');
    $('header-user').classList.add('hidden');
  }

  function clearSession() {
    state.apiKey = null;
    state.user = null;
    state.onlineStatus = null;
    state.tasks = [];
    state.selectedTask = null;
    state.visit = null;
    state.lastCompletedVisit = null;
    localStorage.removeItem(STORAGE_KEY);
    showLogin();
    $('login-status').textContent = 'Logged out.';
    $('login-status').className = 'status';
  }

  async function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.apiKey) headers.Authorization = `Bearer ${state.apiKey}`;
    if (state.database) headers['X-Odoo-Database'] = state.database;

    const requestBody = body || {};

    let res;
    try {
      res = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        credentials: 'omit',
      });
    } catch (e) {
      logEntry(path, requestBody, { kind: 'err', data: { message: e.message } });
      throw new Error(
        'Cannot reach server. Is Odoo running on this host? (' + e.message + ')'
      );
    }

    let payload;
    const text = await res.text();
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (e) {
      payload = { message: text };
    }

    if (!res.ok) {
      logEntry(path, requestBody, { kind: 'err', data: payload });
      throw new Error(payload.message || payload.name || res.statusText);
    }

    const data = payload.data !== undefined ? payload.data : payload;
    logEntry(path, requestBody, { kind: 'ok', data });
    return data;
  }

  /* ── Tabs ── */
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
      onTabShow(btn.dataset.tab);
    });
  });

  async function onTabShow(tab) {
    if (!state.apiKey) return;
    if (tab === 'tasks') await loadTasks();
    if (tab === 'visit') await loadActiveVisit();
    if (tab === 'history') await loadVisitHistory();
    if (tab === 'schedule') await loadSchedule();
    if (tab === 'targets') await loadTargets();
    if (tab === 'shops') await loadMyShops();
  }

  function switchTab(name) {
    const btn = document.querySelector(`.tab[data-tab="${name}"]`);
    if (btn) btn.click();
  }

  /* ── Tasks ── */
  async function loadTasks() {
    const data = await api('/api/shahtaj/v1/tasks/today');
    state.tasks = data.tasks || [];
    $('tasks-date').textContent = `Date: ${data.date} · ${state.tasks.length} task(s)`;
    renderTaskCards();
    return data;
  }

  function renderTaskCards() {
    const container = $('task-cards');
    container.innerHTML = '';
    if (!state.tasks.length) {
      container.innerHTML = '<p class="hint">No tasks for today. Ask distributor to set weekly schedule.</p>';
      return;
    }
    state.tasks.forEach((task) => {
      const card = document.createElement('div');
      card.className = 'task-card' + (
        state.selectedTask && state.selectedTask.id === task.id ? ' selected' : ''
      );
      const shop = task.shop || {};
      const duration = task.visit_duration_minutes
        ? `${task.visit_duration_minutes} min`
        : '';
      card.innerHTML = `
        <span class="badge ${task.state}">${task.state.replace('_', ' ')}</span>
        <h4>${shop.name || 'Shop'}</h4>
        <p class="hint">${task.route ? task.route.name : ''} · ${task.zone ? task.zone.name : ''}</p>
        ${shop.latitude ? `<p class="hint">GPS: ${shop.latitude}, ${shop.longitude}</p>` : ''}
        ${duration ? `<p class="hint">Visit: ${duration}</p>` : ''}
        ${task.visit_id ? '<p class="hint">Has active/completed visit</p>' : ''}
      `;
      card.onclick = () => selectTask(task);
      container.appendChild(card);
    });
  }

  function selectTask(task) {
    state.selectedTask = task;
    renderTaskCards();
    const shop = task.shop || {};
    $('checkin-panel').classList.remove('hidden');
    $('selected-task-label').textContent = `Selected: ${shop.name || 'Shop'} (task #${task.id})`;
    $('shop-gps-box').textContent = shop.latitude
      ? `Shop GPS: ${shop.latitude}, ${shop.longitude} — must be within 100 m to check in`
      : 'Shop has no GPS — ask distributor.';
    if (shop.latitude) {
      $('inp-lat').value = shop.latitude;
      $('inp-lng').value = shop.longitude;
    }
    $('inp-task-notes').value = task.notes || '';

    const canAct = !['completed', 'cancelled', 'skipped'].includes(task.state);
    const hasVisit = !!task.visit_id;
    $('btn-checkin').classList.toggle('hidden', !canAct || hasVisit);
    $('btn-continue-visit').classList.toggle('hidden', !canAct || !hasVisit);
    $('btn-skip-task').classList.toggle('hidden', !canAct || hasVisit);
    $('btn-checkin').disabled = task.state === 'completed';
  }

  /* ── Visit ── */
  async function loadActiveVisit() {
    const data = await api('/api/shahtaj/v1/visits/active');
    state.visit = data.visit;
    renderVisit();
    return data;
  }

  function renderVisit() {
    const visit = state.visit;
    $('visit-completed').classList.add('hidden');

    if (!visit || visit.state !== 'in_progress') {
      $('visit-empty').classList.remove('hidden');
      $('visit-content').classList.add('hidden');
      if (state.lastCompletedVisit) {
        showCompletedVisit(state.lastCompletedVisit);
      }
      return;
    }

    $('visit-empty').classList.add('hidden');
    $('visit-content').classList.remove('hidden');

    const shop = visit.shop || {};
    $('visit-summary').innerHTML = `
      <dl>
        <dt>Shop</dt><dd>${shop.name || '—'}</dd>
        <dt>Status</dt><dd>${visit.state} / ${visit.outcome}</dd>
        <dt>Started</dt><dd>${visit.started_at || '—'}</dd>
        <dt>Elapsed</dt><dd>${visit.duration_minutes != null ? visit.duration_minutes + ' min' : '—'}</dd>
        <dt>Check-in distance</dt><dd>${visit.check_in_distance_m != null ? visit.check_in_distance_m + ' m' : '—'}</dd>
        <dt>Visit ID</dt><dd>${visit.id}</dd>
      </dl>
    `;
    $('inp-visit-notes').value = visit.notes || '';

    const tbody = $('visit-lines-table').querySelector('tbody');
    tbody.innerHTML = '';
    (visit.lines || []).forEach((line) => {
      const tr = document.createElement('tr');
      const prod = line.product || {};
      tr.innerHTML = `
        <td>${prod.name || '?'}</td>
        <td><input type="number" step="any" min="0.01" class="line-qty" value="${line.quantity}" style="width:5rem"/></td>
        <td><input type="number" step="any" min="0" class="line-price" value="${line.price_unit}" style="width:6rem"/></td>
        <td>${line.subtotal}</td>
        <td class="line-actions">
          <button class="secondary sm btn-update-line">Update</button>
          <button class="ghost sm btn-remove-line">Remove</button>
        </td>
      `;
      tr.querySelector('.btn-update-line').onclick = async (e) => {
        e.stopPropagation();
        try {
          await api('/api/shahtaj/v1/visits/line/update', {
            line_id: line.id,
            quantity: parseFloat(tr.querySelector('.line-qty').value),
            price_unit: parseFloat(tr.querySelector('.line-price').value),
          });
          await loadActiveVisit();
        } catch (err) {
          alert(err.message);
        }
      };
      tr.querySelector('.btn-remove-line').onclick = async (e) => {
        e.stopPropagation();
        try {
          await api('/api/shahtaj/v1/visits/line/remove', { line_id: line.id });
          await loadActiveVisit();
        } catch (err) {
          alert(err.message);
        }
      };
      tbody.appendChild(tr);
    });
    loadProductList().catch(() => {});
  }

  async function loadProductList() {
    if (!state.visit || state.visit.state !== 'in_progress') {
      state.products = [];
      $('product-cards').innerHTML = '';
      $('products-meta').textContent = '';
      return null;
    }
    const data = await api('/api/shahtaj/v1/products/list', {
      visit_id: state.visit.id,
      limit: 500,
      offset: 0,
    });
    state.products = data.products || [];
    $('products-meta').textContent = `${state.products.length} of ${data.total} product(s) loaded`;
    renderProductCards();
    return data;
  }

  function renderProductCards() {
    const container = $('product-cards');
    container.innerHTML = '';
    const filter = ($('inp-product-filter').value || '').toLowerCase().trim();
    const addQty = parseFloat($('inp-add-qty').value) || 1;
    const list = filter
      ? state.products.filter((p) => p.name.toLowerCase().includes(filter))
      : state.products;

    if (!list.length) {
      container.innerHTML = '<p class="hint">No products to show. Load the list or ask distributor to add products.</p>';
      return;
    }

    list.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      const avail = p.qty_unlimited ? '∞' : (p.qty_bookable ?? '?');
      const outOfStock = !p.qty_unlimited && (p.qty_bookable === 0 || p.qty_bookable === false);
      if (outOfStock) card.classList.add('out-of-stock');
      card.innerHTML = `
        <h4>${p.name}</h4>
        <p class="hint">Rs ${p.list_price} · Avail: ${avail} ${p.uom || ''}</p>
        <p class="hint">ID: ${p.id}</p>
        ${outOfStock ? '<p class="hint warn">Out of stock</p>' : '<p class="hint">Tap to add</p>'}
      `;
      if (!outOfStock) {
        card.onclick = async () => {
          document.querySelectorAll('.product-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          try {
            await api('/api/shahtaj/v1/visits/line/add', {
              visit_id: state.visit.id,
              product_id: p.id,
              quantity: addQty,
            });
            await loadActiveVisit();
          } catch (err) {
            alert(err.message);
          }
        };
      }
      container.appendChild(card);
    });
  }

  function showCompletedVisit(visit) {
    $('visit-empty').classList.add('hidden');
    $('visit-content').classList.add('hidden');
    $('visit-completed').classList.remove('hidden');
    $('visit-completed-body').innerHTML = `
      <p><strong>${visit.shop ? visit.shop.name : 'Shop'}</strong></p>
      <p class="hint">Outcome: ${visit.outcome} · ${visit.duration_minutes || 0} min</p>
      ${visit.sale_order_name ? `<p>Order: ${visit.sale_order_name} — Rs ${visit.order_amount}</p>` : ''}
    `;
  }

  async function loadVisitHistory() {
    const data = await api('/api/shahtaj/v1/visits/mine', { limit: 50 });
    const el = $('history-list');
    el.innerHTML = '';
    (data.visits || []).forEach((v) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'default';
      const shop = v.shop || {};
      card.innerHTML = `
        <span class="badge ${v.state}">${v.state}</span>
        <span class="badge ${v.outcome}">${v.outcome}</span>
        <h4>${shop.name || 'Shop'}</h4>
        <p class="hint">${v.started_at || '—'} · ${v.duration_minutes || 0} min</p>
        ${v.sale_order_name ? `<p class="hint">Order: ${v.sale_order_name} (Rs ${v.order_amount})</p>` : ''}
        <button type="button" class="secondary sm btn-open-visit">Open (visits/get)</button>
      `;
      card.querySelector('.btn-open-visit').onclick = async () => {
        try {
          const detail = await api('/api/shahtaj/v1/visits/get', { visit_id: v.id });
          alert(JSON.stringify(detail.visit, null, 2));
        } catch (err) {
          alert(err.message);
        }
      };
      el.appendChild(card);
    });
    if (!data.visits.length) el.innerHTML = '<p class="hint">No visits yet.</p>';
  }

  /* ── Schedule / targets / shops ── */
  async function loadSchedule() {
    const data = await api('/api/shahtaj/v1/schedule/weekly');
    const el = $('schedule-list');
    el.innerHTML = '';
    (data.schedules || []).forEach((s) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'default';
      card.innerHTML = `
        <h4>${s.day_label} — ${s.route ? s.route.name : ''}</h4>
        <p class="hint">${s.zone ? s.zone.name : ''} · ${s.shop_count} shops</p>
        <p class="hint">This week: ${s.week_tasks_completed}/${s.week_tasks_planned} done (${Math.round(s.week_tasks_progress || 0)}%)</p>
      `;
      el.appendChild(card);
    });
    if (!data.schedules.length) el.innerHTML = '<p class="hint">No schedule lines assigned.</p>';
  }

  async function loadTargets() {
    const data = await api('/api/shahtaj/v1/targets/mine');
    const el = $('targets-list');
    el.innerHTML = '';
    (data.targets || []).forEach((t) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'default';
      const product = t.product ? ` · ${t.product.name}` : '';
      card.innerHTML = `
        <h4>${t.name}</h4>
        <p class="hint">${t.target_type}${product}</p>
        <p class="hint">${t.date_start} → ${t.date_end}</p>
        <p><strong>${t.achieved_value}</strong> / ${t.target_value} (${Math.round(t.progress_percent || 0)}%)</p>
      `;
      el.appendChild(card);
    });
    if (!data.targets.length) el.innerHTML = '<p class="hint">No active targets.</p>';
  }

  function renderShopPhotos(shop) {
    const panel = $('shop-detail-panel');
    const grid = $('shop-detail-photos');
    $('shop-detail-title').textContent = shop.name;
    grid.innerHTML = '';
    const photos = shop.photo_data || {};
    const labels = {
      owner_cnic_front: 'CNIC front',
      owner_cnic_back: 'CNIC back',
      owner_photo: 'Owner',
      shop_exterior_photo: 'Exterior',
    };
    let any = false;
    Object.entries(labels).forEach(([key, label]) => {
      if (!photos[key]) return;
      any = true;
      const wrap = document.createElement('div');
      wrap.innerHTML = `<p class="hint">${label}</p><img class="photo-preview" src="data:image/jpeg;base64,${photos[key]}" alt="${label}"/>`;
      grid.appendChild(wrap);
    });
    panel.classList.toggle('hidden', !any);
  }

  async function loadMyShops() {
    const data = await api('/api/shahtaj/v1/shops/mine');
    const el = $('shops-list');
    el.innerHTML = '';
    (data.shops || []).forEach((s) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'default';
      const photos = s.photos || {};
      const photoCount = Object.values(photos).filter(Boolean).length;
      card.innerHTML = `
        <h4>${s.name}</h4>
        <p class="hint">${s.owner_name} · ${s.owner_phone}</p>
        <span class="badge ${s.approval_state}">${s.approval_state}</span>
        <p class="hint">${photoCount} photo(s) on file</p>
        <div class="shop-card-actions">
          <button type="button" class="secondary sm btn-view-shop">View photos (shops/get)</button>
        </div>
      `;
      card.querySelector('.btn-view-shop').onclick = async () => {
        try {
          const detail = await api('/api/shahtaj/v1/shops/get', {
            shop_id: s.id,
            include_photos: true,
          });
          renderShopPhotos(detail.shop);
        } catch (err) {
          alert(err.message);
        }
      };
      el.appendChild(card);
    });
    if (!data.shops.length) el.innerHTML = '<p class="hint">No shops registered yet.</p>';
  }

  function readFileAsDataUrl(inputId) {
    const input = $(inputId);
    const file = input && input.files && input.files[0];
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  function setupPhotoPreviews() {
    document.querySelectorAll('input[type="file"][data-preview]').forEach((input) => {
      input.addEventListener('change', () => {
        const preview = $(input.dataset.preview);
        const file = input.files[0];
        if (!file || !preview) return;
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
      });
    });
  }

  async function refreshMe() {
    const data = await api('/api/shahtaj/v1/auth/me');
    state.user = data.user;
    state.onlineStatus = data.online_status;
    showApp();
  }

  async function afterLogin() {
    await refreshMe();
    showApp();
    await loadTasks();
    await loadActiveVisit();
    switchTab('tasks');
  }

  /* ── Event handlers ── */
  $('btn-login').onclick = async () => {
    const database = $('inp-database').value.trim();
    const login = $('inp-login').value.trim();
    const password = $('inp-password').value;
    $('login-status').className = 'status';
    try {
      const data = await api('/api/shahtaj/v1/auth/login', { database, login, password });
      state.apiKey = data.api_key;
      state.database = data.database;
      state.user = data.user;
      saveSession();
      $('login-status').textContent = 'Login OK.';
      $('login-status').className = 'status ok';
      await afterLogin();
    } catch (e) {
      $('login-status').textContent = e.message;
      $('login-status').className = 'status err';
    }
  };

  $('btn-logout').onclick = clearSession;
  $('btn-refresh-tasks').onclick = () => loadTasks().catch(alertErr);
  $('btn-refresh-visit').onclick = () => loadActiveVisit().catch(alertErr);
  $('btn-refresh-history').onclick = () => loadVisitHistory().catch(alertErr);
  $('btn-refresh-schedule').onclick = () => loadSchedule().catch(alertErr);
  $('btn-refresh-targets').onclick = () => loadTargets().catch(alertErr);
  $('btn-refresh-shops').onclick = () => loadMyShops().catch(alertErr);
  $('btn-clear-log').onclick = () => { $('api-log').innerHTML = ''; };

  $('btn-use-shop-gps').onclick = () => {
    if (!state.selectedTask || !state.selectedTask.shop) return;
    $('inp-lat').value = state.selectedTask.shop.latitude;
    $('inp-lng').value = state.selectedTask.shop.longitude;
  };

  $('btn-use-device-gps').onclick = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $('inp-lat').value = pos.coords.latitude;
        $('inp-lng').value = pos.coords.longitude;
      },
      (err) => alert('GPS error: ' + err.message),
      { enableHighAccuracy: true }
    );
  };

  $('btn-save-task-notes').onclick = async () => {
    if (!state.selectedTask) return;
    try {
      const data = await api('/api/shahtaj/v1/tasks/notes', {
        task_id: state.selectedTask.id,
        notes: $('inp-task-notes').value,
      });
      state.selectedTask = data.task;
      await loadTasks();
      selectTask(data.task);
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-checkin').onclick = async () => {
    if (!state.selectedTask) return;
    try {
      const data = await api('/api/shahtaj/v1/tasks/check-in', {
        task_id: state.selectedTask.id,
        latitude: parseFloat($('inp-lat').value),
        longitude: parseFloat($('inp-lng').value),
      });
      state.visit = data.visit;
      state.lastCompletedVisit = null;
      await loadTasks();
      await loadActiveVisit();
      switchTab('visit');
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-continue-visit').onclick = async () => {
    if (!state.selectedTask || !state.selectedTask.visit_id) return;
    try {
      const data = await api('/api/shahtaj/v1/visits/get', {
        visit_id: state.selectedTask.visit_id,
      });
      state.visit = data.visit;
      if (data.visit.state === 'in_progress') {
        switchTab('visit');
        renderVisit();
      } else {
        alert('Visit is already completed.');
        await loadVisitHistory();
        switchTab('history');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-skip-task').onclick = async () => {
    if (!state.selectedTask) return;
    if (!confirm('Skip this task?')) return;
    try {
      await api('/api/shahtaj/v1/tasks/skip', { task_id: state.selectedTask.id });
      state.selectedTask = null;
      $('checkin-panel').classList.add('hidden');
      await loadTasks();
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-load-products').onclick = () => loadProductList().catch(alertErr);
  $('inp-product-filter').oninput = () => renderProductCards();
  $('inp-add-qty').onchange = () => renderProductCards();

  $('btn-save-visit-notes').onclick = async () => {
    if (!state.visit) return;
    try {
      const data = await api('/api/shahtaj/v1/visits/notes', {
        visit_id: state.visit.id,
        notes: $('inp-visit-notes').value,
      });
      state.visit = data.visit;
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-place-order').onclick = async () => {
    if (!state.visit) return;
    if (!confirm('Place order and complete visit?')) return;
    try {
      const data = await api('/api/shahtaj/v1/visits/place-order', {
        visit_id: state.visit.id,
      });
      state.lastCompletedVisit = data.visit;
      state.visit = null;
      renderVisit();
      await loadTasks();
      alert(`Order placed: ${data.visit.sale_order_name || 'OK'} — Total: ${data.visit.order_amount}`);
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-end-visit').onclick = async () => {
    if (!state.visit) return;
    if (!confirm('End visit without order?')) return;
    try {
      const data = await api('/api/shahtaj/v1/visits/end-without-order', {
        visit_id: state.visit.id,
      });
      state.lastCompletedVisit = data.visit;
      state.visit = null;
      renderVisit();
      await loadTasks();
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-view-completed-visit').onclick = async () => {
    if (!state.lastCompletedVisit) return;
    try {
      await api('/api/shahtaj/v1/visits/get', { visit_id: state.lastCompletedVisit.id });
    } catch (e) {
      alert(e.message);
    }
  };

  $('btn-register-shop').onclick = async () => {
    try {
      const body = {
        name: $('reg-name').value,
        owner_name: $('reg-owner').value,
        owner_phone: $('reg-phone').value,
        latitude: parseFloat($('reg-lat').value),
        longitude: parseFloat($('reg-lng').value),
        credit_limit: parseFloat($('reg-credit').value) || 0,
      };
      const legacy = $('reg-legacy').value;
      if (legacy) body.legacy_balance = parseFloat(legacy);
      const zone = $('reg-zone').value;
      const route = $('reg-route').value;
      if (zone) body.zone_id = parseInt(zone, 10);
      if (route) body.route_id = parseInt(route, 10);

      const photos = {
        owner_cnic_front: await readFileAsDataUrl('reg-cnic-front'),
        owner_cnic_back: await readFileAsDataUrl('reg-cnic-back'),
        owner_photo: await readFileAsDataUrl('reg-owner-photo'),
        shop_exterior_photo: await readFileAsDataUrl('reg-shop-exterior'),
      };
      Object.entries(photos).forEach(([key, value]) => {
        if (value) body[key] = value;
      });
      await api('/api/shahtaj/v1/shops/register', body);
      await loadMyShops();
      alert('Shop submitted for approval.');
    } catch (e) {
      alert(e.message);
    }
  };

  function alertErr(e) { alert(e.message || e); }

  /* ── Boot ── */
  setupPhotoPreviews();
  renderEndpointReference();
  (async function init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.apiKey = saved.apiKey;
        state.database = saved.database;
        state.user = saved.user;
        $('inp-database').value = state.database || 'shahtaj_dev19';
        if (state.apiKey) {
          await afterLogin();
          return;
        }
      }
    } catch (e) {
      console.warn('Stored session invalid', e);
      clearSession();
    }
    showLogin();
  })();
})();
