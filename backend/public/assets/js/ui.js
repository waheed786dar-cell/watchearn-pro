/* ================================================
   ui.js — Toast, Loader, Modal, Particles, Utils
   ================================================ */

// ════════════════════════════════
// TOAST SYSTEM
// ════════════════════════════════
export const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(title, message='', type='info', duration=4000) {
    const icons = {
      success: '✅', error: '❌',
      warning: '⚠️', info: 'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    this._getContainer().appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  success: (title, msg)  => Toast.show(title, msg, 'success'),
  error:   (title, msg)  => Toast.show(title, msg, 'error'),
  warning: (title, msg)  => Toast.show(title, msg, 'warning'),
  info:    (title, msg)  => Toast.show(title, msg, 'info'),
};

// ════════════════════════════════
// LOADER
// ════════════════════════════════
export const Loader = {
  _el: null,

  show(text = 'Loading...') {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'loader-overlay';
    this._el.innerHTML = `
      <div class="loader-logo animate-pulse">${CONFIG.APP_NAME}</div>
      <div class="loader-spinner"></div>
      <p style="color:var(--text-muted);font-size:var(--text-sm)">${text}</p>
    `;
    document.body.appendChild(this._el);
  },

  hide() {
    if (!this._el) return;
    this._el.classList.add('fade-out');
    setTimeout(() => { this._el?.remove(); this._el = null; }, 400);
  },
};

// ════════════════════════════════
// MODAL
// ════════════════════════════════
export const Modal = {
  _stack: [],

  create({ id, title, content, footer = '', size = '' }) {
    // Remove existing
    document.getElementById(id)?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = id;
    overlay.innerHTML = `
      <div class="modal ${size}">
        <button class="modal-close" data-modal="${id}">✕</button>
        <h3 class="modal-title">${title}</h3>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer" style="margin-top:var(--space-6)">${footer}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.modal-close')
      .addEventListener('click', () => Modal.close(id));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close(id);
    });

    this._stack.push(id);
    return overlay;
  },

  open(id) {
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => el.classList.add('active'));
    }
  },

  close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      setTimeout(() => el.remove(), 300);
      this._stack = this._stack.filter(i => i !== id);
    }
  },

  // Confirm dialog
  confirm({ title, message, confirmText='Confirm', cancelText='Cancel',
            type='primary', onConfirm, onCancel }) {
    const id = 'confirm-modal-' + Date.now();
    const m  = this.create({
      id,
      title,
      content: `<p style="color:var(--text-secondary);line-height:1.6">${message}</p>`,
      footer: `
        <div class="flex gap-4">
          <button class="btn btn-ghost btn-full" id="${id}-cancel">${cancelText}</button>
          <button class="btn btn-${type} btn-full" id="${id}-confirm">${confirmText}</button>
        </div>
      `,
    });

    this.open(id);

    m.querySelector(`#${id}-confirm`).addEventListener('click', () => {
      this.close(id);
      onConfirm?.();
    });
    m.querySelector(`#${id}-cancel`).addEventListener('click', () => {
      this.close(id);
      onCancel?.();
    });
  },
};

// ════════════════════════════════
// PARTICLES BACKGROUND
// ════════════════════════════════
export const Particles = {
  start(count = 30) {
    let bg = document.getElementById('particles-bg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'particles-bg';
      document.body.prepend(bg);
    }

    const colors = [
      'var(--primary)', 'var(--secondary)',
      'var(--gold)',    'var(--success)',
    ];

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `
        left:              ${Math.random() * 100}%;
        width:             ${Math.random() * 3 + 1}px;
        height:            ${Math.random() * 3 + 1}px;
        background:        ${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration:${Math.random() * 15 + 10}s;
        animation-delay:   ${Math.random() * 10}s;
      `;
      bg.appendChild(p);
    }
  },
};

// ════════════════════════════════
// FORM HELPERS
// ════════════════════════════════
export const Form = {
  // Get all form values
  collect(formEl) {
    const data = {};
    new FormData(formEl).forEach((val, key) => { data[key] = val; });
    return data;
  },

  // Show field error
  setError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('error');
    let hint = field.nextElementSibling;
    if (!hint || !hint.classList.contains('form-error')) {
      hint = document.createElement('div');
      hint.className = 'form-error';
      field.after(hint);
    }
    hint.textContent = message;
  },

  // Clear field error
  clearError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.remove('error');
    const hint = field.nextElementSibling;
    if (hint?.classList.contains('form-error')) hint.remove();
  },

  // Set button loading state
  setLoading(btnEl, loading, text = '') {
    if (loading) {
      btnEl.dataset.originalText = btnEl.textContent;
      btnEl.classList.add('btn-loading');
      btnEl.disabled = true;
      if (text) btnEl.textContent = text;
    } else {
      btnEl.classList.remove('btn-loading');
      btnEl.disabled = false;
      btnEl.textContent = btnEl.dataset.originalText || btnEl.textContent;
    }
  },
};

// ════════════════════════════════
// DOM HELPERS
// ════════════════════════════════
export const DOM = {
  // Query helpers
  $:  (sel, ctx=document) => ctx.querySelector(sel),
  $$: (sel, ctx=document) => [...ctx.querySelectorAll(sel)],

  // Format currency
  currency: (amount) =>
    `PKR ${Number(amount).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,

  // Format date
  date: (iso) => new Date(iso).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
  }),

  // Format datetime
  datetime: (iso) => new Date(iso).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }),

  // Format seconds to mm:ss
  seconds: (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  },

  // Status badge HTML
  badge: (status) => {
    const map = {
      active:    'success', approved: 'success', completed: 'success',
      pending:   'warning',
      rejected:  'danger',  banned: 'danger', inactive: 'danger',
      cancelled: 'muted',
    };
    const type = map[status] || 'muted';
    return `<span class="badge badge-${type}">${status}</span>`;
  },

  // Skeleton placeholder
  skeleton: (lines=3) => Array(lines).fill('')
    .map((_, i) => `<div class="skeleton skeleton-text" style="width:${60 + Math.random()*40}%"></div>`)
    .join(''),

  // Paginator
  paginator(pagination, onPage) {
    const { page, total_pages } = pagination;
    if (total_pages <= 1) return '';

    let html = '<div class="pagination">';
    if (page > 1)
      html += `<button class="page-btn" data-page="${page-1}">←</button>`;

    for (let i = 1; i <= total_pages; i++) {
      if (i === 1 || i === total_pages || Math.abs(i - page) <= 1) {
        html += `<button class="page-btn ${i===page?'active':''}" data-page="${i}">${i}</button>`;
      } else if (Math.abs(i - page) === 2) {
        html += `<span class="page-btn" style="cursor:default">…</span>`;
      }
    }

    if (page < total_pages)
      html += `<button class="page-btn" data-page="${page+1}">→</button>`;

    html += '</div>';
    return html;
  },
};
