(() => {
  // ── State ──────────────────────────────────────────────────
  let sortKey = 'pris_uppskattning';
  let sortAsc = true;
  let activeFilters = {
    navigering:      new Set(),
    hinderdetektion: new Set(),
    moppteknik:      new Set(),
    borstar:         new Set(),
    filtyp:          new Set(),
    ar:              new Set(),
    station: 'alla',
    prisMin: null,
    prisMax: null,
  };
  let searchTerm = '';

  // ── DOM refs ───────────────────────────────────────────────
  const tbody        = document.getElementById('produktBody');
  const resultInfo   = document.getElementById('resultInfo');
  const searchInput  = document.getElementById('searchInput');
  const noResults    = document.getElementById('noResults');
  const tableWrapper = document.querySelector('.table-wrapper');
  const sidebar      = document.getElementById('sidebar');
  const btnToggle    = document.getElementById('btnFilterToggle');
  const btnSideClose = document.getElementById('toggleSidebar');
  const prisMin      = document.getElementById('prisMin');
  const prisMax      = document.getElementById('prisMax');

  // ── Helpers ────────────────────────────────────────────────
  const fmtPris = n => n.toLocaleString('sv-SE') + ' kr';
  const unique  = key => [...new Set(produkter.map(p => p[key]).filter(Boolean))].sort();

  // ── Build checkbox filter groups ───────────────────────────
  function buildCheckboxGroup(containerId, filterKey, sortNum = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let values = unique(filterKey);
    if (sortNum) values = values.map(Number).sort((a, b) => a - b).map(String);
    values.forEach(val => {
      const label = document.createElement('label');
      label.className = 'check-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = val;
      cb.addEventListener('change', () => {
        if (cb.checked) activeFilters[filterKey].add(val);
        else activeFilters[filterKey].delete(val);
        render();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(val));
      container.appendChild(label);
    });
  }

  buildCheckboxGroup('filter-navigering',      'navigering');
  buildCheckboxGroup('filter-hinderdetektion', 'hinderdetektion');
  buildCheckboxGroup('filter-moppteknik',      'moppteknik');
  buildCheckboxGroup('filter-borstar',         'borstar');
  buildCheckboxGroup('filter-filtyp',          'filtyp');
  buildCheckboxGroup('filter-ar',              'ar', true);

  // ── Station radio ──────────────────────────────────────────
  document.querySelectorAll('input[name="station"]').forEach(r => {
    r.addEventListener('change', () => { activeFilters.station = r.value; render(); });
  });

  // ── Price range (filters on pris_uppskattning) ─────────────
  prisMin.addEventListener('input', () => {
    activeFilters.prisMin = prisMin.value !== '' ? Number(prisMin.value) : null;
    render();
  });
  prisMax.addEventListener('input', () => {
    activeFilters.prisMax = prisMax.value !== '' ? Number(prisMax.value) : null;
    render();
  });

  // ── Search ─────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  // ── Sorting ────────────────────────────────────────────────
  document.querySelectorAll('th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      updateSortHeaders();
      render();
    });
  });

  function updateSortHeaders() {
    document.querySelectorAll('th[data-key]').forEach(th => {
      const arrow  = th.querySelector('.sort-arrow');
      const active = th.dataset.key === sortKey;
      th.classList.toggle('active', active);
      arrow.textContent = active ? (sortAsc ? '↑' : '↓') : '';
    });
  }

  // ── Filter + sort logic ────────────────────────────────────
  function filtered() {
    return produkter.filter(p => {
      if (searchTerm) {
        const hay = (p.tillverkare + ' ' + p.modellnamn).toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      if (activeFilters.navigering.size      && !activeFilters.navigering.has(p.navigering))           return false;
      if (activeFilters.hinderdetektion.size && !activeFilters.hinderdetektion.has(p.hinderdetektion)) return false;
      if (activeFilters.moppteknik.size      && !activeFilters.moppteknik.has(p.moppteknik))           return false;
      if (activeFilters.borstar.size         && !activeFilters.borstar.has(p.borstar))                 return false;
      if (activeFilters.filtyp.size          && !activeFilters.filtyp.has(p.filtyp))                   return false;
      if (activeFilters.ar.size              && !activeFilters.ar.has(String(p.ar)))                   return false;

      if (activeFilters.station === 'ja'  && p.tomningsstation_liter === 0) return false;
      if (activeFilters.station === 'nej' && p.tomningsstation_liter > 0)   return false;

      if (activeFilters.prisMin !== null && p.pris_uppskattning < activeFilters.prisMin) return false;
      if (activeFilters.prisMax !== null && p.pris_uppskattning > activeFilters.prisMax) return false;

      return true;
    });
  }

  function sorted(list) {
    return [...list].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      // null sorts last regardless of direction
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  // ── Render table ───────────────────────────────────────────
  function render() {
    const list = sorted(filtered());
    tbody.innerHTML = '';

    const showing = list.length;
    const total   = produkter.length;
    resultInfo.innerHTML =
      `Visar <span class="count">${showing}</span> av <span class="count">${total}</span> produkter`;

    noResults.hidden    = showing > 0;
    tableWrapper.hidden = showing === 0;

    list.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.className = 'fade-enter';
      tr.style.animationDelay = `${Math.min(i * 12, 120)}ms`;

      const tomning = p.tomningsstation_liter > 0
        ? `<span class="col-tomning has-station">${p.tomningsstation_liter} L</span>`
        : `<span class="col-tomning no-station">–</span>`;

      const arClass = p.ar === 2026 ? 'badge badge-2026'
                    : p.ar === 2025 ? 'badge badge-2025'
                    : 'badge badge-2024';

      const fullName     = `${p.tillverkare} ${p.modellnamn}`;
      const q            = encodeURIComponent(fullName + ' robotdammsugare');
      const ytUrl        = `https://www.youtube.com/results?search_query=${q}`;
      const googleUrl    = `https://www.google.com/search?q=${q}`;

      const pjCell = p.pris_prisjakt !== null
        ? `<a class="pj-link has-price" href="${esc(googleUrl)}" target="_blank" rel="noopener">${fmtPris(p.pris_prisjakt)}</a>`
        : `<a class="pj-link no-price"  href="${esc(googleUrl)}" target="_blank" rel="noopener" title="Sök på webben">– ↗</a>`;
      const geminiPrompt = `Gör en utvärdering av robotdammsugaren ${fullName}`;

      tr.innerHTML = `
        <td class="col-tillverkare">${esc(p.tillverkare)}</td>
        <td class="col-modell">${esc(p.modellnamn)}</td>
        <td class="col-pris">${fmtPris(p.pris_uppskattning)}</td>
        <td class="col-prisjakt">${pjCell}</td>
        <td class="col-sugkraft">${p.sugkraft.toLocaleString('sv-SE')} Pa</td>
        <td><span class="badge">${esc(p.navigering)}</span></td>
        <td>${esc(p.hinderdetektion)}</td>
        <td><span class="badge">${esc(p.moppteknik)}</span></td>
        <td><span class="badge">${esc(p.borstar)}</span></td>
        <td style="text-align:right;padding-right:1.2rem">${tomning}</td>
        <td class="col-klattring">${p.klattring_mm} mm</td>
        <td><span class="badge">${esc(p.filtyp)}</span></td>
        <td><span class="${arClass}">${p.ar}</span></td>
        <td class="col-search">
          <button class="sdrop-btn"
                  data-yt="${esc(ytUrl)}"
                  data-google="${esc(googleUrl)}"
                  data-prompt="${esc(geminiPrompt)}"
                  aria-haspopup="true" aria-expanded="false">⌕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Reset ──────────────────────────────────────────────────
  function resetAll() {
    searchTerm = '';
    searchInput.value = '';
    activeFilters.navigering.clear();
    activeFilters.hinderdetektion.clear();
    activeFilters.moppteknik.clear();
    activeFilters.borstar.clear();
    activeFilters.filtyp.clear();
    activeFilters.ar.clear();
    activeFilters.station = 'alla';
    activeFilters.prisMin = null;
    activeFilters.prisMax = null;
    document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelector('input[name="station"][value="alla"]').checked = true;
    prisMin.value = '';
    prisMax.value = '';
    render();
  }

  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('btnResetEmpty').addEventListener('click', resetAll);

  // ── Global dropdown (appended to body to escape table stacking context) ──
  const globalMenu = document.createElement('div');
  globalMenu.id = 'sdropGlobal';
  globalMenu.hidden = true;
  globalMenu.innerHTML = `
    <a id="sdropYt"     class="sdrop-item sdrop-yt"     target="_blank" rel="noopener">▶ YouTube</a>
    <a id="sdropGoogle" class="sdrop-item sdrop-google"  target="_blank" rel="noopener">⌕ Webbsök</a>
    <button id="sdropGemini" class="sdrop-item sdrop-gemini">✦ Gemini AI</button>
  `;
  document.body.appendChild(globalMenu);

  const sdropYt     = document.getElementById('sdropYt');
  const sdropGoogle = document.getElementById('sdropGoogle');
  const sdropGemini = document.getElementById('sdropGemini');

  let activeBtn = null;

  function openMenu(btn) {
    const rect = btn.getBoundingClientRect();
    sdropYt.href     = btn.dataset.yt;
    sdropGoogle.href = btn.dataset.google;
    sdropGemini.dataset.prompt = btn.dataset.prompt;

    // Position: prefer below-right aligned to button's right edge
    globalMenu.hidden = false;
    const mw = globalMenu.offsetWidth;
    let left = rect.right - mw;
    if (left < 8) left = 8;
    globalMenu.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    globalMenu.style.left = left + 'px';

    if (activeBtn) activeBtn.setAttribute('aria-expanded', 'false');
    activeBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    globalMenu.hidden = true;
    if (activeBtn) { activeBtn.setAttribute('aria-expanded', 'false'); activeBtn = null; }
  }

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.sdrop-btn');
    if (btn) {
      e.stopPropagation();
      if (activeBtn === btn && !globalMenu.hidden) { closeMenu(); return; }
      openMenu(btn);
      return;
    }
  });

  sdropGemini.addEventListener('click', () => {
    const prompt = sdropGemini.dataset.prompt;
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open('https://gemini.google.com/', '_blank', 'noopener');
    closeMenu();
    showToast('Frågan kopierad — klistra in i Gemini');
  });

  globalMenu.addEventListener('click', e => {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.sdrop-btn') && !e.target.closest('#sdropGlobal')) closeMenu();
  });

  window.addEventListener('scroll',  closeMenu, { passive: true });
  window.addEventListener('resize',  closeMenu, { passive: true });

  // ── Toast notification ─────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('toast-show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast-show'), 2800);
  }

  // ── Mobile sidebar ─────────────────────────────────────────
  btnToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:199;';
      overlay.addEventListener('click', closeSidebar);
      document.body.appendChild(overlay);
    }
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  });

  function closeSidebar() {
    sidebar.classList.remove('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  btnSideClose.addEventListener('click', closeSidebar);

  // ── Init ───────────────────────────────────────────────────
  updateSortHeaders();
  render();
})();
