'use strict';

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const axios     = require('axios');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
});

const PORT            = process.env.PORT || 3000;
const MAILPIT_API_URL = process.env.MAILPIT_API_URL || 'http://mailpit:8025';
const MAIL_DOMAIN     = process.env.MAIL_DOMAIN || 'tempmail.local';
const POLL_INTERVAL   = 3000; 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.json());

app.get('/', (req, res) => {
    res.render('index', {
        mailDomain: MAIL_DOMAIN,
    });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const sessions = new Map(); 

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('subscribe', async ({ email, token }) => {
        if (!email || !token) return;

        console.log(`[Socket] ${socket.id} subscribed to ${email}`);

        const session = {
            email,
            token,
            lastIds: new Set(),
            timer: null,
        };
        sessions.set(socket.id, session);

        session.timer = setInterval(async () => {
            await pollEmails(socket, session);
        }, POLL_INTERVAL);

        await pollEmails(socket, session);
    });

    socket.on('disconnect', () => {
        const session = sessions.get(socket.id);
        if (session) {
            clearInterval(session.timer);
            sessions.delete(socket.id);
        }
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

async function pollEmails(socket, session) {
    try {
        const query    = encodeURIComponent(`to:${session.email}`);
        const response = await axios.get(
            `${MAILPIT_API_URL}/api/v1/messages?query=${query}&limit=50`,
            { timeout: 5000 }
        );

        const messages = response.data?.messages || [];

        for (const msg of messages) {
            if (!session.lastIds.has(msg.ID)) {
                session.lastIds.add(msg.ID);

                socket.emit('new_email', {
                    id:      msg.ID,
                    subject: msg.Subject || '(Sans objet)',
                    from:    formatAddress(msg.From),
                    date:    msg.Date,
                    read:    msg.Read || false,
                });
            }
        }

        socket.emit('email_count', { count: messages.length });

    } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
            console.error(`[Poll Error] ${session.email}: ${err.message}`);
        }
    }
}

function formatAddress(addr) {
    if (!addr) return 'Inconnu';
    if (addr.Name) return `${addr.Name} <${addr.Address}>`;
    return addr.Address || 'Inconnu';
}

server.listen(PORT, () => {
    console.log(`\nFrontend ${PORT}`);
    console.log(`Mail domain: ${MAIL_DOMAIN}`);
});
