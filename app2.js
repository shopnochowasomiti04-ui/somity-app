(function(){
/* ============================================================
   স্বপ্নছোঁয়া উন্নয়ন সমিতি — ওয়েব অ্যাপ (কোনো বিল্ড টুল ছাড়া সাধারণ JavaScript)
   নিরাপত্তা-নীতি:
   - শুধু publishable/anon key ব্যবহার হয়; service_role বা secret key এখানে কখনো নয়।
   - সব ব্যবহারকারী-ডেটা h`` টেমপ্লেটে স্বয়ংক্রিয়ভাবে escape হয় (XSS রোধ)।
   - আর্থিক সিদ্ধান্ত সব ডেটাবেস ফাংশনে (RPC); এখানে শুধু ফাংশন কল।
   ============================================================ */
'use strict';

const CFG = window.APP_CONFIG || {};
const ORG = { nameBn: 'স্বপ্নছোঁয়া উন্নয়ন সমিতি', slogan: 'একসাথে সঞ্চয়, একসাথে উন্নয়ন' };

/* ---------- লেবেল ---------- */
const L = {
  method: { bkash: 'বিকাশ', nagad: 'নগদ', bank_transfer: 'ব্যাংক ট্রান্সফার', cash: 'নগদ টাকা' },
  approval: { pending: 'যাচাই অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'বাতিল' },
  memberStatus: { active: 'সক্রিয়', inactive: 'নিষ্ক্রিয়', left: 'সদস্যপদ ত্যাগ' },
  committee: { president: 'সভাপতি', treasurer: 'কোষাধ্যক্ষ', general_secretary: 'সাধারণ সম্পাদক' },
  account: { bank: 'ব্যাংক', cash: 'নগদ' },
  income: { bank_interest: 'ব্যাংক সুদ বা মুনাফা', other_income: 'অন্যান্য অনুমোদিত আয়' },
  expense: { administrative: 'প্রশাসনিক খরচ', bank_charge: 'ব্যাংক চার্জ', association_activity: 'সমিতির কার্যক্রম', other_expense: 'অন্যান্য অনুমোদিত ব্যয়' },
  ledger: { deposit: 'জমা', opening_balance: 'প্রারম্ভিক জের', adjustment: 'সমন্বয়', reversal: 'রিভার্সাল' },
  notice: { general: 'সাধারণ নোটিশ', meeting: 'সভার ঘোষণা', deposit_reminder: 'মাসিক জমার স্মরণ', decision: 'গুরুত্বপূর্ণ সিদ্ধান্ত', emergency: 'জরুরি ঘোষণা' },
  perm: {
    manage_members: 'সদস্য ব্যবস্থাপনা', approve_deposits: 'জমা অনুমোদন/বাতিল', manage_finance: 'আয়-ব্যয় ও খতিয়ান সংশোধন',
    view_finance: 'সব সদস্যের আর্থিক হিসাব দেখা', publish_notices: 'নোটিশ প্রকাশ', manage_rules: 'নিয়মাবলি ও নীতি সম্পাদনা',
    view_audit: 'অডিট লগ দেখা', manage_admins: 'অ্যাডমিন অনুমতি ব্যবস্থাপনা',
  },
};
const COMMITTEE_ORDER = ['president', 'treasurer', 'general_secretary'];

/* ---------- বাংলা সংখ্যা/তারিখ/টাকা ---------- */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[+d]);
const fromBn = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${toBn(+m[3])} ${BN_MONTHS[+m[2] - 1]} ${toBn(m[1])}` : '—';
}
function formatDateTime(iso) {
  const d = new Date(iso || '');
  if (isNaN(d)) return '—';
  const dh = new Date(d.getTime() + 6 * 3600 * 1000); // বাংলাদেশ UTC+6
  let hr = dh.getUTCHours(); const mi = dh.getUTCMinutes();
  const per = hr < 4 ? 'রাত' : hr < 12 ? 'সকাল' : hr < 16 ? 'দুপুর' : hr < 18 ? 'বিকাল' : hr < 20 ? 'সন্ধ্যা' : 'রাত';
  hr = hr % 12 === 0 ? 12 : hr % 12;
  return `${toBn(dh.getUTCDate())} ${BN_MONTHS[dh.getUTCMonth()]} ${toBn(dh.getUTCFullYear())}, ${per} ${toBn(hr)}:${toBn(String(mi).padStart(2, '0'))}`;
}
function formatMonth(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '');
  return m ? `${BN_MONTHS[+m[2] - 1]} ${toBn(m[1])}` : '—';
}
const todayDhaka = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
function recentMonths(n = 18) {
  const t = todayDhaka(); let y = +t.slice(0, 4), m = +t.slice(5, 7); const out = [];
  for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, '0')}-01`); if (--m === 0) { m = 12; y--; } }
  return out;
}

/* টাকা: সব হিসাব পয়সায় (পূর্ণসংখ্যা)। ৳১ = ১০০ পয়সা; float নয়। */
function groupBd(s) {
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
}
function taka(p, signed) {
  if (p === null || p === undefined) return '—';
  const neg = p < 0, a = Math.abs(p), w = Math.floor(a / 100), f = a % 100;
  const body = groupBd(String(w)) + (f ? '.' + String(f).padStart(2, '0') : '');
  return `${neg ? '−' : signed && p > 0 ? '+' : ''}৳ ${toBn(body)}`;
}
function parseTaka(input) {
  const s = fromBn(input).replace(/[,\s৳]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  const p = Number(w) * 100 + Number((f + '00').slice(0, 2));
  return Number.isSafeInteger(p) && p > 0 ? p : null;
}
function parseSignedTaka(input) {
  const t = fromBn(input).trim(); const neg = t.startsWith('-') || t.startsWith('−');
  const v = parseTaka(neg ? t.slice(1) : t);
  return v === null ? null : neg ? -v : v;
}
function paisaToInput(p) {
  if (!p) return '';
  const w = Math.floor(p / 100), f = p % 100;
  return f ? `${w}.${String(f).padStart(2, '0')}` : String(w);
}

/* ---------- নিরাপদ HTML টেমপ্লেট ---------- */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]);
function toHtml(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}
function h(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += toHtml(vals[i]) + strings[i + 1];
  return new Raw(out);
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- স্টোরেজ (ব্যর্থ হলেও অ্যাপ চলবে) ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ---------- Supabase REST ক্লায়েন্ট (publishable key + ব্যবহারকারীর টোকেন) ---------- */
class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}
let session = null;
try { session = JSON.parse(store.get('sus.session') || 'null'); } catch { session = null; }
const authListeners = [];
function setSession(s) {
  session = s;
  if (s) store.set('sus.session', JSON.stringify(s)); else store.del('sus.session');
  authListeners.forEach((f) => f(s));
}
function keyProblem() {
  const k = CFG.SUPABASE_KEY || '';
  if (/^sb_secret_/i.test(k)) return 'secret';
  try { if (k.split('.').length === 3 && JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') return 'secret'; } catch { /* JWT নয় */ }
  return k.length < 20 || /YOUR/i.test(k) ? 'missing' : null;
}
const configured = () => !keyProblem() && !/YOUR/i.test(CFG.SUPABASE_URL || '') && (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(CFG.SUPABASE_URL || '') || /^http:\/\/localhost:\d+$/.test(CFG.SUPABASE_URL || ''));

function friendly(status, body) {
  const msg = (body && (body.message || body.msg || body.error_description || body.error)) || '';
  const code = body && (body.error_code || body.code);
  if (code === 'invalid_credentials') return 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।';
  if (code === 'user_already_exists') return 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা আছে।';
  if (code === 'weak_password') return 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।';
  if (code === 'email_not_confirmed') return 'ইমেইল যাচাই বাকি আছে।';
  if (code === 'over_email_send_rate_limit' || status === 429) return 'অল্প সময়ে অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
  if (status === 401) return 'আপনার সেশনের মেয়াদ শেষ। আবার লগইন করুন।';
  if (status === 403 || code === '42501') return 'এই কাজের অনুমতি আপনার নেই।';
  if (code === '23505') return 'এই তথ্য আগে থেকেই আছে।';
  if (status >= 500) return 'সার্ভারে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';
  // ডেটাবেস ফাংশনের নিজস্ব (বাংলা) বার্তা সরাসরি দেখানো হয়
  if (msg && /[ঀ-৿]/.test(msg)) return msg;
  return msg ? 'কাজটি সম্পন্ন হয়নি। (' + String(msg).slice(0, 120) + ')' : 'কাজটি সম্পন্ন হয়নি।';
}

async function http(method, path, { body, headers = {}, token = true, blob = false } = {}) {
  if (!configured()) throw new ApiError('অ্যাপ এখনো সংযোগের জন্য প্রস্তুত নয় (config.js ফাইল দেখুন)।', 0, 'noconfig');
  if (token && session && session.expires_at - Date.now() / 1000 < 60 && !path.startsWith('/auth/v1/token')) await refreshSession();
  const hd = { apikey: CFG.SUPABASE_KEY, ...headers };
  if (token && session) hd.Authorization = 'Bearer ' + session.access_token;
  let payload = body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { payload = JSON.stringify(body); hd['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(CFG.SUPABASE_URL + path, { method, headers: hd, body: payload }); }
  catch { throw new ApiError('ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ দেখে আবার চেষ্টা করুন।', 0, 'network'); }
  if (blob) return res;
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    if (res.status === 401 && token && session && !path.startsWith('/auth/')) setSession(null);
    throw new ApiError(friendly(res.status, data), res.status, data && (data.error_code || data.code));
  }
  return { data, res };
}

let refreshing = null;
function refreshSession() {
  if (!session) return Promise.resolve();
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const { data } = await http('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token }, token: false });
        setSession(data);
      } catch (e) {
        if (e.status === 400 || e.status === 401) setSession(null); // রিফ্রেশ বৈধ নয় → লগআউট
        throw e;
      } finally { refreshing = null; }
    })();
  }
  return refreshing;
}

const Auth = {
  async signIn(email, password) {
    const { data } = await http('POST', '/auth/v1/token?grant_type=password', { body: { email: email.trim().toLowerCase(), password }, token: false });
    setSession(data);
  },
  async signUp({ email, password, fullName, phone }) {
    const { data } = await http('POST', '/auth/v1/signup', { body: { email: email.trim().toLowerCase(), password, data: { full_name: fullName.trim(), phone: phone.trim() } }, token: false });
    if (data && data.access_token) { setSession(data); return { needsConfirm: false }; }
    return { needsConfirm: true };
  },
  async signOut() {
    try { await http('POST', '/auth/v1/logout', {}); } catch { /* ignore */ }
    setSession(null);
  },
  async changePassword(password) { await http('PUT', '/auth/v1/user', { body: { password } }); },
};

const qs = (o) => Object.entries(o || {}).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const db = {
  async select(table, { select = '*', filter = {}, order, limit, offset } = {}) {
    const p = { select, ...filter };
    if (order) p.order = order;
    if (limit) p.limit = limit;
    if (offset) p.offset = offset;
    return (await http('GET', `/rest/v1/${table}?${qs(p)}`)).data;
  },
  async count(table, filter = {}) {
    const { res } = await http('GET', `/rest/v1/${table}?${qs({ select: 'id', limit: 1, ...filter })}`, { headers: { Prefer: 'count=exact' } });
    const m = /\/(\d+)$/.exec(res.headers.get('Content-Range') || '');
    return m ? +m[1] : 0;
  },
  async insert(table, row) { await http('POST', `/rest/v1/${table}`, { body: row, headers: { Prefer: 'return=minimal' } }); },
  async update(table, filter, patch) { await http('PATCH', `/rest/v1/${table}?${qs(filter)}`, { body: patch, headers: { Prefer: 'return=minimal' } }); },
  async rpc(fn, args) { return (await http('POST', `/rest/v1/rpc/${fn}`, { body: args || {} })).data; },
};

/* ---------- ছবি/ফাইল ---------- */
const signedCache = new Map();
async function signedUrl(bucket, path) {
  const key = bucket + '/' + path, hit = signedCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await http('POST', `/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { body: { expiresIn: 3600 } });
  const url = CFG.SUPABASE_URL + '/storage/v1' + data.signedURL;
  signedCache.set(key, { url, exp: Date.now() + 50 * 60 * 1000 });
  return url;
}
/** ছবি বাছাই → ক্যানভাসে ছোট করা (সর্বোচ্চ ১৬০০px, JPEG) → Blob। বড় ফাইল আপলোড না করার ব্যবস্থা। */
function resizeImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('শুধু ছবি (JPG/PNG) বাছাই করুন।'));
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('ছবিটি প্রস্তুত করা যায়নি।')); }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ছবিটি খোলা যায়নি।')); };
    img.src = url;
  });
}
async function uploadBlob(bucket, path, blob) {
  try {
    await http('POST', `/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { body: blob, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' } });
  } catch (e) {
    throw new ApiError('ছবি আপলোড করা যায়নি। ইন্টারনেট ও ফাইলের আকার (সর্বোচ্চ ৫ MB) পরীক্ষা করুন।', e.status, e.code);
  }
  return path;
}

/* ---------- ছোট UI সহায়ক ---------- */
const ACTIONS = {};   // data-act="name"
const SUBMITS = {};   // <form data-submit="name">
const CHANGES = {};   // data-change="name"

function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}
const spinner = () => h`<div class="loading" role="status" aria-live="polite"><span class="spin"></span> লোড হচ্ছে…</div>`;
const errorBox = (msg) => h`<div class="card err"><p>${msg}</p><button class="btn outline" data-act="reload">আবার চেষ্টা করুন</button></div>`;
const empty = (msg) => h`<div class="card muted center">${msg}</div>`;
const badge = (label, tone = 'gray') => h`<span class="badge ${tone}">${label}</span>`;
const statusTone = { pending: 'warn', approved: 'ok', rejected: 'bad', active: 'ok', inactive: 'warn', left: 'bad' };

function field({ label, name, type = 'text', value = '', placeholder = '', required = false, hint = '', inputmode = '', autocomplete = '', maxlength = '' }) {
  return h`<label class="field"><span>${label}${required ? raw(' <em>*</em>') : ''}</span>
    <input name="${name}" type="${type}" value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''} ${inputmode ? raw(`inputmode="${esc(inputmode)}"`) : ''} ${autocomplete ? raw(`autocomplete="${esc(autocomplete)}"`) : ''} ${maxlength ? raw(`maxlength="${+maxlength}"`) : ''}>
    ${hint ? h`<small>${hint}</small>` : ''}</label>`;
}
function selectField({ label, name, options, value = '', required = false }) {
  return h`<label class="field"><span>${label}${required ? raw(' <em>*</em>') : ''}</span>
    <select name="${name}" ${required ? 'required' : ''}>${options.map(([v, t]) => h`<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`)}</select></label>`;
}
function textArea({ label, name, value = '', rows = 4, required = false, maxlength = 2000 }) {
  return h`<label class="field"><span>${label}${required ? raw(' <em>*</em>') : ''}</span><textarea name="${name}" rows="${rows}" maxlength="${maxlength}" ${required ? 'required' : ''}>${value}</textarea></label>`;
}

/** মডাল: কারণ/নিশ্চিতকরণ ইত্যাদি। onSubmit(values) → Promise; ত্রুটি হলে মডালেই দেখায়। */
function openModal({ title, body, submitLabel = 'নিশ্চিত করুন', danger = false, onSubmit }) {
  closeModal();
  const wrap = document.createElement('div'); wrap.className = 'modal-bg'; wrap.id = 'modal';
  wrap.innerHTML = toHtml(h`<form class="modal card" novalidate role="dialog" aria-modal="true" aria-label="${title}">
    <h3>${title}</h3>${body}<p class="errmsg" role="alert"></p>
    <div class="row gap"><button type="button" class="btn outline" data-act="modal-close">বাতিল</button>
    <button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${submitLabel}</button></div></form>`);
  document.body.appendChild(wrap);
  const form = $('form', wrap);
  const first = $('input,textarea,select', form); if (first) first.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form), err = $('.errmsg', form);
    btn.disabled = true; err.textContent = '';
    try { await onSubmit(Object.fromEntries(new FormData(form).entries())); closeModal(); }
    catch (ex) { err.textContent = ex.message || 'কাজটি সম্পন্ন হয়নি।'; btn.disabled = false; }
  });
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
ACTIONS['modal-close'] = closeModal;

/** আয়-ব্যয়/টেবিলের মতো ছোট সারি */
const kv = (k, v) => h`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
const sectionTitle = (t) => h`<h2 class="sec">${t}</h2>`;

/** বিষয়বস্তু লোড করতে ছোট ক্যাশবিহীন সহায়ক: ত্রুটি হলে errorBox */
async function safe(fn) {
  try { return await fn(); } catch (e) { return errorBox(e.message || 'কিছু একটা ভুল হয়েছে।'); }
}
/* ---------- অ্যাপ কাঠামো: অবস্থা, রাউটার, লগইন, মেনু, হোম ---------- */
const S = { ctx: null };
const isAdmin = () => S.ctx && S.ctx.role === 'admin';
const can = (p) => isAdmin() && (S.ctx.permissions || []).includes(p);
const hasMember = () => !!(S.ctx && S.ctx.member);

const ROUTES = [];
function route(pattern, fn, need) {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  ROUTES.push({ re, keys, fn, need });
}
const go = (path) => { location.hash = '#' + path; };
let renderToken = 0;

async function renderRoute() {
  const view = $('#view'); if (!view) return;
  const path = decodeURIComponent((location.hash || '#/').slice(1).split('?')[0]) || '/';
  const token = ++renderToken;
  for (const r of ROUTES) {
    const m = r.re.exec(path); if (!m) continue;
    if (r.need && !r.need()) { view.innerHTML = toHtml(h`<div class="card err"><p>এই পাতা দেখার অনুমতি আপনার নেই।</p><a class="btn outline" href="#/">হোমে ফিরুন</a></div>`); markNav(path); return; }
    const params = {}; r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    view.innerHTML = toHtml(spinner()); markNav(path);
    const html = await safe(() => r.fn(params));
    if (token !== renderToken) return; // মাঝপথে অন্য পাতায় গেলে পুরনো ফলাফল বাদ
    view.innerHTML = toHtml(html);
    window.scrollTo(0, 0);
    const first = $('h1', view); if (first) document.title = first.textContent + ' — ' + ORG.nameBn;
    return;
  }
  view.innerHTML = toHtml(h`<div class="card"><p>পাতাটি পাওয়া যায়নি।</p><a class="btn outline" href="#/">হোমে ফিরুন</a></div>`);
}
ACTIONS.reload = () => renderRoute();

function tabsFor() {
  const T = (to, icon, label) => ({ to, icon, label });
  const home = T('/', '🏠', 'হোম'), more = T('/more', '☰', 'আরও');
  if (can('approve_deposits')) return [home, T('/approvals', '✅', 'জমা যাচাই'), T('/finance', '⇅', 'আয়-ব্যয়'), ...(can('view_finance') ? [T('/reports', '📊', 'রিপোর্ট')] : [T('/notices', '📢', 'নোটিশ')]), more];
  if (hasMember()) return [home, T('/account', '👛', 'আমার হিসাব'), T('/deposit-new', '➕', 'নতুন জমা'), T('/finance', '⇅', 'আয়-ব্যয়'), more];
  return [home, T('/finance', '⇅', 'আয়-ব্যয়'), T('/notices', '📢', 'নোটিশ'), more];
}
function markNav(path) {
  $$('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.to === path || (a.dataset.to !== '/' && path.startsWith(a.dataset.to + '/'))));
}

const logo = (size = 40) => h`<img class="logo" src="logo-192.png" width="${size}" height="${size}" alt="স্বপ্নছোঁয়া লোগো">`;

function renderShell() {
  $('#root').innerHTML = toHtml(h`
    <header class="top"><a class="brand" href="#/">${logo(36)}<span>${ORG.nameBn}</span></a>
      <a class="bell" href="#/notifications" aria-label="বিজ্ঞপ্তি">🔔<b id="unread" hidden></b></a></header>
    <main id="view" tabindex="-1"></main>
    <nav id="tabs" aria-label="প্রধান মেনু">${tabsFor().map((t) => h`<a href="#${t.to}" data-to="${t.to}"><i aria-hidden="true">${t.icon}</i><span>${t.label}</span></a>`)}</nav>`);
}
async function refreshUnread() {
  try {
    const n = await db.count('notifications', { read_at: 'is.null' });
    const b = $('#unread'); if (b) { b.hidden = n === 0; b.textContent = toBn(n > 99 ? '৯৯+' : n); }
  } catch { /* বিজ্ঞপ্তি না এলেও অ্যাপ চলবে */ }
}

/* ---------- লগইন / নতুন অ্যাকাউন্ট ---------- */
let authMode = 'in', authMsg = null;
function loginView() {
  const up = authMode === 'up';
  return h`<div class="auth"><div class="hero">${logo(96)}<h1>${ORG.nameBn}</h1><p class="gold">${ORG.slogan}</p></div>
    <form class="card" data-submit="auth" novalidate>
      <div class="row gap seg"><button type="button" class="btn ${up ? 'outline' : 'primary'}" data-act="auth-mode" data-mode="in">প্রবেশ করুন</button>
        <button type="button" class="btn ${up ? 'primary' : 'outline'}" data-act="auth-mode" data-mode="up">নতুন অ্যাকাউন্ট</button></div>
      ${up ? h`${field({ label: 'পূর্ণ নাম', name: 'fullName', required: true, autocomplete: 'name' })}
        ${field({ label: 'মোবাইল নম্বর (ঐচ্ছিক)', name: 'phone', type: 'tel', inputmode: 'tel', placeholder: '০১XXXXXXXXX', autocomplete: 'tel' })}` : ''}
      ${field({ label: 'ইমেইল', name: 'email', type: 'email', required: true, autocomplete: 'email', placeholder: 'name@example.com' })}
      ${field({ label: 'পাসওয়ার্ড', name: 'password', type: 'password', required: true, autocomplete: up ? 'new-password' : 'current-password', hint: up ? 'অন্তত ৬ অক্ষর' : '' })}
      <p class="errmsg" role="alert">${authMsg && authMsg.kind === 'err' ? authMsg.text : ''}</p>
      ${authMsg && authMsg.kind === 'ok' ? h`<p class="okmsg" role="status">${authMsg.text}</p>` : ''}
      <button class="btn gold" type="submit">${up ? 'অ্যাকাউন্ট খুলুন' : 'প্রবেশ'}</button>
      ${up ? h`<small class="muted">অ্যাকাউন্ট খোলার পর সমিতির অ্যাডমিন আপনাকে সদস্য তালিকার সাথে যুক্ত করলে তবেই হিসাব ও তথ্য দেখতে পাবেন।</small>` : ''}
    </form></div>`;
}
function showLogin() { $('#root').innerHTML = toHtml(loginView()); document.title = ORG.nameBn; }
ACTIONS['auth-mode'] = (t) => { authMode = t.dataset.mode; authMsg = null; showLogin(); };
SUBMITS.auth = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries());
  const fail = (text) => { authMsg = { kind: 'err', text }; $('.errmsg', form).textContent = text; };
  authMsg = null;
  if (!/^\S+@\S+\.\S+$/.test((f.email || '').trim())) return fail('সঠিক ইমেইল দিন।');
  if ((f.password || '').length < 6) return fail('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।');
  if (authMode === 'up' && (f.fullName || '').trim().length < 2) return fail('আপনার পূর্ণ নাম লিখুন।');
  const btn = $('button[type=submit]', form); btn.disabled = true;
  try {
    if (authMode === 'in') await Auth.signIn(f.email, f.password);
    else {
      const r = await Auth.signUp({ email: f.email, password: f.password, fullName: f.fullName, phone: f.phone || '' });
      if (r.needsConfirm) { authMode = 'in'; authMsg = { kind: 'ok', text: 'অ্যাকাউন্ট তৈরি হয়েছে। ইমেইলে পাঠানো লিংকে যাচাই করে প্রবেশ করুন।' }; showLogin(); }
    }
  } catch (e) { fail(e.message); btn.disabled = false; }
};

/* ---------- সদস্য তালিকার সাথে যুক্ত না থাকলে ---------- */
function statusView() {
  const m = S.ctx && S.ctx.member;
  return h`<div class="auth"><div class="hero">${logo(72)}<h1>${ORG.nameBn}</h1></div>
    <div class="card"><h2>${m ? 'আপনার সদস্যপদ সক্রিয় নয়' : 'অ্যাডমিনের অনুমোদনের অপেক্ষায়'}</h2>
      <p>${m ? `আপনার বর্তমান অবস্থা: ${L.memberStatus[m.status] || m.status}। বিস্তারিত জানতে সমিতির কমিটির সাথে যোগাযোগ করুন।`
        : 'আপনার অ্যাকাউন্ট এখনো সমিতির সদস্য তালিকার সাথে যুক্ত হয়নি। সভাপতি/কোষাধ্যক্ষ/সাধারণ সম্পাদককে আপনার ইমেইল জানান; তারা যুক্ত করে দিলে এখানে "আবার দেখুন" চাপুন।'}</p>
      <button class="btn primary" data-act="recheck">আবার দেখুন</button>
      <button class="btn outline" data-act="logout">লগআউট</button></div></div>`;
}
ACTIONS.recheck = async () => { await loadContext(); startApp(); };
ACTIONS.logout = async () => { await Auth.signOut(); };

async function loadContext() {
  try { S.ctx = await db.rpc('my_context'); } catch (e) { S.ctx = null; if (e.status === 401) setSession(null); }
}
function startApp() {
  if (!session) { S.ctx = null; return showLogin(); }
  if (!S.ctx) { $('#root').innerHTML = toHtml(errorBox('আপনার তথ্য লোড করা যায়নি।')); return; }
  const active = isAdmin() || (S.ctx.member && S.ctx.member.status === 'active');
  if (!active) { $('#root').innerHTML = toHtml(statusView()); return; }
  renderShell(); renderRoute(); refreshUnread();
}

/* ---------- হোম ---------- */
const stat = (label, value, accent) => h`<div class="stat ${accent ? 'accent' : ''}"><small>${label}</small><b>${value}</b></div>`;

route('/', async () => {
  const [summary, notices, sav, inc, exp, mems] = await Promise.all([
    db.rpc('dashboard_summary'),
    db.select('notices', { select: 'id,title,kind,published_at', filter: { is_published: 'eq.true' }, order: 'published_at.desc', limit: 1 }),
    db.select('savings_transactions', { select: 'id,member_id,entry_date,entry_type,amount_paisa', order: 'created_at.desc', limit: 6 }),
    db.select('income_transactions', { select: 'id,entry_date,category,amount_paisa,description', order: 'created_at.desc', limit: 6 }),
    db.select('expense_transactions', { select: 'id,entry_date,category,amount_paisa,description', order: 'created_at.desc', limit: 6 }),
    db.select('members', { select: 'id,full_name' }).catch(() => []),
  ]);
  const names = Object.fromEntries(mems.map((m) => [m.id, m.full_name]));
  const recent = [
    ...sav.map((r) => ({ key: 's' + r.id, date: r.entry_date, label: `সঞ্চয়${names[r.member_id] ? ' — ' + names[r.member_id] : ''}`, sub: L.ledger[r.entry_type] || r.entry_type, p: r.amount_paisa })),
    ...inc.map((r) => ({ key: 'i' + r.id, date: r.entry_date, label: `আয় — ${L.income[r.category] || r.category}`, sub: r.description, p: r.amount_paisa })),
    ...exp.map((r) => ({ key: 'e' + r.id, date: r.entry_date, label: `ব্যয় — ${L.expense[r.category] || r.category}`, sub: r.description, p: -r.amount_paisa })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const s = summary, n = notices[0];
  const name = (S.ctx.member && S.ctx.member.full_name) || S.ctx.full_name || '';
  return h`<h1 class="sr">হোম</h1>
    <section class="card hero-card">${logo(64)}<h2>${ORG.nameBn}</h2><p class="gold">${ORG.slogan}</p><p>স্বাগতম, ${name}</p></section>
    ${hasMember() ? h`<a class="btn gold block" href="#/deposit-new">নতুন জমা যোগ করুন</a>` : ''}
    ${can('approve_deposits') && s.pending_deposit_count > 0 ? h`<a class="card warnbox" href="#/approvals"><b>${toBn(s.pending_deposit_count)}টি জমার অনুরোধ যাচাইয়ের অপেক্ষায় — দেখুন</b></a>` : ''}
    ${sectionTitle('সমিতির সারসংক্ষেপ')}
    <div class="grid2">
      ${stat('সক্রিয় সদস্য', `${toBn(s.active_members)} জন`)}${stat('মোট অনুমোদিত সঞ্চয়', taka(s.total_savings_paisa), true)}
      ${stat('মোট আয়', taka(s.total_income_paisa))}${stat('মোট ব্যয়', taka(s.total_expense_paisa))}
      ${stat('ব্যাংক ব্যালেন্স', taka(s.bank_balance_paisa))}${stat('নগদ ব্যালেন্স', taka(s.cash_balance_paisa))}
      ${stat('মোট বকেয়া', s.total_dues_paisa === null ? 'নির্ধারিত হয়নি' : taka(s.total_dues_paisa))}
      ${stat('অপেক্ষমাণ জমার অনুরোধ', `${toBn(s.pending_deposit_count)}টি`)}
    </div>
    ${s.dues_members_without_commitment > 0 ? h`<p class="muted small">বকেয়া শুধু সেই সদস্যদের জন্য গণনা হয় যাদের মাসিক সঞ্চয়ের অঙ্ক নির্ধারিত আছে (${toBn(s.dues_members_without_commitment)} জনের অঙ্ক নির্ধারিত নেই)।</p>` : ''}
    ${n ? h`${sectionTitle('সর্বশেষ নোটিশ')}<a class="card" href="#/notices"><div class="row between">${badge(L.notice[n.kind] || n.kind, n.kind === 'emergency' ? 'bad' : 'gold')}<small class="muted">${formatDate(n.published_at)}</small></div><b>${n.title}</b></a>` : ''}
    ${recent.length ? h`${sectionTitle('সাম্প্রতিক লেনদেন')}<div class="card list">${recent.map((r) => h`<div class="li"><div><b>${r.label}</b><small class="muted">${formatDate(r.date)} · ${r.sub}</small></div><b class="${r.p < 0 ? 'neg' : 'pos'}">${taka(r.p, true)}</b></div>`)}</div>` : ''}`;
});

/* ---------- আরও (মেনু) ---------- */
route('/more', async () => {
  const item = (icon, title, to) => ({ icon, title, to });
  const common = [
    ...(hasMember() ? [item('👛', 'আমার হিসাব', '/account'), item('➕', 'নতুন জমা যোগ করুন', '/deposit-new')] : []),
    item('⇅', 'আয়-ব্যয়', '/finance'), ...(can('view_finance') ? [item('📊', 'রিপোর্ট', '/reports')] : []), item('🔔', 'বিজ্ঞপ্তি', '/notifications'),
    item('📢', 'নোটিশ বোর্ড', '/notices'), item('👥', 'আমাদের পরিচিতি', '/about'), item('📖', 'গঠনতন্ত্র ও নিয়মাবলি', '/rules'), item('👤', 'প্রোফাইল', '/profile'),
  ];
  const admin = [
    ...(can('approve_deposits') ? [item('✅', 'জমা যাচাই (অনুমোদন/বাতিল)', '/approvals')] : []),
    ...(can('manage_members') ? [item('🧑‍🤝‍🧑', 'সদস্য ব্যবস্থাপনা', '/members')] : []),
    ...(can('manage_finance') ? [item('✍️', 'আয়-ব্যয় এন্ট্রি ও সংশোধন', '/finance-entry')] : []),
    ...(can('manage_admins') ? [item('🛡️', 'অ্যাডমিন অনুমতি', '/admins')] : []),
    ...(can('view_audit') ? [item('📜', 'অডিট লগ', '/audit')] : []),
  ];
  const list = (items) => h`<div class="card list menu">${items.map((i) => h`<a class="li" href="#${i.to}"><span><i aria-hidden="true">${i.icon}</i> ${i.title}</span><span aria-hidden="true">›</span></a>`)}</div>`;
  return h`<h1>আরও</h1>${sectionTitle('সাধারণ')}${list(common)}${admin.length ? h`${sectionTitle('প্রশাসন')}${list(admin)}` : ''}
    <button class="btn outline block" data-act="logout">লগআউট</button>`;
});

/* ---------- ইভেন্ট ডেলিগেশন (inline handler নয়; CSP-সম্মত) ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const fn = ACTIONS[t.dataset.act]; if (!fn) return;
  e.preventDefault(); Promise.resolve(fn(t, e)).catch((ex) => toast(ex.message || 'কাজটি সম্পন্ন হয়নি।', 'bad'));
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-submit]'); if (!f) return;
  e.preventDefault();
  const fn = SUBMITS[f.dataset.submit]; if (fn) Promise.resolve(fn(f, e)).catch((ex) => toast(ex.message || 'কাজটি সম্পন্ন হয়নি।', 'bad'));
});
document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-change]'); if (!t) return;
  const fn = CHANGES[t.dataset.change]; if (fn) Promise.resolve(fn(t, e)).catch((ex) => toast(ex.message || 'কাজটি সম্পন্ন হয়নি।', 'bad'));
});
window.addEventListener('hashchange', () => { if (S.ctx && $('#view')) { renderRoute(); refreshUnread(); } });

/* ---------- সদস্যের পাতা: আমার হিসাব, নতুন জমা, প্রোফাইল ---------- */
const needMember = () => hasMember();

ACTIONS['show-receipt'] = async (t) => {
  const url = await signedUrl(t.dataset.bucket || 'receipts', t.dataset.path);
  openModal({ title: 'রশিদ', body: h`<img class="thumb" src="${url}" alt="রশিদের ছবি">`, submitLabel: 'বন্ধ করুন', onSubmit: async () => {} });
};
ACTIONS.print = () => window.print();

const depositCard = (d, who) => h`<div class="card">
  <div class="row between wrap"><b>${taka(d.amount_paisa)}</b>${badge(L.approval[d.status] || d.status, statusTone[d.status])}</div>
  ${who ? h`<div>${who}</div>` : ''}
  <small class="muted">${formatMonth(d.for_month)} মাসের · ${L.method[d.payment_method] || d.payment_method} · জমার তারিখ ${formatDate(d.deposit_date)}</small>
  ${d.transaction_ref ? h`<small class="muted">রেফারেন্স: ${d.transaction_ref}</small>` : ''}
  ${d.notes ? h`<small class="muted">নোট: ${d.notes}</small>` : ''}
  <small class="muted">জমা দেওয়া: ${formatDateTime(d.submitted_at)}</small>
  ${d.status === 'rejected' && d.rejection_reason ? h`<p class="neg">বাতিলের কারণ: ${d.rejection_reason}</p>` : ''}
  ${d.receipt_path ? h`<button class="btn outline small noprint" data-act="show-receipt" data-path="${d.receipt_path}">রশিদ দেখুন</button>` : ''}
</div>`;

route('/account', async () => {
  const mid = S.ctx.member.id;
  const [bal, dues, st, deps] = await Promise.all([
    db.select('member_balances', { filter: { member_id: `eq.${mid}` } }),
    db.rpc('my_dues_paisa'),
    db.rpc('my_statement', { p_from: null, p_to: null }),
    db.select('deposit_requests', { filter: { member_id: `eq.${mid}` }, order: 'submitted_at.desc', limit: 200 }),
  ]);
  const b = bal[0] || { savings_paisa: 0, pending_paisa: 0, rejected_paisa: 0 };
  const m = S.ctx.member;
  return h`<h1>আমার হিসাব</h1>
    <div class="card"><b>${m.full_name}</b><br><small class="muted">সদস্য আইডি: ${m.membership_no} · যোগদান: ${formatDate(m.joined_on)}</small></div>
    <div class="grid2">
      ${stat('অনুমোদিত সঞ্চয়', taka(b.savings_paisa), true)}${stat('বকেয়া', dues === null ? 'নির্ধারিত হয়নি' : taka(dues))}
      ${stat('যাচাই অপেক্ষমাণ', taka(b.pending_paisa))}${stat('বাতিল হওয়া', taka(b.rejected_paisa))}
    </div>
    <p class="muted small">অপেক্ষমাণ ও বাতিল জমা আপনার সঞ্চয়ে ধরা হয় না; অ্যাডমিন অনুমোদন করলেই সঞ্চয়ে যোগ হয়।</p>
    <div class="row gap noprint"><a class="btn gold" href="#/deposit-new">নতুন জমা</a><button class="btn outline" data-act="print">স্টেটমেন্ট প্রিন্ট / PDF</button></div>
    ${st.monthly && st.monthly.length ? h`${sectionTitle('মাসওয়ারি সঞ্চয়')}<div class="card list">${st.monthly.map((x) => h`<div class="li"><span>${formatMonth(x.month)}</span><b>${taka(x.amount_paisa)}</b></div>`)}</div>` : ''}
    ${sectionTitle('অনুমোদিত লেনদেন')}
    ${st.entries.length ? h`<div class="card list">${st.entries.map((e) => h`<div class="li"><div><b>${L.ledger[e.type] || e.type}</b><small class="muted">${formatDate(e.date)}${e.for_month ? ' · ' + formatMonth(e.for_month) : ''}${e.method ? ' · ' + (L.method[e.method] || '') : ''}${e.reason ? ' · ' + e.reason : ''}</small></div><b class="${e.amount_paisa < 0 ? 'neg' : 'pos'}">${taka(e.amount_paisa, true)}</b></div>`)}</div>` : empty('এখনো কোনো অনুমোদিত লেনদেন নেই।')}
    ${sectionTitle('আমার জমার অনুরোধ')}
    ${deps.length ? deps.map((d) => depositCard(d)) : empty('এখনো কোনো জমা দেননি।')}`;
}, needMember);

/* ---------- নতুন জমা ---------- */
let receiptBlob = null, receiptPreview = null;
CHANGES.receipt = async (t) => {
  const box = $('#receipt-prev'); receiptBlob = null;
  if (receiptPreview) { URL.revokeObjectURL(receiptPreview); receiptPreview = null; }
  if (!t.files[0]) { box.innerHTML = ''; return; }
  try {
    receiptBlob = await resizeImage(t.files[0]); receiptPreview = URL.createObjectURL(receiptBlob);
    box.innerHTML = toHtml(h`<img class="thumb" src="${receiptPreview}" alt="রশিদের প্রিভিউ"><small class="muted">${toBn(Math.round(receiptBlob.size / 1024))} KB</small>`);
  } catch (e) { box.innerHTML = ''; t.value = ''; toast(e.message, 'bad'); }
};
route('/deposit-new', async () => {
  receiptBlob = null;
  return h`<h1>নতুন জমা</h1>
    <form class="card" data-submit="deposit" novalidate>
      ${field({ label: 'জমার পরিমাণ (টাকা)', name: 'amount', required: true, inputmode: 'decimal', placeholder: 'যেমন ১০০০' })}
      ${field({ label: 'জমার তারিখ', name: 'date', type: 'date', value: todayDhaka(), required: true })}
      ${selectField({ label: 'কোন মাসের জমা', name: 'month', options: recentMonths(18).map((m) => [m, formatMonth(m)]), required: true })}
      ${selectField({ label: 'পেমেন্ট মাধ্যম', name: 'method', options: Object.entries(L.method), required: true })}
      ${field({ label: 'ট্রানজেকশন আইডি / রেফারেন্স', name: 'ref', maxlength: 80, hint: 'বিকাশ, নগদ বা ব্যাংকের ক্ষেত্রে আবশ্যক; নগদ টাকায় না দিলেও চলে।' })}
      <label class="field"><span>রশিদ বা স্ক্রিনশট (ঐচ্ছিক ছবি)</span><input type="file" accept="image/*" data-change="receipt"></label>
      <div id="receipt-prev"></div>
      ${textArea({ label: 'নোট (ঐচ্ছিক)', name: 'notes', rows: 2, maxlength: 300 })}
      <p class="errmsg" role="alert"></p>
      <button class="btn gold block" type="submit">জমা দিন</button>
      <small class="muted">জমা দেওয়ার পর অ্যাডমিন যাচাই করে অনুমোদন করলে তবেই আপনার সঞ্চয়ে যোগ হবে।</small>
    </form>`;
}, needMember);
SUBMITS.deposit = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); const err = $('.errmsg', form);
  const fail = (m) => { err.textContent = m; };
  err.textContent = '';
  const paisa = parseTaka(f.amount || '');
  if (paisa === null) return fail('সঠিক টাকার অঙ্ক লিখুন (যেমন ১০০০ বা ১০০০.৫০)।');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) return fail('জমার তারিখ দিন।');
  if (f.date > todayDhaka()) return fail('ভবিষ্যতের তারিখ দেওয়া যাবে না।');
  if (f.method !== 'cash' && !(f.ref || '').trim()) return fail('ট্রানজেকশন আইডি / রেফারেন্স দিন।');
  const btn = $('button[type=submit]', form); btn.disabled = true;
  try {
    let path = null;
    if (receiptBlob) path = await uploadBlob('receipts', `${S.ctx.user_id}/${Date.now()}.jpg`, receiptBlob);
    await db.rpc('submit_deposit', {
      p_amount_paisa: paisa, p_deposit_date: f.date, p_for_month: f.month, p_method: f.method,
      p_transaction_ref: (f.ref || '').trim() || null, p_receipt_path: path, p_notes: (f.notes || '').trim() || null,
    });
    toast('জমার অনুরোধ জমা হয়েছে। অ্যাডমিনের যাচাইয়ের অপেক্ষায়।'); go('/account');
  } catch (e) { fail(e.message); btn.disabled = false; }
};

/* ---------- প্রোফাইল ---------- */
route('/profile', async () => {
  const m = S.ctx.member;
  const roleTxt = isAdmin() ? 'অ্যাডমিন' : 'সদস্য';
  return h`<h1>প্রোফাইল</h1>
    <div class="card">
      ${kv('নাম', (m && m.full_name) || S.ctx.full_name || '—')}${kv('ভূমিকা', roleTxt)}
      ${m ? h`${kv('সদস্য আইডি', m.membership_no)}${kv('যোগদান', formatDate(m.joined_on))}${kv('ঠিকানা', m.address || '—')}${kv('মোবাইল', m.phone || '—')}
        ${kv('মাসিক সঞ্চয়ের অঙ্ক', m.monthly_commitment_paisa === null ? 'নির্ধারিত হয়নি' : taka(m.monthly_commitment_paisa))}` : ''}
      ${isAdmin() ? kv('অনুমতি', (S.ctx.permissions || []).map((p) => L.perm[p] || p).join('، ') || '—') : ''}
    </div>
    ${m ? h`${sectionTitle('"আমাদের পরিচিতি" পাতায় প্রদর্শনের সম্মতি')}
      <form class="card" data-submit="consent">
        <label class="row gap"><input type="checkbox" name="photo" ${m.show_photo_consent ? 'checked' : ''}> <span>আমার ছবি দেখানো যাবে</span></label>
        <label class="row gap"><input type="checkbox" name="address" ${m.show_address_consent ? 'checked' : ''}> <span>আমার ঠিকানা দেখানো যাবে</span></label>
        <small class="muted">ফোন নম্বর বা অন্য ব্যক্তিগত তথ্য কখনোই ওই পাতায় দেখানো হয় না।</small>
        <button class="btn primary block" type="submit">সম্মতি সংরক্ষণ</button></form>` : ''}
    ${sectionTitle('পাসওয়ার্ড বদলান')}
    <form class="card" data-submit="password" novalidate>
      ${field({ label: 'নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর)', name: 'pw', type: 'password', autocomplete: 'new-password' })}
      ${field({ label: 'আবার লিখুন', name: 'pw2', type: 'password', autocomplete: 'new-password' })}
      <p class="errmsg" role="alert"></p><button class="btn primary block" type="submit">পাসওয়ার্ড বদলান</button></form>
    <button class="btn outline block" data-act="logout">লগআউট</button>`;
});
SUBMITS.consent = async (form) => {
  const f = new FormData(form);
  await db.rpc('set_my_consent', { p_show_photo: f.has('photo'), p_show_address: f.has('address') });
  await loadContext(); toast('সম্মতি সংরক্ষিত হয়েছে।');
};
SUBMITS.password = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); const err = $('.errmsg', form);
  err.textContent = '';
  if ((f.pw || '').length < 6) return void (err.textContent = 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।');
  if (f.pw !== f.pw2) return void (err.textContent = 'দুটি পাসওয়ার্ড মেলেনি।');
  try { await Auth.changePassword(f.pw); form.reset(); toast('পাসওয়ার্ড বদলানো হয়েছে।'); } catch (e) { err.textContent = e.message; }
};
/* ---------- অ্যাডমিন: জমা যাচাই, সদস্য, কমিটি, অ্যাকাউন্ট যুক্ত, অনুমতি ---------- */
async function memberNames() {
  const ms = await db.select('members', { select: 'id,full_name,membership_no,status,profile_id,monthly_commitment_paisa,phone,address,joined_on,photo_path,full_name_en', order: 'membership_no.asc' });
  return { list: ms, byId: Object.fromEntries(ms.map((m) => [m.id, m])) };
}
const mLabel = (m) => (m ? `${m.full_name} (${m.membership_no})` : 'অজানা সদস্য');

/* ----- জমা যাচাই ----- */
route('/approvals', async () => {
  const [{ byId }, pend, done] = await Promise.all([
    memberNames(),
    db.select('deposit_requests', { filter: { status: 'eq.pending' }, order: 'submitted_at.asc' }),
    db.select('deposit_requests', { filter: { status: 'neq.pending' }, order: 'reviewed_at.desc', limit: 20 }),
  ]);
  const card = (d, actions) => h`${depositCard(d, h`<b>${mLabel(byId[d.member_id])}</b>`)}${actions ? h`<div class="row gap noprint">
      <button class="btn primary small" data-act="approve" data-id="${d.id}" data-method="${d.payment_method}" data-amt="${d.amount_paisa}">অনুমোদন</button>
      <button class="btn danger small" data-act="reject" data-id="${d.id}">বাতিল</button></div>` : ''}`;
  return h`<h1>জমা যাচাই</h1>
    <p class="muted small">রশিদ ও ট্রানজেকশন আইডি মিলিয়ে দেখে অনুমোদন করুন। নিজের জমা নিজে অনুমোদন করা যায় না। অনুমোদন একবারই হয়, পরে বদলানো যায় না (ভুল হলে সংশোধন এন্ট্রি লাগে)।</p>
    ${sectionTitle(`অপেক্ষমাণ (${toBn(pend.length)}টি)`)}
    ${pend.length ? pend.map((d) => h`<div class="card-wrap">${card(d, true)}</div>`) : empty('কোনো অপেক্ষমাণ জমা নেই।')}
    ${done.length ? h`${sectionTitle('সাম্প্রতিক যাচাইকৃত')}${done.map((d) => card(d, false))}` : ''}`;
}, () => can('approve_deposits'));

ACTIONS.approve = (t) => {
  const amt = +t.dataset.amt;
  openModal({
    title: 'জমা অনুমোদন', submitLabel: 'অনুমোদন করুন',
    body: h`<p>পরিমাণ: <b>${taka(amt)}</b>। টাকাটি কোন হিসাবে জমা হয়েছে?</p>
      ${selectField({ label: 'অ্যাকাউন্ট', name: 'account', options: [['bank', 'ব্যাংক (পূবালী ব্যাংক যৌথ হিসাব)'], ['cash', 'নগদ']], value: t.dataset.method === 'cash' ? 'cash' : 'bank', required: true })}
      <p class="muted small">অনুমোদনের পর এটি আর বদলানো যাবে না।</p>`,
    onSubmit: async (v) => { await db.rpc('approve_deposit', { p_request_id: t.dataset.id, p_account: v.account }); toast('অনুমোদিত হয়েছে।'); renderRoute(); refreshUnread(); },
  });
};
ACTIONS.reject = (t) => openModal({
  title: 'জমা বাতিল', submitLabel: 'বাতিল করুন', danger: true,
  body: textArea({ label: 'বাতিলের কারণ (সদস্য দেখতে পাবেন)', name: 'reason', required: true, rows: 3, maxlength: 300 }),
  onSubmit: async (v) => {
    if (!(v.reason || '').trim()) throw new Error('বাতিলের কারণ লিখুন।');
    await db.rpc('reject_deposit', { p_request_id: t.dataset.id, p_reason: v.reason }); toast('বাতিল করা হয়েছে।'); renderRoute();
  },
});

/* ----- সদস্য তালিকা ----- */
route('/members', async () => {
  const { list } = await memberNames();
  const unlinked = await db.rpc('admin_unlinked_accounts');
  const free = list.filter((m) => !m.profile_id);
  const active = list.filter((m) => m.status === 'active').length;
  return h`<h1>সদস্য ব্যবস্থাপনা</h1>
    <div class="row gap"><a class="btn gold" href="#/member-new">+ নতুন সদস্য</a></div>
    <p class="muted">সক্রিয় সদস্য: <b>${toBn(active)} জন</b> · মোট রেকর্ড: ${toBn(list.length)}</p>
    ${unlinked.length ? h`${sectionTitle('অ্যাকাউন্ট খুলেছেন কিন্তু যুক্ত হননি')}
      ${unlinked.map((u) => h`<div class="card"><b>${u.full_name || '—'}</b><br><small class="muted">${u.email} ${u.phone ? '· ' + u.phone : ''} · ${formatDate(u.created_at)}</small>
        <button class="btn outline small noprint" data-act="link" data-uid="${u.user_id}" data-name="${u.full_name || u.email}">সদস্যের সাথে যুক্ত করুন</button></div>`)}
      ${free.length ? '' : h`<p class="muted small">যুক্ত করার আগে ওপরের "নতুন সদস্য" থেকে সদস্যের রেকর্ড বানান।</p>`}` : ''}
    ${sectionTitle('সব সদস্য')}
    <div class="card list">${list.map((m) => h`<a class="li" href="#/member/${m.id}"><div><b>${m.full_name}</b><small class="muted">${m.membership_no} · ${m.profile_id ? 'অ্যাকাউন্ট যুক্ত' : 'অ্যাকাউন্ট যুক্ত নয়'}</small></div>${badge(L.memberStatus[m.status], statusTone[m.status])}</a>`)}</div>`;
}, () => can('manage_members'));

ACTIONS.link = async (t) => {
  const { list } = await memberNames(); const free = list.filter((m) => !m.profile_id && m.status === 'active');
  if (!free.length) return toast('যুক্ত করার মতো সদস্য রেকর্ড নেই। আগে "নতুন সদস্য" বানান।', 'bad');
  openModal({
    title: `${t.dataset.name} — কোন সদস্য?`, submitLabel: 'যুক্ত করুন',
    body: h`${selectField({ label: 'সদস্য রেকর্ড বাছুন', name: 'member', options: free.map((m) => [m.id, mLabel(m)]), required: true })}
      <p class="muted small">ভুল ব্যক্তিকে যুক্ত করলে সে অন্যের হিসাব দেখতে পাবে — নাম ও ইমেইল মিলিয়ে নিন।</p>`,
    onSubmit: async (v) => { await db.rpc('link_member_account', { p_member_id: v.member, p_user_id: t.dataset.uid }); toast('যুক্ত হয়েছে।'); renderRoute(); },
  });
};

/* ----- নতুন সদস্য ----- */
route('/member-new', async () => h`<h1>নতুন সদস্য</h1>
  <form class="card" data-submit="member-new" novalidate>
    ${field({ label: 'পূর্ণ নাম (বাংলায়)', name: 'name', required: true })}
    ${field({ label: 'পূর্ণ নাম (ইংরেজি, ঐচ্ছিক)', name: 'name_en' })}
    ${field({ label: 'ঠিকানা (ঐচ্ছিক)', name: 'address' })}
    ${field({ label: 'মোবাইল (ঐচ্ছিক)', name: 'phone', type: 'tel', inputmode: 'tel' })}
    ${field({ label: 'যোগদানের তারিখ', name: 'joined', type: 'date', value: todayDhaka() })}
    ${field({ label: 'মাসিক সঞ্চয়ের অঙ্ক (টাকা)', name: 'commit', inputmode: 'decimal', hint: 'ফাঁকা রাখলে "নির্ধারিত হয়নি" থাকবে; সমিতির সিদ্ধান্ত ছাড়া কোনো অঙ্ক ধরে নেবেন না।' })}
    ${field({ label: 'সদস্য আইডি (ঐচ্ছিক)', name: 'no', hint: 'ফাঁকা রাখলে স্বয়ংক্রিয় (SUS-০০০১…)' })}
    <p class="errmsg" role="alert"></p><button class="btn primary block" type="submit">সদস্য তৈরি করুন</button></form>`, () => can('manage_members'));
SUBMITS['member-new'] = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); const err = $('.errmsg', form); err.textContent = '';
  if ((f.name || '').trim().length < 2) return void (err.textContent = 'সদস্যের নাম লিখুন।');
  let commit = null;
  if ((f.commit || '').trim()) { commit = parseTaka(f.commit); if (commit === null) return void (err.textContent = 'মাসিক অঙ্ক সঠিক নয়।'); }
  const btn = $('button[type=submit]', form); btn.disabled = true;
  try {
    const id = await db.rpc('admin_create_member', {
      p_full_name: f.name.trim(), p_full_name_en: (f.name_en || '').trim() || null, p_address: (f.address || '').trim() || null,
      p_phone: (f.phone || '').trim() || null, p_joined_on: f.joined || null, p_monthly_commitment_paisa: commit, p_membership_no: (f.no || '').trim() || null,
    });
    toast('সদস্য তৈরি হয়েছে।'); go('/member/' + id);
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
};

/* ----- সদস্যের বিস্তারিত ----- */
route('/member/:id', async ({ id }) => {
  const { byId } = await memberNames(); const m = byId[id];
  if (!m) return empty('সদস্য পাওয়া যায়নি।');
  const [bal, cm, st] = await Promise.all([
    can('view_finance') ? db.select('member_balances', { filter: { member_id: `eq.${id}` } }) : [],
    db.select('committee_members', { filter: { member_id: `eq.${id}`, is_current: 'eq.true' } }),
    can('view_finance') ? db.rpc('admin_member_statement', { p_member_id: id, p_from: null, p_to: null }) : null,
  ]);
  const b = bal[0], post = cm[0];
  return h`<h1>${m.full_name}</h1>
    <div class="card">${kv('সদস্য আইডি', m.membership_no)}${kv('অবস্থা', badge(L.memberStatus[m.status], statusTone[m.status]))}${kv('অ্যাকাউন্ট', m.profile_id ? 'যুক্ত' : 'যুক্ত নয়')}
      ${kv('যোগদান', formatDate(m.joined_on))}${kv('মোবাইল', m.phone || '—')}${kv('ঠিকানা', m.address || '—')}
      ${kv('মাসিক সঞ্চয়ের অঙ্ক', m.monthly_commitment_paisa === null ? 'নির্ধারিত হয়নি' : taka(m.monthly_commitment_paisa))}
      ${kv('কমিটির পদ', post ? L.committee[post.designation] : '—')}
      ${m.profile_id ? h`<button class="btn outline small noprint" data-act="unlink" data-id="${id}" data-name="${m.full_name}">ভুল অ্যাকাউন্ট যুক্ত? — যুক্ত বাতিল করুন</button>` : ''}</div>
    ${b ? h`<div class="grid2">${stat('অনুমোদিত সঞ্চয়', taka(b.savings_paisa), true)}${stat('যাচাই অপেক্ষমাণ', taka(b.pending_paisa))}</div>` : ''}
    <label class="field noprint"><span>সদস্যের ছবি (ঐচ্ছিক; ছোট করে সংরক্ষিত হয়)</span><input type="file" accept="image/*" data-change="member-photo" data-id="${id}"></label>
    ${sectionTitle('তথ্য সম্পাদনা')}
    <form class="card" data-submit="member-edit" data-id="${id}" novalidate>
      ${field({ label: 'পূর্ণ নাম', name: 'name', value: m.full_name, required: true })}
      ${field({ label: 'ইংরেজি নাম', name: 'name_en', value: m.full_name_en || '' })}
      ${field({ label: 'ঠিকানা', name: 'address', value: m.address || '' })}
      ${field({ label: 'মোবাইল', name: 'phone', value: m.phone || '', type: 'tel' })}
      ${field({ label: 'সদস্য আইডি', name: 'no', value: m.membership_no })}
      ${field({ label: 'মাসিক সঞ্চয়ের অঙ্ক (টাকা)', name: 'commit', value: paisaToInput(m.monthly_commitment_paisa), inputmode: 'decimal', hint: 'ফাঁকা = নির্ধারিত হয়নি' })}
      <p class="errmsg" role="alert"></p><button class="btn primary block" type="submit">সংরক্ষণ</button></form>
    ${sectionTitle('সদস্যপদের অবস্থা')}
    <form class="card" data-submit="member-status" data-id="${id}">
      ${selectField({ label: 'অবস্থা', name: 'status', options: Object.entries(L.memberStatus), value: m.status })}
      <small class="muted">কোনো সদস্য মুছে ফেলা যায় না; শুধু অবস্থা বদলায়। হিসাব সংরক্ষিত থাকে।</small>
      <p class="errmsg" role="alert"></p><button class="btn outline block" type="submit">অবস্থা বদলান</button></form>
    ${m.status === 'active' ? h`${sectionTitle('কমিটিতে দায়িত্ব')}
      <form class="card" data-submit="committee" data-id="${id}">
        ${selectField({ label: 'পদ', name: 'post', options: COMMITTEE_ORDER.map((k) => [k, L.committee[k]]) })}
        ${field({ label: 'মেয়াদ শুরু', name: 'start', type: 'date', value: todayDhaka(), required: true })}
        <small class="muted">ঐ পদে আগের কেউ থাকলে তার মেয়াদ শেষ হবে। মেয়াদ ডিফল্ট ১ বছর।</small>
        <p class="errmsg" role="alert"></p><button class="btn outline block" type="submit">পদে নিয়োগ দিন</button></form>` : ''}
    ${st ? h`${sectionTitle('সঞ্চয়ের খতিয়ান')}${st.entries.length ? h`<div class="card list">${st.entries.map((e) => h`<div class="li"><div><b>${L.ledger[e.type] || e.type}</b><small class="muted">${formatDate(e.date)}${e.for_month ? ' · ' + formatMonth(e.for_month) : ''}</small></div><b class="${e.amount_paisa < 0 ? 'neg' : 'pos'}">${taka(e.amount_paisa, true)}</b></div>`)}</div>` : empty('কোনো লেনদেন নেই।')}` : ''}`;
}, () => can('manage_members'));

const fe = (form) => $('.errmsg', form);
SUBMITS['member-edit'] = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); fe(form).textContent = '';
  let commit = null;
  if ((f.commit || '').trim()) { commit = parseTaka(f.commit); if (commit === null) return void (fe(form).textContent = 'মাসিক অঙ্ক সঠিক নয়।'); }
  try {
    await db.rpc('admin_update_member', { p_member_id: form.dataset.id, p_patch: {
      full_name: f.name, full_name_en: (f.name_en || '').trim() || null, address: (f.address || '').trim() || null,
      phone: (f.phone || '').trim() || null, membership_no: f.no, monthly_commitment_paisa: commit } });
    toast('সংরক্ষিত হয়েছে।'); renderRoute();
  } catch (e) { fe(form).textContent = e.message; }
};
SUBMITS['member-status'] = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries());
  try { await db.rpc('set_member_status', { p_member_id: form.dataset.id, p_status: f.status }); toast('অবস্থা বদলেছে।'); renderRoute(); } catch (e) { fe(form).textContent = e.message; }
};
SUBMITS.committee = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries());
  try { await db.rpc('assign_committee', { p_member_id: form.dataset.id, p_designation: f.post, p_term_start: f.start, p_term_end: null }); toast('কমিটির পদ হালনাগাদ হয়েছে।'); renderRoute(); } catch (e) { fe(form).textContent = e.message; }
};

/* ----- অ্যাডমিন অনুমতি ----- */
route('/admins', async () => {
  const [profs, { byId, list }] = await Promise.all([db.select('profiles', { select: 'id,full_name,role,admin_permissions', order: 'created_at.asc' }), memberNames()]);
  const mByProfile = Object.fromEntries(list.filter((m) => m.profile_id).map((m) => [m.profile_id, m]));
  return h`<h1>অ্যাডমিন অনুমতি</h1>
    <p class="muted small">সতর্কতা: অনুমতি দিলে ঐ ব্যক্তি সমিতির আর্থিক তথ্যে পরিবর্তন আনতে পারবেন। শুধু কমিটির বিশ্বস্ত সদস্যকে দিন। নিজের "অ্যাডমিন অনুমতি ব্যবস্থাপনা" সরানো যায় না।</p>
    <div class="card list">${profs.map((p) => h`<button class="li btn-li" data-act="edit-admin" data-id="${p.id}" data-role="${p.role}" data-perms="${(p.admin_permissions || []).join(',')}" data-name="${p.full_name || '—'}">
      <div><b>${p.full_name || '—'}${p.id === S.ctx.user_id ? ' (আপনি)' : ''}</b><small class="muted">${mByProfile[p.id] ? mLabel(mByProfile[p.id]) : 'সদস্য রেকর্ডের সাথে যুক্ত নয়'}</small></div>
      ${badge(p.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য', p.role === 'admin' ? 'gold' : 'gray')}</button>`)}</div>`;
}, () => can('manage_admins'));
ACTIONS['edit-admin'] = (t) => {
  const cur = new Set((t.dataset.perms || '').split(',').filter(Boolean));
  openModal({
    title: t.dataset.name, submitLabel: 'সংরক্ষণ',
    body: h`${selectField({ label: 'ভূমিকা', name: 'role', options: [['member', 'সদস্য'], ['admin', 'অ্যাডমিন']], value: t.dataset.role })}
      <p><b>অনুমতি (শুধু অ্যাডমিনের জন্য কার্যকর)</b></p>
      ${Object.keys(L.perm).map((k) => h`<label class="row gap chk"><input type="checkbox" name="p_${k}" ${cur.has(k) ? 'checked' : ''}> <span>${L.perm[k]}</span></label>`)}`,
    onSubmit: async (v) => {
      const perms = Object.keys(L.perm).filter((k) => v['p_' + k] !== undefined);
      await db.rpc('set_admin_permissions', { p_user_id: t.dataset.id, p_role: v.role, p_perms: perms });
      toast('অনুমতি হালনাগাদ হয়েছে।');
      if (t.dataset.id === S.ctx.user_id) { await loadContext(); renderShell(); }
      renderRoute();
    },
  });
};

ACTIONS.unlink = (t) => openModal({
  title: 'অ্যাকাউন্ট যুক্ত বাতিল', submitLabel: 'যুক্ত বাতিল করুন', danger: true,
  body: h`<p>"${t.dataset.name}" সদস্য রেকর্ড থেকে লগইন-অ্যাকাউন্টের সংযোগ সরানো হবে। সদস্যের জমা, খতিয়ান বা কোনো তথ্য মুছবে না।</p>
    <p>এরপর ওই অ্যাকাউন্ট আবার "যুক্ত হননি" তালিকায় যাবে এবং সঠিক সদস্যের সাথে যুক্ত করা যাবে। এই সদস্য নতুন করে অ্যাকাউন্ট খুললে আবার যুক্ত করতে হবে।</p>`,
  onSubmit: async () => { await db.rpc('admin_unlink_member_account', { p_member_id: t.dataset.id }); toast('যুক্ত বাতিল হয়েছে।'); renderRoute(); },
});
/* ---------- আয়-ব্যয়, খতিয়ান সংশোধন, রিপোর্ট ---------- */
let finTab = 'income';
ACTIONS['fin-tab'] = (t) => { finTab = t.dataset.tab; renderRoute(); };

route('/finance', async () => {
  const isInc = finTab === 'income', tbl = isInc ? 'income_transactions' : 'expense_transactions', cats = isInc ? L.income : L.expense;
  const [rows, { byId }] = await Promise.all([
    db.select(tbl, { order: 'entry_date.desc,created_at.desc', limit: 150 }),
    isAdmin() ? memberNames() : Promise.resolve({ byId: {} }),
  ]);
  const reversed = new Set(rows.filter((r) => r.reverses_id).map((r) => r.reverses_id));
  const total = rows.reduce((s, r) => s + r.amount_paisa, 0);
  return h`<h1>আয়-ব্যয়</h1>
    <div class="row gap seg"><button class="btn ${isInc ? 'primary' : 'outline'}" data-act="fin-tab" data-tab="income">আয়</button><button class="btn ${isInc ? 'outline' : 'primary'}" data-act="fin-tab" data-tab="expense">ব্যয়</button></div>
    <div class="card"><small class="muted">সাম্প্রতিক ${toBn(rows.length)}টি এন্ট্রির নিট যোগফল (রিভার্সালসহ)</small><br><b>${taka(total)}</b></div>
    <p class="muted small">সদস্যদের সঞ্চয় সমিতির আয় নয়; এখানে শুধু ব্যাংক মুনাফা ও অন্যান্য অনুমোদিত আয়-ব্যয় দেখানো হয়। এন্ট্রি মোছা যায় না — ভুল হলে রিভার্সাল এন্ট্রি হয়।</p>
    ${rows.length ? rows.map((r) => h`<div class="card">
      <div class="row between wrap"><b>${cats[r.category] || r.category}</b><b class="${(isInc ? r.amount_paisa < 0 : r.amount_paisa > 0) ? 'neg' : 'pos'}">${taka(r.amount_paisa)}</b></div>
      <div>${r.description}</div>
      <small class="muted">${formatDate(r.entry_date)} · ${L.account[r.account]}${r.responsible_member_id && byId[r.responsible_member_id] ? ' · দায়িত্বে: ' + byId[r.responsible_member_id].full_name : ''}</small>
      <div class="row gap wrap">${r.entry_type === 'reversal' ? badge('রিভার্সাল', 'warn') : ''}${reversed.has(r.id) ? badge('রিভার্স করা হয়েছে', 'bad') : ''}
        ${r.receipt_path ? h`<button class="btn outline small noprint" data-act="show-receipt" data-path="${r.receipt_path}">রশিদ</button>` : ''}
        ${can('manage_finance') && r.entry_type === 'entry' && !reversed.has(r.id) ? h`<button class="btn danger small noprint" data-act="reverse-fin" data-kind="${finTab}" data-id="${r.id}">রিভার্স</button>` : ''}</div></div>`) : empty('এখনো কোনো এন্ট্রি নেই।')}
    ${can('manage_finance') ? h`<a class="btn gold block" href="#/finance-entry">নতুন এন্ট্রি / সংশোধন</a>` : ''}`;
});
ACTIONS['reverse-fin'] = (t) => openModal({
  title: 'এন্ট্রি রিভার্স', submitLabel: 'রিভার্স করুন', danger: true,
  body: h`<p>মূল এন্ট্রি অপরিবর্তিত থাকবে; তার বিপরীতে একটি রিভার্সাল এন্ট্রি যোগ হবে। এটি আবার ফেরানো যাবে না।</p>${textArea({ label: 'কারণ', name: 'reason', required: true, rows: 3, maxlength: 300 })}`,
  onSubmit: async (v) => {
    if (!(v.reason || '').trim()) throw new Error('কারণ লিখুন।');
    await db.rpc(t.dataset.kind === 'income' ? 'reverse_income' : 'reverse_expense', { p_id: t.dataset.id, p_reason: v.reason });
    toast('রিভার্সাল যোগ হয়েছে।'); renderRoute();
  },
});

/* ----- এন্ট্রি ফর্ম ----- */
let finBlob = null;
CHANGES['fin-receipt'] = async (t) => {
  finBlob = null; const box = $('#fin-prev'); box.textContent = '';
  if (!t.files[0]) return;
  try { finBlob = await resizeImage(t.files[0]); box.textContent = `ছবি প্রস্তুত (${toBn(Math.round(finBlob.size / 1024))} KB)`; } catch (e) { t.value = ''; toast(e.message, 'bad'); }
};
route('/finance-entry', async () => {
  finBlob = null;
  const { list } = await memberNames();
  const act = list.filter((m) => m.status === 'active');
  const sav = await db.select('savings_transactions', { select: 'id,member_id,entry_type,amount_paisa,entry_date,for_month,reverses_id', order: 'created_at.desc', limit: 40 });
  const revd = new Set(sav.filter((r) => r.reverses_id).map((r) => r.reverses_id));
  const byId = Object.fromEntries(list.map((m) => [m.id, m]));
  const memOpts = [['', '— কেউ নয় —'], ...act.map((m) => [m.id, mLabel(m)])];
  const acc = Object.entries(L.account);
  return h`<h1>এন্ট্রি ও সংশোধন</h1>
    ${sectionTitle('আয় বা ব্যয় যোগ')}
    <form class="card" data-submit="fin-new" novalidate>
      ${selectField({ label: 'ধরন', name: 'kind', options: [['income', 'আয়'], ['expense', 'ব্যয়']] })}
      <label class="field"><span>খাত <em>*</em></span><select name="category">
        <optgroup label="আয়">${Object.entries(L.income).map(([k, v]) => h`<option value="income:${k}">${v}</option>`)}</optgroup>
        <optgroup label="ব্যয়">${Object.entries(L.expense).map(([k, v]) => h`<option value="expense:${k}">${v}</option>`)}</optgroup></select><small>খাত অনুযায়ী আয়/ব্যয় নিজে ঠিক হয়।</small></label>
      ${field({ label: 'পরিমাণ (টাকা)', name: 'amount', required: true, inputmode: 'decimal' })}
      ${selectField({ label: 'অ্যাকাউন্ট', name: 'account', options: acc })}
      ${field({ label: 'তারিখ', name: 'date', type: 'date', value: todayDhaka(), required: true })}
      ${textArea({ label: 'বিবরণ', name: 'desc', required: true, rows: 2, maxlength: 300 })}
      ${selectField({ label: 'দায়িত্বপ্রাপ্ত সদস্য (ঐচ্ছিক)', name: 'resp', options: memOpts })}
      <label class="field"><span>রশিদের ছবি (ঐচ্ছিক)</span><input type="file" accept="image/*" data-change="fin-receipt"></label><small id="fin-prev" class="muted"></small>
      <p class="errmsg" role="alert"></p><button class="btn primary block" type="submit">এন্ট্রি যোগ করুন</button></form>
    ${sectionTitle('সদস্যের সঞ্চয়ে প্রারম্ভিক জের / সমন্বয়')}
    <form class="card" data-submit="sav-post" novalidate>
      ${selectField({ label: 'সদস্য', name: 'member', options: act.map((m) => [m.id, mLabel(m)]), required: true })}
      ${selectField({ label: 'ধরন', name: 'type', options: [['opening_balance', 'প্রারম্ভিক জের (অ্যাপ চালুর আগের জমা)'], ['adjustment', 'সমন্বয় (+/−)']] })}
      ${field({ label: 'পরিমাণ (টাকা; সমন্বয়ে ঋণাত্মক হলে − দিন)', name: 'amount', required: true, inputmode: 'text' })}
      ${selectField({ label: 'অ্যাকাউন্ট', name: 'account', options: acc })}
      ${field({ label: 'তারিখ', name: 'date', type: 'date', value: todayDhaka(), required: true })}
      ${textArea({ label: 'কারণ (আবশ্যক)', name: 'reason', required: true, rows: 2, maxlength: 300 })}
      <p class="errmsg" role="alert"></p><button class="btn primary block" type="submit">খতিয়ানে যোগ করুন</button></form>
    ${sectionTitle('সদস্যের সঞ্চয় এন্ট্রি রিভার্স')}
    <div class="card list">${sav.filter((r) => r.entry_type !== 'reversal' && !revd.has(r.id)).slice(0, 20).map((r) => h`<div class="li"><div><b>${mLabel(byId[r.member_id])}</b><small class="muted">${L.ledger[r.entry_type]} · ${formatDate(r.entry_date)}</small></div>
      <div><b>${taka(r.amount_paisa)}</b><button class="btn danger small" data-act="reverse-sav" data-id="${r.id}">রিভার্স</button></div></div>`) || ''}</div>`;
}, () => can('manage_finance'));
SUBMITS['fin-new'] = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); const err = fe(form); err.textContent = '';
  const [kind, cat] = (f.category || ':').split(':');
  if (kind !== f.kind) return void (err.textContent = 'ধরন ও খাত মিলছে না — আয়ের খাত আয়ে, ব্যয়ের খাত ব্যয়ে বাছুন।');
  const paisa = parseTaka(f.amount || ''); if (paisa === null) return void (err.textContent = 'সঠিক টাকার অঙ্ক লিখুন।');
  if (f.date > todayDhaka()) return void (err.textContent = 'ভবিষ্যতের তারিখ দেওয়া যাবে না।');
  if (!(f.desc || '').trim()) return void (err.textContent = 'বিবরণ লিখুন।');
  const btn = $('button[type=submit]', form); btn.disabled = true;
  try {
    const path = finBlob ? await uploadBlob('receipts', `finance/${Date.now()}.jpg`, finBlob) : null;
    await db.rpc(kind === 'income' ? 'record_income' : 'record_expense', { p_category: cat, p_amount_paisa: paisa, p_account: f.account, p_date: f.date, p_description: f.desc.trim(), p_responsible_member_id: f.resp || null, p_receipt_path: path });
    toast('এন্ট্রি যোগ হয়েছে।'); finTab = kind; go('/finance');
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
};
SUBMITS['sav-post'] = async (form) => {
  const f = Object.fromEntries(new FormData(form).entries()); const err = fe(form); err.textContent = '';
  const paisa = parseSignedTaka(f.amount || ''); if (paisa === null) return void (err.textContent = 'সঠিক টাকার অঙ্ক লিখুন।');
  if (!(f.reason || '').trim()) return void (err.textContent = 'কারণ লিখুন।');
  try {
    await db.rpc('post_savings_entry', { p_member_id: f.member, p_type: f.type, p_amount_paisa: paisa, p_account: f.account, p_date: f.date, p_reason: f.reason.trim() });
    toast('খতিয়ানে যোগ হয়েছে।'); renderRoute();
  } catch (e) { err.textContent = e.message; }
};
ACTIONS['reverse-sav'] = (t) => openModal({
  title: 'সঞ্চয় এন্ট্রি রিভার্স', submitLabel: 'রিভার্স করুন', danger: true,
  body: h`<p>মূল এন্ট্রি থাকবে; বিপরীত একটি রিভার্সাল এন্ট্রি যোগ হবে।</p>${textArea({ label: 'কারণ', name: 'reason', required: true, rows: 3, maxlength: 300 })}`,
  onSubmit: async (v) => {
    if (!(v.reason || '').trim()) throw new Error('কারণ লিখুন।');
    await db.rpc('reverse_savings', { p_txn_id: t.dataset.id, p_reason: v.reason }); toast('রিভার্সাল যোগ হয়েছে।'); renderRoute();
  },
});

/* ----- রিপোর্ট ----- */
const RP = { mode: 'monthly', year: null, month: null };
CHANGES['rp-mode'] = (t) => { RP.mode = t.value; renderRoute(); };
CHANGES['rp-year'] = (t) => { RP.year = +t.value; renderRoute(); };
CHANGES['rp-month'] = (t) => { RP.month = +t.value; renderRoute(); };
const catList = (obj, labels) => {
  const e = Object.entries(obj || {});
  return e.length ? e.map(([k, v]) => h`<div class="li"><span>${labels[k] || k}</span><b>${taka(v)}</b></div>`) : h`<div class="li muted">কোনো এন্ট্রি নেই</div>`;
};
const memberTable = (rows) => rows && rows.length ? h`<div class="card list">${rows.map((r) => h`<div class="li"><span>${r.full_name} <small class="muted">${r.membership_no}</small></span><b>${taka(r.amount_paisa)}</b></div>`)}</div>` : empty('কোনো সদস্যের জমা নেই।');

route('/reports', async () => {
  const t = todayDhaka(); RP.year = RP.year || +t.slice(0, 4); RP.month = RP.month || +t.slice(5, 7);
  const years = []; for (let y = +t.slice(0, 4); y >= +t.slice(0, 4) - 8; y--) years.push(y);
  const ctl = h`<div class="card noprint"><div class="row gap wrap">
    <label class="field grow"><span>ধরন</span><select data-change="rp-mode"><option value="monthly" ${RP.mode === 'monthly' ? 'selected' : ''}>মাসিক</option><option value="annual" ${RP.mode === 'annual' ? 'selected' : ''}>বার্ষিক</option></select></label>
    <label class="field grow"><span>বছর</span><select data-change="rp-year">${years.map((y) => h`<option value="${y}" ${y === RP.year ? 'selected' : ''}>${toBn(y)}</option>`)}</select></label>
    ${RP.mode === 'monthly' ? h`<label class="field grow"><span>মাস</span><select data-change="rp-month">${BN_MONTHS.map((m, i) => h`<option value="${i + 1}" ${i + 1 === RP.month ? 'selected' : ''}>${m}</option>`)}</select></label>` : ''}</div></div>`;
  const head = (title) => h`<div class="print-head"><img src="logo-192.png" width="48" height="48" alt=""><div><b>${ORG.nameBn}</b><br><small>${ORG.slogan}</small></div></div><h1>${title}</h1><small class="muted">প্রস্তুতের তারিখ: ${formatDate(t)}</small>`;
  if (RP.mode === 'monthly') {
    const r = await db.rpc('monthly_report', { p_year: RP.year, p_month: RP.month });
    return h`${ctl}${head(`মাসিক রিপোর্ট — ${BN_MONTHS[RP.month - 1]} ${toBn(RP.year)}`)}
      <div class="grid2">${stat('শুরুর ব্যালেন্স', taka(r.opening_balance_paisa))}${stat('শেষ ব্যালেন্স', taka(r.closing_balance_paisa), true)}
        ${stat('মোট সঞ্চয় জমা', taka(r.total_savings_paisa))}${stat('মোট আয়', taka(r.total_income_paisa))}${stat('মোট ব্যয়', taka(r.total_expense_paisa))}
        ${stat('যাচাই অপেক্ষমাণ', `${taka(r.pending_paisa)} (${toBn(r.pending_count)}টি)`)}
        ${stat('মোট বকেয়া', r.outstanding_dues_paisa === null ? 'নির্ধারিত হয়নি' : taka(r.outstanding_dues_paisa))}</div>
      ${sectionTitle('সদস্যভিত্তিক জমা')}${memberTable(r.member_wise)}
      ${sectionTitle('আয় (খাত অনুযায়ী)')}<div class="card list">${catList(r.income_by_category, L.income)}</div>
      ${sectionTitle('ব্যয় (খাত অনুযায়ী)')}<div class="card list">${catList(r.expense_by_category, L.expense)}</div>
      <button class="btn gold block noprint" data-act="print">প্রিন্ট / PDF সংরক্ষণ</button>`;
  }
  const r = await db.rpc('annual_report', { p_year: RP.year });
  const cmp = (k) => h`<div class="li"><span>${{ total_savings_paisa: 'সঞ্চয় জমা', total_income_paisa: 'আয়', total_expense_paisa: 'ব্যয়' }[k]}</span><div class="right"><b>${taka(r.current[k])}</b><small class="muted">গত বছর: ${taka(r.previous[k])}</small></div></div>`;
  return h`${ctl}${head(`বার্ষিক রিপোর্ট — ${toBn(RP.year)}`)}
    <div class="grid2">${stat('বছরের শুরুর ব্যালেন্স', taka(r.opening_balance_paisa))}${stat('বছরের শেষ ব্যালেন্স', taka(r.closing_balance_paisa), true)}</div>
    ${sectionTitle('আগের বছরের সাথে তুলনা')}<div class="card list">${['total_savings_paisa', 'total_income_paisa', 'total_expense_paisa'].map(cmp)}</div>
    ${sectionTitle('মাসওয়ারি সঞ্চয়')}<div class="card list">${(r.monthly_savings || []).length ? r.monthly_savings.map((x) => h`<div class="li"><span>${formatMonth(x.month)}</span><b>${taka(x.amount_paisa)}</b></div>`) : h`<div class="li muted">কোনো জমা নেই</div>`}</div>
    ${sectionTitle('সদস্যভিত্তিক বার্ষিক জমা')}${memberTable(r.member_wise)}
    ${sectionTitle('আয় (খাত অনুযায়ী)')}<div class="card list">${catList(r.income_by_category, L.income)}</div>
    ${sectionTitle('ব্যয় (খাত অনুযায়ী)')}<div class="card list">${catList(r.expense_by_category, L.expense)}</div>
    <button class="btn gold block noprint" data-act="print">প্রিন্ট / PDF সংরক্ষণ</button>`;
}, () => can('view_finance'));
/* ---------- নোটিশ, বিজ্ঞপ্তি, আমাদের পরিচিতি, নিয়মাবলি, অডিট ---------- */
const initial = (n) => (n || '?').trim().slice(0, 1);

/* ----- নোটিশ বোর্ড ----- */
route('/notices', async () => {
  const rows = await db.select('notices', { order: 'published_at.desc', limit: 100 });
  return h`<h1>নোটিশ বোর্ড</h1>
    ${can('publish_notices') ? h`<button class="btn gold block" data-act="notice-edit">+ নতুন নোটিশ</button>` : ''}
    ${rows.length ? rows.map((n) => h`<article class="card ${n.kind === 'emergency' ? 'warnbox' : ''}">
      <div class="row between wrap">${badge(L.notice[n.kind] || n.kind, n.kind === 'emergency' ? 'bad' : 'gold')}${!n.is_published ? badge('খসড়া (সদস্যরা দেখে না)', 'warn') : ''}<small class="muted">${formatDate(n.published_at)}</small></div>
      <h3>${n.title}</h3><p class="pre">${n.body}</p>
      ${can('publish_notices') ? h`<button class="btn outline small noprint" data-act="notice-edit" data-id="${n.id}" data-title="${n.title}" data-kind="${n.kind}" data-pub="${n.is_published}" data-body="${n.body}">সম্পাদনা</button>` : ''}</article>`) : empty('এখনো কোনো নোটিশ নেই।')}`;
});
ACTIONS['notice-edit'] = (t) => {
  const d = t.dataset, edit = !!d.id;
  openModal({
    title: edit ? 'নোটিশ সম্পাদনা' : 'নতুন নোটিশ', submitLabel: edit ? 'সংরক্ষণ' : 'প্রকাশ/সংরক্ষণ',
    body: h`${field({ label: 'শিরোনাম', name: 'title', value: d.title || '', required: true, maxlength: 150 })}
      ${selectField({ label: 'ধরন', name: 'kind', options: Object.entries(L.notice), value: d.kind || 'general' })}
      ${textArea({ label: 'বিস্তারিত', name: 'body', value: d.body || '', rows: 5, required: true, maxlength: 3000 })}
      <label class="row gap chk"><input type="checkbox" name="pub" ${!edit || d.pub === 'true' ? 'checked' : ''}> <span>এখনই প্রকাশ করুন (সদস্যরা দেখবেন ও বিজ্ঞপ্তি পাবেন)</span></label>`,
    onSubmit: async (v) => {
      if (!(v.title || '').trim() || !(v.body || '').trim()) throw new Error('শিরোনাম ও বিস্তারিত লিখুন।');
      const row = { title: v.title.trim(), body: v.body.trim(), kind: v.kind, is_published: v.pub !== undefined };
      if (edit) await db.update('notices', { id: `eq.${d.id}` }, row); else await db.insert('notices', row);
      toast('নোটিশ সংরক্ষিত হয়েছে।'); renderRoute();
    },
  });
};

/* ----- বিজ্ঞপ্তি ----- */
route('/notifications', async () => {
  const rows = await db.select('notifications', { order: 'created_at.desc', limit: 60 });
  const unread = rows.filter((r) => !r.read_at).length;
  return h`<h1>বিজ্ঞপ্তি</h1>
    <p class="muted small">ওয়েব সংস্করণে ফোনে পুশ নোটিফিকেশন আসে না; অ্যাপ খুললে এখানে নতুন বিজ্ঞপ্তি দেখবেন।</p>
    ${unread ? h`<button class="btn outline block" data-act="read-all">সব পড়া হয়েছে চিহ্নিত করুন</button>` : ''}
    ${rows.length ? h`<div class="card list">${rows.map((n) => h`<button class="li btn-li ${n.read_at ? '' : 'unread'}" data-act="read-one" data-id="${n.id}" data-read="${!!n.read_at}"><div><b>${n.title}</b>${n.body ? h`<small>${n.body}</small>` : ''}<small class="muted">${formatDateTime(n.created_at)}</small></div>${n.read_at ? '' : badge('নতুন', 'gold')}</button>`)}</div>` : empty('কোনো বিজ্ঞপ্তি নেই।')}`;
});
ACTIONS['read-one'] = async (t) => { if (t.dataset.read === 'true') return; await db.update('notifications', { id: `eq.${t.dataset.id}` }, { read_at: new Date().toISOString() }); renderRoute(); refreshUnread(); };
ACTIONS['read-all'] = async () => { await db.update('notifications', { read_at: 'is.null' }, { read_at: new Date().toISOString() }); renderRoute(); refreshUnread(); };

/* ----- আমাদের পরিচিতি ----- */
route('/about', async () => {
  const rows = await db.rpc('get_directory');
  const urls = {};
  await Promise.all(rows.filter((r) => r.photo_path).map(async (r) => { try { urls[r.member_id] = await signedUrl('member-photos', r.photo_path); } catch { /* ছবি না এলে নামের অক্ষর দেখাবে */ } }));
  const avatar = (r, big) => urls[r.member_id] ? h`<img class="av ${big ? 'big' : ''}" src="${urls[r.member_id]}" alt="${r.full_name}-এর ছবি">` : h`<div class="av ${big ? 'big' : ''} ph" aria-hidden="true">${initial(r.full_name)}</div>`;
  const comm = COMMITTEE_ORDER.map((k) => rows.find((r) => r.is_committee && r.designation === k)).filter(Boolean);
  const others = rows.filter((r) => !r.is_committee);
  return h`<h1>আমাদের পরিচিতি</h1>
    <section class="card hero-card">${logo(72)}<h2>${ORG.nameBn}</h2><p class="gold">${ORG.slogan}</p><p>বর্তমান সক্রিয় সদস্য: ${toBn(rows.length)} জন</p></section>
    ${comm.length ? h`${sectionTitle('ব্যবস্থাপনা কমিটি')}${comm.map((r) => h`<div class="card person">${avatar(r, true)}<div><b>${r.full_name}</b><br><span class="gold-t">${L.committee[r.designation]}</span>${r.address ? h`<br><small class="muted">${r.address}</small>` : ''}</div></div>`)}` : ''}
    ${sectionTitle('সমিতির সম্মানিত সদস্যবৃন্দ')}
    ${others.length ? h`<div class="grid2">${others.map((r) => h`<div class="card person col">${avatar(r)}<b>${r.full_name}</b>${r.address ? h`<small class="muted">${r.address}</small>` : ''}</div>`)}</div>` : empty('অন্য কোনো সদস্য নেই।')}
    <p class="muted small">ছবি ও ঠিকানা শুধু সদস্যের সম্মতি থাকলেই দেখানো হয়। ফোন নম্বর বা ব্যক্তিগত তথ্য এখানে কখনো দেখানো হয় না।</p>`;
});

/* সদস্যের ছবি আপলোড (অ্যাডমিনের সদস্য-পাতা থেকে) */
CHANGES['member-photo'] = async (t) => {
  if (!t.files[0]) return;
  const blob = await resizeImage(t.files[0], 600, 0.85);
  const path = await uploadBlob('member-photos', `${t.dataset.id}/${Date.now()}.jpg`, blob);
  await db.rpc('admin_update_member', { p_member_id: t.dataset.id, p_patch: { photo_path: path } });
  toast('ছবি সংরক্ষিত হয়েছে।'); renderRoute();
};

/* ----- গঠনতন্ত্র ও নিয়মাবলি ----- */
const settingValue = (s) => (s.value_int === null ? 'নির্ধারিত হয়নি' : s.unit === 'পয়সা' ? taka(s.value_int) : `${toBn(s.value_int)} ${s.unit || ''}`);
route('/rules', async () => {
  const [rules, sets] = await Promise.all([db.select('association_rules', { order: 'rule_no.asc' }), db.select('association_settings', { order: 'setting_key.asc' })]);
  const mr = can('manage_rules');
  return h`<h1>গঠনতন্ত্র ও নিয়মাবলি</h1>
    <div class="card warnbox"><small>নিচের ধারাগুলো ${rules.every((r) => r.is_official_text) ? 'অনুমোদিত গঠনতন্ত্রের হুবহু ভাষা' : 'সমিতির সিদ্ধান্তের সারসংক্ষেপ (খসড়া)। যেগুলোর পাশে "খসড়া" লেখা, সেগুলো হুবহু অফিসিয়াল গঠনতন্ত্রের ভাষা নয়; কমিটি অফিসিয়াল ভাষা মিলিয়ে সংশোধন করবে'}।</small></div>
    ${rules.map((r) => h`<article class="card ${r.is_active ? '' : 'faded'}"><div class="row between wrap"><b>ধারা ${toBn(r.rule_no)}: ${r.title}</b>${r.is_official_text ? badge('অফিসিয়াল', 'ok') : badge('খসড়া', 'warn')}${r.is_active ? '' : badge('নিষ্ক্রিয়', 'bad')}</div>
      <p class="pre">${r.body}</p>${mr ? h`<button class="btn outline small noprint" data-act="rule-edit" data-id="${r.id}" data-title="${r.title}" data-body="${r.body}" data-off="${r.is_official_text}" data-active="${r.is_active}">সম্পাদনা</button>` : ''}</article>`)}
    ${sectionTitle('নির্ধারিত মান ও নীতি')}
    <div class="card list">${sets.map((s) => h`<div class="li"><div><b>${s.label}</b>${s.description ? h`<small class="muted">${s.description}</small>` : ''}</div><div class="right"><b>${settingValue(s)}</b>${mr ? h`<button class="btn outline small noprint" data-act="setting-edit" data-key="${s.setting_key}" data-label="${s.label}" data-unit="${s.unit || ''}" data-val="${s.value_int === null ? '' : s.value_int}">বদলান</button>` : ''}</div></div>`)}</div>
    <p class="muted small">যে মান "নির্ধারিত হয়নি", সেটি সমিতির সিদ্ধান্ত ছাড়া ধরে নেওয়া হয় না এবং কোনো হিসাবে ব্যবহার হয় না।</p>`;
});
ACTIONS['rule-edit'] = (t) => {
  const d = t.dataset;
  openModal({
    title: 'ধারা সম্পাদনা', submitLabel: 'সংরক্ষণ',
    body: h`${field({ label: 'শিরোনাম', name: 'title', value: d.title, required: true })}${textArea({ label: 'ধারার বিবরণ', name: 'body', value: d.body, rows: 6, required: true, maxlength: 3000 })}
      <label class="row gap chk"><input type="checkbox" name="off" ${d.off === 'true' ? 'checked' : ''}> <span>এটি অফিসিয়াল গঠনতন্ত্রের হুবহু ভাষা (মিলিয়ে নিশ্চিত হলেই টিক দিন)</span></label>
      <label class="row gap chk"><input type="checkbox" name="active" ${d.active === 'true' ? 'checked' : ''}> <span>সক্রিয় (সদস্যদের দেখাবে)</span></label>`,
    onSubmit: async (v) => {
      if (!(v.title || '').trim() || !(v.body || '').trim()) throw new Error('শিরোনাম ও বিবরণ লিখুন।');
      await db.update('association_rules', { id: `eq.${d.id}` }, { title: v.title.trim(), body: v.body.trim(), is_official_text: v.off !== undefined, is_active: v.active !== undefined, updated_by: S.ctx.user_id });
      toast('ধারা সংরক্ষিত হয়েছে।'); renderRoute();
    },
  });
};
ACTIONS['setting-edit'] = (t) => {
  const d = t.dataset, isPaisa = d.unit === 'পয়সা';
  openModal({
    title: d.label, submitLabel: 'সংরক্ষণ',
    body: h`${field({ label: isPaisa ? 'পরিমাণ (টাকা)' : `মান (${d.unit})`, name: 'val', value: isPaisa ? paisaToInput(+d.val) : d.val, inputmode: 'decimal', hint: 'ফাঁকা রাখলে "নির্ধারিত হয়নি" হবে। কমিটির সিদ্ধান্ত অনুযায়ী লিখুন।' })}`,
    onSubmit: async (v) => {
      const raw = (v.val || '').trim(); let val = null;
      if (raw) {
        if (isPaisa) { val = parseTaka(raw); } else { const n = fromBn(raw); val = /^\d+$/.test(n) ? +n : null; }
        if (val === null) throw new Error('সঠিক সংখ্যা লিখুন।');
      }
      await db.update('association_settings', { setting_key: `eq.${d.key}` }, { value_int: val, updated_by: S.ctx.user_id });
      toast('সংরক্ষিত হয়েছে।'); renderRoute();
    },
  });
};

/* ----- অডিট লগ ----- */
const AUDIT_ENT = { savings_transactions: 'সঞ্চয় খতিয়ান', deposit_requests: 'জমার অনুরোধ', income_transactions: 'আয়', expense_transactions: 'ব্যয়', members: 'সদস্য', profiles: 'ব্যবহারকারী', committee_members: 'কমিটি', notices: 'নোটিশ', association_rules: 'নিয়মাবলি', association_settings: 'নীতি/সেটিংস' };
const AUDIT_ACT = { INSERT: 'যোগ', UPDATE: 'পরিবর্তন', DELETE: 'মোছা' };
const AU = { ent: '' };
CHANGES['audit-ent'] = (t) => { AU.ent = t.value; renderRoute(); };
route('/audit', async () => {
  const filter = AU.ent ? { entity_type: `eq.${AU.ent}` } : {};
  const [rows, profs] = await Promise.all([db.select('audit_logs', { select: 'id,actor_id,action,entity_type,entity_id,note,created_at,new_data', filter, order: 'id.desc', limit: 100 }), db.select('profiles', { select: 'id,full_name' })]);
  const nm = Object.fromEntries(profs.map((p) => [p.id, p.full_name]));
  return h`<h1>অডিট লগ</h1><p class="muted small">কে কখন কী করেছেন তার স্থায়ী রেকর্ড। এটি কেউ বদলাতে বা মুছতে পারে না। সর্বশেষ ১০০টি দেখানো হচ্ছে।</p>
    <label class="field"><span>খাত</span><select data-change="audit-ent"><option value="">সব</option>${Object.entries(AUDIT_ENT).map(([k, v]) => h`<option value="${k}" ${AU.ent === k ? 'selected' : ''}>${v}</option>`)}</select></label>
    ${rows.length ? h`<div class="card list">${rows.map((r) => h`<div class="li"><div><b>${AUDIT_ENT[r.entity_type] || r.entity_type} — ${AUDIT_ACT[r.action] || r.action}</b><small class="muted">${nm[r.actor_id] || (r.actor_id ? 'অজানা ব্যবহারকারী' : 'সিস্টেম')} · ${formatDateTime(r.created_at)}</small>${r.note ? h`<small>${r.note}</small>` : ''}</div></div>`)}</div>` : empty('কোনো রেকর্ড নেই।')}`;
}, () => can('view_audit'));
/* ---------- চালু ---------- */
let starting = null;
function loadAndStart() {
  if (!starting) starting = (async () => { await loadContext(); startApp(); })().finally(() => { starting = null; });
  return starting;
}
authListeners.push((s) => {
  if (!s) { S.ctx = null; showLogin(); return; }
  if (S.ctx && S.ctx.user_id === s.user.id) return; // শুধু টোকেন নবায়ন
  loadAndStart();
});
(async function boot() {
  if (!configured()) {
    $('#root').innerHTML = toHtml(h`<div class="auth"><div class="card"><h2>সেটআপ বাকি</h2>${keyProblem() === 'secret' ? h`<p class="neg"><b>বিপজ্জনক:</b> config.js-এ গোপন (secret/service_role) key বসানো আছে! অ্যাপ চলবে না। এখনই ওই ফাইল থেকে key সরান এবং Supabase-এ সেই key বদলে (rotate) নিন; শুধু publishable (বা anon) key ব্যবহার করুন।</p>` : h`<p>config.js ফাইলে Supabase-এর URL ও publishable key বসানো হয়নি। গাইড অনুযায়ী ফাইলটি ঠিক করুন।</p>`}</div></div>`);
    return;
  }
  if (session) await loadAndStart(); else showLogin();
})();
})();
