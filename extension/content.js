(() => {
  if (window.__fastCvLoaded) { window.__fastCvOpen(); return; }
  window.__fastCvLoaded = true;

  // ---------- JD extraction ----------

  const SITE_SELECTORS = [
    '#job-details',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '.jobs-description-content__text',
    '[data-automation-id="jobPostingDescription"]',
    '#content .job__description',
    '.posting-page .section-wrapper',
    '[data-testid="job-description"]',
    '.job-description',
    '#jobDescriptionText',
    '.description__text',
    '.ashby-job-posting-right-pane',
    'article.posting',
  ];

  const BAD = /(^|\s)(nav|footer|header|aside|menu|sidebar|cookie|banner|advert|promo|related|similar|recommend)/i;

  function visibleText(el) {
    if (!el) return '';
    const t = el.innerText || '';
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }

  function scoreNode(el) {
    const text = visibleText(el);
    const len = text.length;
    if (len < 400) return null;
    const cls = `${el.className || ''} ${el.id || ''}`;
    if (BAD.test(cls)) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const blocks = el.querySelectorAll('p, li, br').length;
    const links = el.querySelectorAll('a').length;
    const linkText = [...el.querySelectorAll('a')].reduce((n, a) => n + (a.innerText || '').length, 0);
    const linkRatio = len ? linkText / len : 1;
    if (linkRatio > 0.45) return null;

    let score = len + blocks * 40 - links * 12;
    if (/job|posting|description|role|position|vacancy|career/i.test(cls)) score += 1500;
    return { el, text, score };
  }

  function extractJd() {
    const sel = String(window.getSelection() || '').trim();
    if (sel.length > 250) return { text: sel, how: 'your selection' };

    for (const q of SITE_SELECTORS) {
      const el = document.querySelector(q);
      const text = visibleText(el);
      if (text.length > 400) return { text, how: `page section (${q})` };
    }

    const candidates = [];
    const roots = document.querySelectorAll('main, article, [role="main"], section, div');
    for (const el of roots) {
      if (el.querySelectorAll('main, article').length) continue;
      const s = scoreNode(el);
      if (s) candidates.push(s);
    }
    if (!candidates.length) {
      const body = visibleText(document.body);
      return body.length > 400
        ? { text: body, how: 'whole page (rough)' }
        : { text: '', how: 'nothing found' };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    let chosen = best;
    for (const c of candidates) {
      if (c === best) continue;
      if (best.el.contains(c.el) && c.text.length > best.text.length * 0.85) chosen = c;
    }
    return { text: chosen.text, how: 'detected job section' };
  }

  // ---------- modal ----------

  const EXTEND_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
  const COLLAPSE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>`;
  const CLOSE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:host {
  all: initial;
}

/* Custom premium scrollbar styling inside host */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}

.wrap {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
  transition: all 0.3s ease;
}

/* Minimized State (Collapsed) */
.wrap.collapsed {
  position: fixed;
  inset: auto 20px auto auto;
  top: 20px;
  right: 20px;
  width: 320px;
  height: auto;
  background: transparent !important;
  backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
}

.wrap.collapsed .box {
  width: 320px !important;
  height: auto !important;
  max-height: 480px !important;
  border-radius: 12px;
}

/* Maximized State (Extended) */
.wrap.extended {
  position: fixed;
  inset: 20px 20px 20px auto !important;
  top: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  left: auto !important;
  width: 360px !important;
  height: calc(100vh - 40px) !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
}

.wrap.extended .box {
  width: 360px !important;
  height: calc(100vh - 40px) !important;
  max-height: calc(100vh - 40px) !important;
  border-radius: 12px;
}

/* Container Box */
.box {
  background: rgba(18, 18, 22, 0.88) !important;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  color: #ececf1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Header (Top) */
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex: none;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: -0.03em;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
}

.brand::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #ff4d4d;
  border-radius: 50%;
}

.cv-badge {
  font-size: 9px;
  font-weight: 700;
  background: rgba(255, 77, 77, 0.1);
  color: #ff4d4d;
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}

.role {
  color: #acacbe;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

/* Header Buttons */
.btn-header {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #acacbe;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex: none;
}

.btn-header:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

/* Main Split View in Maximized/Extended State */
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.left {
  flex: none;
  width: 100%;
  height: 290px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

iframe {
  width: 794px;
  height: 1123px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #ffffff;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
  flex: none;
  border-radius: 6px;
  transform: scale(0.24);
  transform-origin: center center;
}

.right {
  width: 100%;
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 13px;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Bottom Controls */
.bot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex: none;
  background: rgba(255, 255, 255, 0.02);
}

.grow {
  flex: 1;
}

/* Buttons */
button.act {
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.primary {
  background: #ff4d4d;
  color: #ffffff;
  border: none;
}

.primary:hover {
  background: #e03c3c;
  box-shadow: 0 0 12px rgba(255, 77, 77, 0.3);
}

.ghost {
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ghost:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

button:disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
}

.status {
  font-size: 12.5px;
  color: #acacbe;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #ff4d4d;
  border-radius: 50%;
  animation: s 0.7s linear infinite;
}

@keyframes s {
  to { transform: rotate(360deg); }
}

h4 {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #ffffff;
  font-weight: 700;
}

/* Pills and Cards */
.pill {
  display: inline-block;
  background: rgba(255, 77, 77, 0.05);
  color: #ff4d4d;
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-radius: 4px;
  padding: 3px 8px;
  margin: 0 4px 4px 0;
  font-size: 11.5px;
  font-weight: 500;
}

.gap {
  display: inline-block;
  background: rgba(255, 255, 255, 0.04);
  color: #acacbe;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 3px 8px;
  margin: 0 4px 4px 0;
  font-size: 11.5px;
  font-weight: 500;
}

.warn {
  background: rgba(255, 77, 77, 0.05);
  color: #ececf1;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-left: 4px solid #ff4d4d;
}

.ok {
  background: rgba(255, 255, 255, 0.04);
  color: #ececf1;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 4px solid #ff4d4d;
}

.note {
  color: #acacbe;
  font-size: 11.5px;
  line-height: 1.5;
}

.jdbox {
  width: 100%;
  height: 120px;
  font: 12px/1.45 ui-monospace, monospace;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px;
  resize: vertical;
  background: rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
  color: #ffffff;
}

.jdbox:focus {
  border-color: #ff4d4d;
  box-shadow: 0 0 8px rgba(255, 77, 77, 0.25);
  outline: none;
}

.fitbad {
  background: rgba(255, 77, 77, 0.05);
  color: #ececf1;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  border: 1px solid rgba(255, 77, 77, 0.2);
  border-left: 4px solid #ff4d4d;
}

/* Input View Screen */
.input-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 16px;
  background: transparent;
  box-sizing: border-box;
  position: relative;
  overflow-y: auto;
}

.input-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  position: relative;
}

.input-title {
  font-size: 17px;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 6px 0;
  letter-spacing: -0.02em;
  text-align: center;
  text-transform: uppercase;
}

.input-subtitle {
  font-size: 12px;
  color: #acacbe;
  margin: 0 0 16px 0;
  text-align: center;
  line-height: 1.4;
}

.jd-input {
  width: 100%;
  height: 130px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 16px;
  outline: none;
  resize: none;
  transition: all 0.2s;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.3);
  color: #ffffff;
  line-height: 1.4;
}

.jd-input:focus {
  border-color: #ff4d4d;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 8px rgba(255, 77, 77, 0.25);
}

.btn-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
}

.gen-btn, .upload-btn {
  flex: 1;
  background: #ff4d4d;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 11px 16px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-sizing: border-box;
}

.gen-btn:hover {
  background: #e03c3c;
  box-shadow: 0 0 12px rgba(255, 77, 77, 0.3);
}

.upload-btn {
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.upload-btn:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

.gen-btn:disabled, .upload-btn:disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
}

/* Info Icon and Tooltip */
.info-container {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  font-size: 11px;
  color: #acacbe;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-weight: bold;
  font-size: 9px;
}

.info-tooltip {
  visibility: hidden;
  width: 260px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ececf1;
  text-align: left;
  border-radius: 6px;
  padding: 12px;
  position: absolute;
  z-index: 1000;
  bottom: 130%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.2s;
  font-weight: normal;
  line-height: 1.45;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
}

.info-tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(20, 20, 20, 0.95) transparent transparent transparent;
}

.info-container:hover .info-tooltip {
  visibility: visible;
  opacity: 1;
}

.tooltip-title {
  font-weight: 700;
  margin-bottom: 6px;
  color: #ffffff;
  font-size: 11px;
  text-transform: uppercase;
}

.tooltip-step {
  margin: 4px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.2);
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: #ff4d4d;
}

/* Progress Container */
.progress-container {
  display: none;
  width: 100%;
  flex-direction: column;
  align-items: center;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.progress-bar-fill {
  width: 0%;
  height: 100%;
  background: #ff4d4d;
  box-shadow: 0 0 8px rgba(255, 77, 77, 0.5);
  border-radius: 4px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.progress-text {
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 6px;
}

.progress-sub {
  font-size: 12px;
  color: #acacbe;
  margin-bottom: 6px;
  font-weight: 500;
  text-align: center;
}

/* Complete Container */
.complete-container {
  display: none;
  width: 100%;
  flex-direction: column;
  align-items: center;
}

.complete-icon {
  font-size: 40px;
  color: #ff4d4d;
  margin-bottom: 10px;
  animation: scIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scIn {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}

.complete-text {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.complete-sub {
  font-size: 13px;
  color: #acacbe;
  margin-bottom: 16px;
  text-align: center;
  line-height: 1.45;
}

.btn-group {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
}

.complete-btn {
  border-radius: 6px;
  padding: 11px 22px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  max-width: 140px;
  text-align: center;
  text-transform: uppercase;
}

.btn-preview {
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-preview:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

.btn-download {
  background: #ff4d4d;
  color: #ffffff;
  border: none;
}

.btn-download:hover {
  background: #e03c3c;
  box-shadow: 0 0 12px rgba(255, 77, 77, 0.3);
}

/* Error Container */
.error-container {
  display: none;
  width: 100%;
  flex-direction: column;
  align-items: center;
}

.error-title {
  font-size: 16px;
  font-weight: 800;
  color: #ff4d4d;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.error-msg {
  font-size: 12px;
  color: #ececf1;
  margin-bottom: 14px;
  text-align: center;
  background: rgba(255, 77, 77, 0.05);
  border: 1px solid rgba(255, 77, 77, 0.2);
  padding: 10px 12px;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.45;
}

.error-setup-info {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 14px;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  color: #ececf1;
  line-height: 1.5;
}

.error-setup-info .tooltip-step {
  background: rgba(255, 77, 77, 0.1);
  color: #ff4d4d;
  border: 1px solid rgba(255, 77, 77, 0.2);
  font-weight: 500;
  display: block;
  margin: 4px 0 8px 0;
}

.btn-back {
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

.header-progress-bar {
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
  position: relative;
  display: none;
  flex: none;
}

.header-progress-fill {
  width: 0%;
  height: 100%;
  background: #ff4d4d;
  transition: width 0.3s ease;
}

/* Inference Selector Modal */
.llm-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  box-sizing: border-box;
}

.llm-modal-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #ffffff;
  margin-bottom: 16px;
}

.llm-option-group {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 280px;
  margin-bottom: 16px;
}

.llm-opt-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  text-transform: uppercase;
}

.llm-opt-btn.active {
  background: #ff4d4d;
  color: #ffffff;
  border-color: #ff4d4d;
}

.llm-opt-btn:hover {
  background: rgba(255, 77, 77, 0.1);
  border-color: #ff4d4d;
  color: #ffffff;
}

.llm-key-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 280px;
  margin-bottom: 20px;
}

.llm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.llm-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: #acacbe;
}

.llm-select, .llm-input {
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 11px;
  font-family: inherit;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  outline: none;
  transition: border-color 0.2s;
}

.llm-select:focus, .llm-input:focus {
  border-color: #ff4d4d;
}

.llm-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 280px;
}

.llm-action-btn {
  flex: 1;
  padding: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
  text-align: center;
  border-radius: 6px;
  text-transform: uppercase;
}

.llm-action-btn.primary {
  background: #ff4d4d;
  color: #ffffff;
  border: none;
}

.llm-action-btn.primary:hover {
  background: #e03c3c;
  box-shadow: 0 0 12px rgba(255, 77, 77, 0.3);
}

.llm-action-btn.secondary {
  background: rgba(255, 255, 255, 0.03);
  color: #ececf1;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.llm-action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}
`;

  let host, root, port, runId = null;
  let isExtended = false;
  let showEditor = false;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function updateProgress(percentage, subText) {
    const fill = $('progress-bar-fill');
    const text = $('progress-text');
    const sub = $('progress-sub');
    if (fill) fill.style.width = `${percentage}%`;
    if (text) text.textContent = `${percentage}%`;
    if (sub) sub.textContent = subText || '';

    const hFill = $('header-progress-fill');
    if (hFill) hFill.style.width = `${percentage}%`;
  }

  function updateViewVisibility() {
    const inputView = $('input-view');
    const main = $('main-view');
    const bot = $('bot-view');
    
    if (isExtended && showEditor) {
      inputView.style.display = 'none';
      main.style.display = 'flex';
      bot.style.display = 'flex';
    } else {
      inputView.style.display = 'flex';
      main.style.display = 'none';
      bot.style.display = 'none';
    }
  }

  function checkServerHealth() {
    chrome.runtime.sendMessage({ type: 'jw-health' }, (res) => {
      const activeCvInfo = $('active-cv-info');
      const cvBadge = $('cv-badge');
      
      if (res && res.ok && res.health) {
        if (res.health.hasFacts && res.health.factsName) {
          if (activeCvInfo) {
            activeCvInfo.innerHTML = `Active CV: <strong style="color: #ff4d4d;">${res.health.factsName}</strong>`;
          }
          if (cvBadge) {
            cvBadge.textContent = res.health.factsName;
            cvBadge.title = `Active CV: ${res.health.factsName}`;
            cvBadge.style.display = 'inline-block';
          }
        } else {
          if (activeCvInfo) {
            activeCvInfo.innerHTML = `No resume imported. Please upload a CV first.`;
          }
          if (cvBadge) {
            cvBadge.style.display = 'none';
          }
        }
      } else {
        if (activeCvInfo) {
          activeCvInfo.innerHTML = `<span style="color: #ff4d4d;">Server offline — check connection</span>`;
        }
        if (cvBadge) {
          cvBadge.style.display = 'none';
        }
      }
    });
  }

  function toggleExtend() {
    isExtended = !isExtended;
    const wrap = root.querySelector('.wrap');
    const extendBtn = $('extend-btn');

    if (isExtended) {
      wrap.classList.remove('collapsed');
      wrap.classList.add('extended');
      if (extendBtn) extendBtn.innerHTML = COLLAPSE_SVG;
    } else {
      wrap.classList.remove('extended');
      wrap.classList.add('collapsed');
      if (extendBtn) extendBtn.innerHTML = EXTEND_SVG;
      showEditor = false;
    }
    updateViewVisibility();
  }

  function build() {
    host = document.createElement('div');
    host.id = 'fast-cv-host';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    const wrap = el('div', 'wrap collapsed');
    const box = el('div', 'box');

    const top = el('div', 'top');
    const headerInfo = el('div', 'header-info');
    
    const brandRow = el('div', 'brand-row');
    const brand = el('div', 'brand', 'fast-CV');
    const cvBadge = el('span', 'cv-badge');
    cvBadge.id = 'cv-badge';
    cvBadge.style.display = 'none';
    brandRow.append(brand, cvBadge);
    
    const role = el('div', 'role', 'reading this page…');
    role.id = 'role';
    headerInfo.append(brandRow, role);
    
    const extendBtn = el('button', 'btn-header btn-extend');
    extendBtn.id = 'extend-btn';
    extendBtn.innerHTML = EXTEND_SVG;
    extendBtn.onclick = toggleExtend;

    const x = el('button', 'btn-header btn-close');
    x.innerHTML = CLOSE_SVG;
    x.onclick = close;
    top.append(headerInfo, extendBtn, x);

    // --- Input View ---
    const inputView = el('div', 'input-view');
    inputView.id = 'input-view';

    const card = el('div', 'input-card');
    card.append(el('h2', 'input-title', 'Tailor Your Resume'));
    card.append(el('p', 'input-subtitle', 'Paste the job description below to align your resume facts.'));

    const activeCvInfo = el('div', 'active-cv-info');
    activeCvInfo.id = 'active-cv-info';
    activeCvInfo.style.fontSize = '12px';
    activeCvInfo.style.color = '#acacbe';
    activeCvInfo.style.marginBottom = '14px';
    activeCvInfo.style.textAlign = 'center';
    activeCvInfo.innerHTML = 'Checking server connection...';
    card.append(activeCvInfo);

    const jdTextarea = el('textarea', 'jd-input');
    jdTextarea.id = 'jd-input-box';
    jdTextarea.placeholder = 'Paste job description details here...';
    card.append(jdTextarea);

    const btnRow = el('div', 'btn-row');
    btnRow.id = 'btn-row';

    const genBtn = el('button', 'gen-btn', 'Generate');
    genBtn.id = 'gen-btn';

    const uploadBtn = el('button', 'upload-btn', 'Upload CV');
    uploadBtn.id = 'upload-btn';
    uploadBtn.title = 'upload to wire the resume';

    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';
    fileInput.style.display = 'none';
    fileInput.id = 'cv-file-input';

    uploadBtn.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const originalText = uploadBtn.textContent;
      uploadBtn.disabled = true;
      genBtn.disabled = true;

      // Hide inputs and show progress
      $('jd-input-box').style.display = 'none';
      $('btn-row').style.display = 'none';
      const infoBadge = $('info-container');
      if (infoBadge) infoBadge.style.display = 'none';
      
      const prog = $('progress-container');
      if (prog) prog.style.display = 'flex';
      
      updateProgress(10, 'Reading PDF file...');

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
        });
        reader.readAsDataURL(file);
        const pdfBase64 = await base64Promise;

        updateProgress(45, 'Sending PDF to server...');
        updateProgress(75, 'Parsing layout and extracting facts...');

        chrome.runtime.sendMessage({ type: 'jw-upload-resume', pdfBase64 }, (res) => {
          uploadBtn.disabled = false;
          genBtn.disabled = false;
          uploadBtn.textContent = originalText;

          if (res && res.ok) {
            updateProgress(100, `Import successful: ${res.name}!`);
            
            setTimeout(() => {
              if (prog) prog.style.display = 'none';
              $('jd-input-box').style.display = 'block';
              $('btn-row').style.display = 'flex';
              if (infoBadge) infoBadge.style.display = 'flex';
              if ($('active-cv-info')) $('active-cv-info').style.display = 'block';
              
              setStatus(`Resume imported: ${res.name}`, false);
              checkServerHealth();
              
              const iframe = $('frame');
              if (iframe && iframe.src) {
                iframe.contentWindow.postMessage({ type: 'jw-reload' }, '*');
              }
            }, 1000);
          } else {
            if (prog) prog.style.display = 'none';
            $('jd-input-box').style.display = 'block';
            $('btn-row').style.display = 'flex';
            if (infoBadge) infoBadge.style.display = 'flex';
            
            setStatus(res ? res.error : 'Failed to upload resume', false);
          }
        });
      } catch (err) {
        uploadBtn.disabled = false;
        genBtn.disabled = false;
        uploadBtn.textContent = originalText;
        
        if (prog) prog.style.display = 'none';
        $('jd-input-box').style.display = 'block';
        $('btn-row').style.display = 'flex';
        if (infoBadge) infoBadge.style.display = 'flex';
        
        setStatus(err.message, false);
      }
    };

    btnRow.append(genBtn, uploadBtn, fileInput);
    card.append(btnRow);

    // Setup Recommendation Info Badge with hover tooltip
    const infoContainer = el('div', 'info-container');
    infoContainer.id = 'info-container';
    infoContainer.innerHTML = `
      <span>Local server setup</span>
      <span class="info-icon">i</span>
      <div class="info-tooltip">
        <div class="tooltip-title">How to start the server:</div>
        <div>1. Open terminal in project root</div>
        <div class="tooltip-step">npm run dev</div>
        <div>2. Ensure Ollama is running</div>
        <div class="tooltip-step">ollama serve</div>
        <div>3. Load resume facts in setup</div>
        <div class="tooltip-step">http://127.0.0.1:7788/setup</div>
      </div>
    `;
    card.append(infoContainer);

    // Progress container (initially hidden)
    const progContainer = el('div', 'progress-container');
    progContainer.id = 'progress-container';
    
    const progText = el('div', 'progress-text', '0%');
    progText.id = 'progress-text';
    
    const progBarBg = el('div', 'progress-bar-bg');
    const progBarFill = el('div', 'progress-bar-fill');
    progBarFill.id = 'progress-bar-fill';
    progBarBg.append(progBarFill);
    
    const progSub = el('div', 'progress-sub', 'Starting...');
    progSub.id = 'progress-sub';
    
    progContainer.append(progText, progBarBg, progSub);
    card.append(progContainer);

    // Complete container (initially hidden)
    const compContainer = el('div', 'complete-container');
    compContainer.id = 'complete-container';
    
    const compIcon = el('div', 'complete-icon', '✓');
    const compText = el('div', 'complete-text', 'Inference Complete');
    const compSub = el('div', 'complete-sub', 'Inference complete! Please review and check.');
    
    const btnGroup = el('div', 'btn-group');
    const prevBtn = el('button', 'complete-btn btn-preview', 'Preview');
    prevBtn.onclick = () => {
      showEditor = true;
      isExtended = true;
      wrap.classList.remove('collapsed');
      wrap.classList.add('extended');
      if (extendBtn) extendBtn.innerHTML = COLLAPSE_SVG;
      updateViewVisibility();
    };
    const dlBtn = el('button', 'complete-btn btn-download', 'Download PDF');
    dlBtn.id = 'complete-dl';
    dlBtn.onclick = onDownload;
    
    btnGroup.append(prevBtn, dlBtn);
    compContainer.append(compIcon, compText, compSub, btnGroup);
    card.append(compContainer);

    // Error container (initially hidden)
    const errContainer = el('div', 'error-container');
    errContainer.id = 'error-container';
    
    const errTitle = el('div', 'error-title', 'Tailoring Failed');
    const errMsg = el('div', 'error-msg', 'An error occurred during inference.');
    errMsg.id = 'error-msg-text';
    
    const errSetup = el('div', 'error-setup-info');
    errSetup.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 6px; color: #ffffff;">To start the local fast-CV server:</div>
      <div style="margin-bottom: 4px;">1. Run in project directory:</div>
      <div class="tooltip-step">npm run dev</div>
      <div style="margin-bottom: 4px;">2. Ensure Ollama is running:</div>
      <div class="tooltip-step">ollama serve</div>
      <div style="margin-bottom: 4px;">3. Load your resume facts:</div>
      <a href="http://127.0.0.1:7788/setup" target="_blank" style="color: #ff4d4d; font-weight: 600; text-decoration: underline;">http://127.0.0.1:7788/setup</a>
    `;
    
    const backBtn = el('button', 'btn-back', 'Back to Edit');
    backBtn.onclick = () => {
      errContainer.style.display = 'none';
      jdTextarea.style.display = 'block';
      $('btn-row').style.display = 'flex';
      infoContainer.style.display = 'flex';
      if ($('active-cv-info')) $('active-cv-info').style.display = 'block';
    };
    
    errContainer.append(errTitle, errMsg, errSetup, backBtn);
    card.append(errContainer);

    inputView.append(card);

    // --- Main View (split screen) ---
    const main = el('div', 'main');
    main.id = 'main-view';
    main.style.display = 'none';

    const left = el('div', 'left');
    const frame = document.createElement('iframe');
    frame.id = 'frame';
    frame.setAttribute('scrolling', 'no');
    left.append(frame);
    const right = el('div', 'right');
    right.id = 'right';
    main.append(left, right);

    // --- Bottom controls ---
    const bot = el('div', 'bot');
    bot.id = 'bot-view';
    bot.style.display = 'none';

    const status = el('div', 'status');
    status.id = 'status';
    const save = el('button', 'act ghost', 'Update');
    save.id = 'save'; save.disabled = true; save.onclick = onSave;
    const dl = el('button', 'act primary', 'Download PDF');
    dl.id = 'dl'; dl.disabled = true; dl.onclick = onDownload;
    bot.append(status, el('div', 'grow'), save, dl);

    const headerProg = el('div', 'header-progress-bar');
    headerProg.id = 'header-progress';
    const headerProgFill = el('div', 'header-progress-fill');
    headerProgFill.id = 'header-progress-fill';
    headerProg.append(headerProgFill);

    box.append(top, headerProg, inputView, main, bot);
    wrap.append(box);
    root.append(wrap);
    document.documentElement.append(host);

    // Inference Selector Modal
    function showLlmModal(jdText) {
      const existing = $('llm-modal');
      if (existing) existing.remove();

      const modal = el('div', 'llm-modal-overlay');
      modal.id = 'llm-modal';

      modal.append(el('div', 'llm-modal-title', 'Select Inference Source'));

      const optionGroup = el('div', 'llm-option-group');
      const localBtn = el('button', 'llm-opt-btn active', 'Local Inference');
      const keyBtn = el('button', 'llm-opt-btn', 'Use API Key');
      optionGroup.append(localBtn, keyBtn);
      modal.append(optionGroup);

      const form = el('div', 'llm-key-form');
      form.style.display = 'none';

      // Provider select
      const providerField = el('div', 'llm-field');
      providerField.append(el('label', 'llm-label', 'Provider'));
      const providerSelect = el('select', 'llm-select');
      const optGemini = el('option'); optGemini.value = 'gemini'; optGemini.textContent = 'Gemini';
      const optOpenai = el('option'); optOpenai.value = 'openai'; optOpenai.textContent = 'OpenAI';
      const optAnthropic = el('option'); optAnthropic.value = 'anthropic'; optAnthropic.textContent = 'Anthropic';
      providerSelect.append(optGemini, optOpenai, optAnthropic);
      providerField.append(providerSelect);

      // API Key input
      const keyField = el('div', 'llm-field');
      keyField.append(el('label', 'llm-label', 'API Key'));
      const keyInput = el('input', 'llm-input');
      keyInput.type = 'password';
      keyInput.placeholder = 'Enter API key...';
      keyField.append(keyInput);

      // Model input (optional)
      const modelField = el('div', 'llm-field');
      modelField.append(el('label', 'llm-label', 'Model (Optional)'));
      const modelInput = el('input', 'llm-input');
      modelInput.type = 'text';
      modelInput.placeholder = 'Default model will be used...';
      modelField.append(modelInput);

      form.append(providerField, keyField, modelField);
      modal.append(form);

      // Actions
      const actions = el('div', 'llm-actions');
      const cancelBtn = el('button', 'llm-action-btn secondary', 'Cancel');
      const confirmBtn = el('button', 'llm-action-btn primary', 'Confirm & Generate');
      actions.append(cancelBtn, confirmBtn);
      modal.append(actions);

      card.append(modal);

      chrome.storage.local.get(['llmType', 'llmProvider', 'llmApiKey', 'llmModel'], (res) => {
        if (res.llmType === 'key') {
          keyBtn.click();
        } else {
          localBtn.click();
        }
        if (res.llmProvider) providerSelect.value = res.llmProvider;
        if (res.llmApiKey) keyInput.value = res.llmApiKey;
        if (res.llmModel) modelInput.value = res.llmModel;
        updatePlaceholder();
      });

      function updatePlaceholder() {
        if (providerSelect.value === 'gemini') {
          modelInput.placeholder = 'gemini-3.6-flash';
        } else if (providerSelect.value === 'openai') {
          modelInput.placeholder = 'gpt-4o-mini';
        } else if (providerSelect.value === 'anthropic') {
          modelInput.placeholder = 'claude-3-5-haiku-20241022';
        }
      }

      providerSelect.onchange = updatePlaceholder;

      localBtn.onclick = () => {
        localBtn.classList.add('active');
        keyBtn.classList.remove('active');
        form.style.display = 'none';
      };

      keyBtn.onclick = () => {
        keyBtn.classList.add('active');
        localBtn.classList.remove('active');
        form.style.display = 'flex';
      };

      cancelBtn.onclick = () => {
        modal.remove();
      };

      confirmBtn.onclick = async () => {
        const type = localBtn.classList.contains('active') ? 'local' : 'key';
        const provider = providerSelect.value;
        const apiKey = keyInput.value.trim();
        const model = modelInput.value.trim();

        if (type === 'key' && !apiKey) {
          alert('API Key is required to use key-based inference.');
          return;
        }

        await chrome.storage.local.set({
          llmType: type,
          llmProvider: provider,
          llmApiKey: apiKey,
          llmModel: model
        });

        modal.remove();

        jdTextarea.style.display = 'none';
        $('btn-row').style.display = 'none';
        infoContainer.style.display = 'none';
        if ($('active-cv-info')) $('active-cv-info').style.display = 'none';
        errContainer.style.display = 'none';
        progContainer.style.display = 'flex';
        updateProgress(0, 'Initializing inference...');
        
        start(jdText, false, type === 'key' ? { provider, apiKey, model } : {});
      };
    }

    // Generate click handler
    genBtn.onclick = () => {
      const jdText = jdTextarea.value.trim();
      if (jdText.length < 80) {
        alert('Job description too short to work with (must be at least 80 characters).');
        return;
      }
      showLlmModal(jdText);
    };

    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey, true);
  }

  const $ = (id) => root.getElementById(id);

  function onKey(e) {
    if (e.key === 'Escape' && host) { e.stopPropagation(); close(); }
  }

  function close() {
    document.removeEventListener('keydown', onKey, true);
    if (port) { try { port.disconnect(); } catch (e) { /* already gone */ } port = null; }
    if (host) host.remove();
    host = null;
  }

  function setStatus(text, busy) {
    const s = $('status');
    if (!s) return;
    s.innerHTML = '';
    if (busy) s.append(el('div', 'spin'));
    s.append(el('span', null, text));
  }

  function renderPanel(data) {
    const right = $('right');
    if (!right) return;
    right.innerHTML = '';
    const { jd, gaps, verification, fit } = data;

    if (fit && !fit.fits) {
      right.append(el('div', 'fitbad',
        `Content runs ${fit.overflowPt}pt past one page even after compression. Cut a bullet.`));
    } else if (fit && fit.compressed) {
      right.append(el('div', 'fitbad', 'Squeezed slightly to hold one page.'));
    }

    if (jd) {
      right.append(el('h4', null, 'They are hiring for'));
      right.append(el('div', null, `${jd.title || 'unknown role'}${jd.company ? ` · ${jd.company}` : ''}`));
      if (jd.mustHave && jd.mustHave.length) {
        right.append(el('h4', null, 'What they asked for'));
        const w = el('div');
        for (const k of jd.mustHave.slice(0, 12)) w.append(el('span', 'pill', k));
        right.append(w);
      }
    }

    const flagged = (verification && verification.flagged) || [];
    const rejected = (verification && verification.rejected) || [];
    right.append(el('h4', null, 'Honesty check'));
    if (!flagged.length && !rejected.length) {
      right.append(el('div', 'ok', 'Every line traces back to your resume.'));
    } else {
      for (const r of rejected) {
        right.append(el('div', 'warn', `Dropped — ${r.issues[0].detail}. Your original wording was kept.`));
      }
      for (const f of flagged) {
        right.append(el('div', 'warn', `Check this: ${f.issues[0].detail}`));
      }
    }

    if (gaps && gaps.length) {
      right.append(el('h4', null, 'You do not have these'));
      const g = el('div');
      for (const k of gaps.slice(0, 14)) g.append(el('span', 'gap', k));
      right.append(g);
      right.append(el('div', 'note',
        'Deliberately left out of the resume. Do not claim them — use them to decide whether to apply, or to prepare answers.'));
    }

    const details = el('details');
    const summary = el('summary', null, 'Job Description Used');
    summary.style.cursor = 'pointer';
    summary.style.fontWeight = '700';
    summary.style.fontSize = '11px';
    summary.style.textTransform = 'uppercase';
    summary.style.letterSpacing = '.08em';
    summary.style.color = '#ff4d4d';
    summary.style.outline = 'none';

    const ta = el('textarea', 'jdbox');
    ta.value = data.jdText || '';
    ta.id = 'jdtext';
    ta.style.marginTop = '8px';

    const redo = el('button', 'act ghost', 'Re-run with this text');
    redo.style.marginTop = '8px';
    redo.style.width = '100%';
    redo.onclick = () => {
      isExtended = false;
      showEditor = false;
      const wrap = root.querySelector('.wrap');
      wrap.classList.remove('extended');
      wrap.classList.add('collapsed');
      const extendBtn = $('extend-btn');
      if (extendBtn) extendBtn.innerHTML = EXTEND_SVG;

      $('main-view').style.display = 'none';
      $('bot-view').style.display = 'none';
      $('input-view').style.display = 'flex';
      $('jd-input-box').value = ta.value;
      $('jd-input-box').style.display = 'none';
      $('btn-row').style.display = 'none';
      if ($('active-cv-info')) $('active-cv-info').style.display = 'none';
      $('complete-container').style.display = 'none';
      $('progress-container').style.display = 'flex';
      updateProgress(0, 'Re-running inference...');
      chrome.storage.local.get(['llmType', 'llmProvider', 'llmApiKey', 'llmModel'], (res) => {
        const llmOpts = res.llmType === 'key' ? { provider: res.llmProvider, apiKey: res.llmApiKey, model: res.llmModel } : {};
        start(ta.value, true, llmOpts);
      });
    };

    details.append(summary, ta, redo);
    right.append(details);
  }

  let lastData = {};

  function onFrameMessage(e) {
    const m = e.data || {};
    if (m.type === 'jw-fit') {
      lastData.fit = m.fit;
      renderPanel(lastData);
    }
    if (m.type === 'jw-edits') {
      chrome.runtime.sendMessage({ type: 'jw-save', runId, edits: m.edits }, (r) => {
        if (!r || !r.ok) { setStatus(`could not save: ${(r && r.error) || 'unknown'}`, false); return; }
        lastData.verification = r.run.verification;
        renderPanel(lastData);
        setStatus('saved', false);
        $('frame').contentWindow.postMessage({ type: 'jw-reload' }, '*');
      });
    }
  }

  function onSave() {
    setStatus('saving…', true);
    $('frame').contentWindow.postMessage({ type: 'jw-collect' }, '*');
  }

  function onDownload() {
    chrome.runtime.sendMessage({ type: 'jw-download', runId }, () => setStatus('downloaded', false));
  }

  function start(jdText, isRerun, llmOpts = {}) {
    runId = null;
    $('save').disabled = true;
    $('dl').disabled = true;
    
    // We keep the modal collapsed during progress streaming.
    let isGemini = !!llmOpts.provider ? llmOpts.provider.toLowerCase() === 'gemini' : false;
    let modelName = llmOpts.provider ? llmOpts.provider : 'Ollama';
    
    updateProgress(5, 'Reading job description...');

    if (!llmOpts.provider) {
      chrome.runtime.sendMessage({ type: 'jw-health' }, (res) => {
        if (res && res.ok && res.health && res.health.ollama) {
          isGemini = !!res.health.ollama.isGemini;
          modelName = isGemini ? 'Gemini' : 'Ollama';
        }
      });
    }

    const headerProg = $('header-progress');
    if (headerProg) headerProg.style.display = 'block';

    let currentRunState = null;
    let frameLoaded = false;
    const frame = $('frame');

    async function refreshPreview(runState) {
      if (!runState) return;
      const fontBase = chrome.runtime.getURL('fonts').replace(/\/$/, '');
      chrome.runtime.sendMessage({ type: 'jw-base' }, async (res) => {
        const base = res?.base || 'http://127.0.0.1:7788';
        try {
          const res = await fetch(`${base}/preview/parts?edit=1&fonts=${encodeURIComponent(fontBase)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(runState),
          });
          if (res.ok) {
            const parts = await res.json();
            frame.contentWindow.postMessage({ type: 'jw-update', parts, run: runState }, '*');
          }
        } catch (e) {
          console.error('Error updating preview', e);
        }
      });
    }

    chrome.runtime.sendMessage({ type: 'jw-base' }, async (res) => {
      const base = res?.base || 'http://127.0.0.1:7788';
      frame.src = `${chrome.runtime.getURL('preview.html')}?run=stream&base=${encodeURIComponent(base)}`;
      
      frame.onload = () => {
        frameLoaded = true;
        if (currentRunState) {
          refreshPreview(currentRunState);
        }
      };

      try {
        const r = await fetch(`${base}/facts`);
        if (r.ok) {
          currentRunState = await r.json();
          if (frameLoaded) {
            refreshPreview(currentRunState);
          }
        }
      } catch (e) {
        console.error('Failed to fetch facts', e);
      }
    });

    port = chrome.runtime.connect({ name: 'fast-cv' });
    const pingInterval = setInterval(() => {
      try {
        port.postMessage({ type: 'ping' });
      } catch (e) {
        clearInterval(pingInterval);
      }
    }, 10000);

    port.onDisconnect.addListener(() => {
      clearInterval(pingInterval);
    });

    port.onMessage.addListener((ev) => {
      if (ev.type === 'status') {
        let percent = 5;
        if (ev.stage === 'reading-jd') {
          percent = 10;
          const modelInfo = isGemini ? 'Gemini' : (llmOpts.provider ? llmOpts.provider : 'Ollama - can take up to 60s');
          updateProgress(10, `Reading job description (Loading ${modelInfo} model)...`);
        } else if (ev.stage.startsWith('tailoring')) {
          const detail = ev.stage.replace('tailoring section ', 'Tailoring ');
          const done = ev.done || 0;
          const total = ev.total || 1;
          percent = Math.round(20 + (done / total) * 70);
          updateProgress(percent, `${detail} (running ${modelName})...`);
        } else if (ev.stage === 'verifying') {
          percent = 95;
          updateProgress(95, 'Verifying formatting and facts...');
        } else {
          percent = 10;
          updateProgress(10, ev.stage);
        }
        setStatus(`${ev.stage} (${percent}%)`, true);
      }
      if (ev.type === 'warn') {
        setStatus(`${ev.section} kept as-is (${ev.error})`, true);
      }
      if (ev.type === 'jd') {
        updateProgress(20, 'Job description parsed. Starting tailoring...');
        lastData.jd = ev.jd;
        $('role').textContent = `${ev.jd.title || 'this role'}${ev.jd.company ? ` · ${ev.jd.company}` : ''}`;
        renderPanel(lastData);
        if (currentRunState) {
          currentRunState.jd = ev.jd;
          refreshPreview(currentRunState);
        }
      }
      if (ev.type === 'section') {
        const percent = Math.round(20 + (ev.done / ev.total) * 70);
        updateProgress(percent, `Tailored ${ev.label} (${ev.done}/${ev.total})`);
        setStatus(`${ev.label} (${ev.done}/${ev.total}) (${percent}%)`, true);
        
        if (currentRunState) {
          currentRunState[ev.key] = ev.value;
          refreshPreview(currentRunState);
        }
      }
      if (ev.type === 'error') {
        clearInterval(pingInterval);
        if (headerProg) headerProg.style.display = 'none';
        setStatus(ev.error, false);
        $('progress-container').style.display = 'none';
        $('error-msg-text').textContent = ev.error;

        const errSetup = $('error-setup-info');
        if (errSetup) {
          if (isGemini || llmOpts.provider) {
            errSetup.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 6px; color: #ffffff;">To start the local fast-CV server:</div>
              <div style="margin-bottom: 4px;">1. Run in project directory:</div>
              <div class="tooltip-step">npm run dev</div>
              <div style="margin-bottom: 4px;">2. Ensure API keys are configured correctly</div>
              <div style="margin-bottom: 4px;">3. Load your resume facts:</div>
              <a href="http://127.0.0.1:7788/setup" target="_blank" style="color: #ff4d4d; font-weight: 600; text-decoration: underline;">http://127.0.0.1:7788/setup</a>
            `;
          } else {
            errSetup.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 6px; color: #ffffff;">To start the local fast-CV server:</div>
              <div style="margin-bottom: 4px;">1. Run in project directory:</div>
              <div class="tooltip-step">npm run dev</div>
              <div style="margin-bottom: 4px;">2. Ensure Ollama is running:</div>
              <div class="tooltip-step">ollama serve</div>
              <div style="margin-bottom: 4px;">3. Load your resume facts:</div>
              <a href="http://127.0.0.1:7788/setup" target="_blank" style="color: #ff4d4d; font-weight: 600; text-decoration: underline;">http://127.0.0.1:7788/setup</a>
            `;
          }
        }

        $('error-container').style.display = 'flex';
        
        if (/no resume imported/.test(ev.error)) {
          const b = el('button', 'act primary', 'Open setup');
          b.onclick = () => chrome.runtime.sendMessage({ type: 'jw-open-setup' });
          $('error-msg-text').append(document.createElement('br'), b);
        }
      }
      if (ev.type === 'done') {
        clearInterval(pingInterval);
        updateProgress(100, 'Tailoring complete');

        if (headerProg) headerProg.style.display = 'none';
        runId = ev.runId;
        lastData = { ...lastData, jd: ev.run.jd, gaps: ev.run.gaps, verification: ev.run.verification, jdText };
        renderPanel(lastData);
        chrome.runtime.sendMessage({ type: 'jw-base' }, (res) => {
          const base = res?.base || 'http://127.0.0.1:7788';
          $('frame').src = `${chrome.runtime.getURL('preview.html')}?run=${ev.runId}&base=${encodeURIComponent(base)}`;
        });
        $('save').disabled = false;
        $('dl').disabled = false;
        setStatus('ready — click any line to edit it', false);
        
        $('progress-container').style.display = 'none';

        const compSub = $('complete-sub');
        if (compSub) {
          compSub.innerHTML = '';
          
          const detailsBox = el('div');
          detailsBox.style.width = '100%';
          detailsBox.style.textAlign = 'left';
          detailsBox.style.marginTop = '14px';
          detailsBox.style.marginBottom = '18px';
          detailsBox.style.display = 'flex';
          detailsBox.style.flexDirection = 'column';
          detailsBox.style.gap = '8px';
          detailsBox.style.padding = '12px';
          detailsBox.style.background = 'rgba(255, 255, 255, 0.03)';
          detailsBox.style.border = '1px solid rgba(255, 255, 255, 0.05)';
          detailsBox.style.borderRadius = '6px';
          detailsBox.style.fontSize = '12px';
          detailsBox.style.color = '#ececf1';
          
          const roleTitle = ev.run.jd?.title || 'this role';
          const roleCompany = ev.run.jd?.company ? ` at ${ev.run.jd.company}` : '';
          const roleEl = el('div');
          roleEl.innerHTML = `<strong>Target Role:</strong> <span style="color: #ff4d4d;">${roleTitle}${roleCompany}</span>`;
          
          const flaggedCount = ev.run.verification?.flagged?.length || 0;
          const rejectedCount = ev.run.verification?.rejected?.length || 0;
          const verificationEl = el('div');
          if (flaggedCount === 0 && rejectedCount === 0) {
            verificationEl.innerHTML = `<strong>Verification:</strong> <span style="color: #10b981;">✓ All facts match your CV</span>`;
          } else {
            verificationEl.innerHTML = `<strong>Verification:</strong> <span style="color: #ff4d4d;">⚠ ${flaggedCount + rejectedCount} issue(s) flagged</span>`;
          }
          
          const gapsCount = ev.run.gaps?.length || 0;
          const gapsEl = el('div');
          gapsEl.innerHTML = `<strong>Missing Skills:</strong> <span style="color: #acacbe;">${gapsCount} skill(s) excluded</span>`;
          
          const createdTime = new Date(ev.run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const timeEl = el('div');
          timeEl.innerHTML = `<strong>Generated At:</strong> <span style="color: #acacbe;">${createdTime}</span>`;
          
          detailsBox.append(roleEl, verificationEl, gapsEl, timeEl);
          compSub.append(detailsBox);
        }

        $('complete-container').style.display = 'flex';
      }
    });
    port.postMessage({
      type: 'tailor',
      payload: { jdText, url: location.href, title: document.title, ...llmOpts },
    });
    if (isRerun) lastData.jdText = jdText;
  }

  window.__fastCvOpen = () => {
    if (host) return;
    build();
    window.addEventListener('message', onFrameMessage);
    const jd = extractJd();
    lastData = { jdText: jd.text };
    
    if (jd.text && jd.text.length >= 80) {
      $('jd-input-box').value = jd.text;
    }
    $('role').textContent = jd.text ? `from ${jd.how}` : 'waiting for job description';
    checkServerHealth();
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'jw-open') window.__fastCvOpen();
  });

  window.__fastCvOpen();
})();
