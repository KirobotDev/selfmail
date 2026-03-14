'use strict';

const API_BASE = '/api/mailbox';

let currentEmail  = null;
let currentToken  = null;
let expiresAt     = null;
let timerInterval = null;
let toastTimeout  = null;
let emails        = [];
let selectedId    = null;
let socket        = null;

const emailDisplay    = document.getElementById('email-display');
const btnCopy         = document.getElementById('btn-copy');
const btnCopy2        = document.getElementById('btn-copy-2');
const iconCopy        = document.getElementById('icon-copy');
const iconCheck       = document.getElementById('icon-check');
const btnNew          = document.getElementById('btn-new');
const btnRefresh      = document.getElementById('btn-refresh');
const iconRefresh     = document.getElementById('icon-refresh');
const btnDeleteAll    = document.getElementById('btn-delete-all');
const timerEl         = document.getElementById('timer-display');
const connDot         = document.getElementById('conn-dot');
const connLabel       = document.getElementById('conn-label');
const emptyState      = document.getElementById('empty-state');
const emailListEl     = document.getElementById('email-list');
const detailSection   = document.getElementById('detail-section');
const detailSubject   = document.getElementById('detail-subject');
const detailFrom      = document.getElementById('detail-from');
const detailDate      = document.getElementById('detail-date');
const detailIframe    = document.getElementById('detail-iframe');
const detailText      = document.getElementById('detail-text');
const btnCloseDetail  = document.getElementById('btn-close-detail');
const toast           = document.getElementById('toast');
const toastSubject    = document.getElementById('toast-subject');
const toastFrom       = document.getElementById('toast-from');
const modalNew        = document.getElementById('modal-new');
const modalCancel     = document.getElementById('modal-cancel');
const modalConfirm    = document.getElementById('modal-confirm');
const modalDeleteAll  = document.getElementById('modal-delete-all');
const modalDelCancel  = document.getElementById('modal-del-cancel');
const modalDelConfirm = document.getElementById('modal-del-confirm');

async function init() {
    const t  = localStorage.getItem('tempmail_token');
    const e  = localStorage.getItem('tempmail_email');
    const ex = parseInt(localStorage.getItem('tempmail_expires') || '0', 10);

    if (t && e && Date.now() / 1000 < ex) {
        currentToken = t;
        currentEmail = e;
        expiresAt    = ex;
        setEmail(e);
        startTimer();
        connectSocket();
        await refreshInbox();
    } else {
        await generateNew();
    }
}

async function generateNew() {
    if (currentToken) await deleteMailbox(currentToken);
    emailDisplay.textContent = 'Génération en cours...';
    clearList();
    closeDetail();

    try {
        const r    = await fetch(`${API_BASE}/generate`);
        const data = await r.json();
        if (!data.success) throw new Error(data.error || 'Erreur');

        currentEmail = data.email;
        currentToken = data.token;
        expiresAt    = data.expires;

        localStorage.setItem('tempmail_email',   currentEmail);
        localStorage.setItem('tempmail_token',   currentToken);
        localStorage.setItem('tempmail_expires', String(expiresAt));

        setEmail(currentEmail);
        startTimer();
        connectSocket();
    } catch (err) {
        emailDisplay.textContent = 'Erreur: ' + err.message;
    }
}

async function refreshInbox() {
    if (!currentToken) return;
    iconRefresh.classList.add('spinning');
    btnRefresh.disabled = true;

    try {
        const r    = await fetch(`${API_BASE}/emails?token=${encodeURIComponent(currentToken)}`);
        const data = await r.json();
        if (!data.success) throw new Error(data.error);

        for (const em of data.emails || []) {
            if (!emails.find(e => e.id === em.id)) {
                emails.push(em);
            }
        }
        renderList();

        const count = data.emails ? data.emails.length : 0;
        showInfoToast(count === 0 ? 'Pas de nouveaux emails' : `${count} email(s) chargé(s)`);
    } catch (_) {
        showInfoToast('Erreur lors du rafraîchissement');
    }

    iconRefresh.classList.remove('spinning');
    btnRefresh.disabled = false;
}

async function deleteAllEmails() {
    if (!currentToken) return;

    try {
        await fetch(`${API_BASE}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken }),
        });
    } catch (_) {}

    clearList();
    closeDetail();
    showInfoToast('Tous les emails supprimés');
}

function connectSocket() {
    if (socket) socket.disconnect();
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        setConn('on', 'Connecté');
        socket.emit('subscribe', { email: currentEmail, token: currentToken });
    });
    socket.on('disconnect',    () => setConn('off', 'Déconnecté'));
    socket.on('connect_error', () => setConn('off', 'Erreur'));

    socket.on('new_email', (em) => {
        if (emails.find(e => e.id === em.id)) return;
        emails.unshift(em);
        renderList();
        showToast(em);
    });
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(() => {
        const rem = remaining();
        updateTimer(rem);
        if (rem <= 0) { clearInterval(timerInterval); generateNew(); }
    }, 1000);
}

function remaining() {
    return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
}

function updateTimer(rem) {
    if (rem === undefined) rem = remaining();
    const m = String(Math.floor(rem / 60)).padStart(2, '0');
    const s = String(rem % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    if (rem < 120) timerEl.classList.add('danger');
    else timerEl.classList.remove('danger');
}

function renderList() {
    while (emailListEl.firstChild) emailListEl.removeChild(emailListEl.firstChild);

    if (emails.length === 0) {
        emailListEl.style.display = 'none';
        emptyState.style.display  = 'block';
        return;
    }

    emptyState.style.display  = 'none';
    emailListEl.style.display = 'block';

    emails.forEach(em => {
        const row = document.createElement('div');
        row.className = ['email-row', em.id === selectedId ? 'active' : '', !em.read ? 'unread' : ''].filter(Boolean).join(' ');
        row.dataset.id = em.id;

        const senderWrap = document.createElement('div');
        senderWrap.className = 'row-sender-wrap';

        const dot = document.createElement('span');
        dot.className = 'row-unread-dot';

        const senderEl = document.createElement('span');
        senderEl.className = 'row-sender';
        senderEl.textContent = em.from || 'Inconnu';

        senderWrap.appendChild(dot);
        senderWrap.appendChild(senderEl);

        const subjectEl = document.createElement('span');
        subjectEl.className = 'row-subject';
        subjectEl.textContent = em.subject || '(Sans objet)';

        const actionsEl = document.createElement('div');
        actionsEl.className = 'row-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Voir';
        viewBtn.addEventListener('click', (e) => { e.stopPropagation(); openEmail(em.id); });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-del-row';
        delBtn.title = 'Supprimer';

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('fill', 'none');
        svgEl.setAttribute('stroke', 'currentColor');
        svgEl.setAttribute('viewBox', '0 0 24 24');
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('d', 'M6 18L18 6M6 6l12 12');
        svgEl.appendChild(pathEl);
        delBtn.appendChild(svgEl);
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeEmail(em.id); });

        actionsEl.appendChild(viewBtn);
        actionsEl.appendChild(delBtn);

        row.appendChild(senderWrap);
        row.appendChild(subjectEl);
        row.appendChild(actionsEl);

        row.addEventListener('click', () => openEmail(em.id));
        emailListEl.appendChild(row);
    });
}

function clearList() {
    emails     = [];
    selectedId = null;
    renderList();
}

async function removeEmail(id) {
    emails = emails.filter(e => e.id !== id);
    if (selectedId === id) closeDetail();
    renderList();

    try {
        await fetch(`${API_BASE}/email/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken }),
        });
    } catch (_) {}
}

async function openEmail(id) {
    selectedId = id;
    const em = emails.find(e => e.id === id);
    if (em) em.read = true;
    renderList();

    detailSection.style.display = 'block';
    detailSubject.textContent   = 'Chargement...';
    detailFrom.textContent      = '';
    detailDate.textContent      = '';
    detailIframe.style.display  = 'none';
    detailText.style.display    = 'none';
    detailText.textContent      = '';

    try {
        const r    = await fetch(`${API_BASE}/email/${encodeURIComponent(id)}?token=${encodeURIComponent(currentToken)}`);
        const data = await r.json();
        if (!data.success) throw new Error(data.error);

        const msg = data.message;
        detailSubject.textContent = msg.subject || '(Sans objet)';
        detailFrom.textContent    = msg.from    || 'Inconnu';
        detailDate.textContent    = fmtFull(msg.date);

        if (msg.html) {
            detailIframe.style.display = 'block';
            detailText.style.display   = 'none';

            const htmlContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.65;color:#1f2937;padding:16px;margin:0;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#0cc9a4;}</style></head><body>' + msg.html + '</body></html>';
            const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);

            if (detailIframe._prevBlob) URL.revokeObjectURL(detailIframe._prevBlob);
            detailIframe._prevBlob = blobUrl;
            detailIframe.src = blobUrl;

            detailIframe.onload = () => {
                try {
                    const h = detailIframe.contentDocument.body.scrollHeight;
                    detailIframe.style.height = Math.max(200, h + 20) + 'px';
                } catch (_) {}
            };

        } else {
            detailIframe.style.display = 'none';
            detailText.style.display   = 'block';
            detailText.textContent     = msg.text || '(Email vide)';
        }
        detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        detailSubject.textContent = 'Erreur';
        detailText.style.display  = 'block';
        detailText.textContent    = err.message;
    }
}

function closeDetail() {
    selectedId = null;
    detailSection.style.display = 'none';
    renderList();
}

async function copyEmail() {
    if (!currentEmail) return;
    try {
        await navigator.clipboard.writeText(currentEmail);
    } catch (_) {
        const el = document.createElement('textarea');
        el.value = currentEmail;
        el.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }
    iconCopy.style.display  = 'none';
    iconCheck.style.display = 'block';
    setTimeout(() => {
        iconCopy.style.display  = 'block';
        iconCheck.style.display = 'none';
    }, 2000);
}

function showToast(em) {
    clearTimeout(toastTimeout);
    toastSubject.textContent = em.subject || 'Nouvel email';
    toastFrom.textContent    = em.from    || '';
    toast.classList.add('show');
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

function showInfoToast(msg) {
    clearTimeout(toastTimeout);
    toastSubject.textContent = msg;
    toastFrom.textContent    = '';
    toast.classList.add('show');
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

function setConn(state, label) {
    connDot.className = state === 'on' ? 'on' : state === 'off' ? 'off' : '';
    connLabel.textContent = label;
}

function setEmail(email) {
    emailDisplay.textContent = email;
}

async function deleteMailbox(token) {
    if (!token) return;
    try {
        await fetch(`${API_BASE}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            keepalive: true,
        });
    } catch (_) {}
    localStorage.removeItem('tempmail_token');
    localStorage.removeItem('tempmail_email');
    localStorage.removeItem('tempmail_expires');
}

function fmtFull(str) {
    if (!str) return '';
    try {
        return new Date(str).toLocaleString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch (_) { return str; }
}

function openModal(modal) {
    modal.classList.add('open');
}

function closeModal(modal) {
    modal.classList.remove('open');
}

btnCopy.addEventListener('click', copyEmail);
btnCopy2.addEventListener('click', copyEmail);

btnNew.addEventListener('click', () => openModal(modalNew));
modalCancel.addEventListener('click', () => closeModal(modalNew));
modalNew.addEventListener('click', (e) => { if (e.target === modalNew) closeModal(modalNew); });
modalConfirm.addEventListener('click', () => { closeModal(modalNew); generateNew(); });

btnDeleteAll.addEventListener('click', () => openModal(modalDeleteAll));
modalDelCancel.addEventListener('click', () => closeModal(modalDeleteAll));
modalDeleteAll.addEventListener('click', (e) => { if (e.target === modalDeleteAll) closeModal(modalDeleteAll); });
modalDelConfirm.addEventListener('click', () => { closeModal(modalDeleteAll); deleteAllEmails(); });

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal(modalNew);
        closeModal(modalDeleteAll);
    }
});

btnRefresh.addEventListener('click', refreshInbox);

btnCloseDetail.addEventListener('click', closeDetail);

window.addEventListener('beforeunload', () => {
    if (currentToken) deleteMailbox(currentToken);
});

init();
