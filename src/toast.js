let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:480px;width:100%;padding:0 16px;';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'info', duration = 4000) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.style.cssText =
    'pointer-events:auto;padding:14px 20px;border-radius:12px;font-size:0.85rem;font-weight:500;line-height:1.4;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:toast-in 0.3s cubic-bezier(0.16,1,0.3,1);display:flex;align-items:center;gap:10px;word-break:break-word;';

  const colors = {
    success: 'background:#0d1f12;color:#22dd88;border:1px solid rgba(34,221,136,0.2);',
    error: 'background:#1f0d12;color:#ff4466;border:1px solid rgba(255,68,102,0.2);',
    warning: 'background:#1f1a0d;color:#ffcc00;border:1px solid rgba(255,204,0,0.2);',
    info: 'background:#0d111f;color:#88bbff;border:1px solid rgba(136,187,255,0.2);',
  };
  el.style.cssText += colors[type] || colors.info;

  el.textContent = message;
  c.appendChild(el);

  const remove = () => {
    el.style.animation = 'toast-out 0.25s cubic-bezier(0.16,1,0.3,1) forwards';
    setTimeout(() => el.remove(), 250);
  };

  const timer = setTimeout(remove, duration);

  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });

  return { remove };
}

export function toastSuccess(msg, duration) {
  return toast(msg, 'success', duration);
}
export function toastError(msg, duration) {
  return toast(msg, 'error', duration || 6000);
}
export function toastWarning(msg, duration) {
  return toast(msg, 'warning', duration);
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
@keyframes toast-in {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-8px) scale(0.95); }
}
#toast-container:empty { display: none; }
`;
document.head.appendChild(styleSheet);
