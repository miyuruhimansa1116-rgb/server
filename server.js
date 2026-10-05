const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const cors = require('cors'); // CORS එකතු කිරීම
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS සහ JSON රික්වෙස්ට් හැසිරවීම සඳහා
app.use(cors());
app.use(express.json());

let latestQR = '';
let sock = null; // WhatsApp socket එක global ව තබා ගැනීම

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            qrcodeTerminal.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            if (shouldReconnect) {
                startWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp Connected Successfully!');
            latestQR = '';
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// POS වෙබ් ඇප් එකෙන් බිල් මැසේජ් එක යැවීමට අදාළ Endpoint එක
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }

        if (!sock) {
            return res.status(500).json({ error: 'WhatsApp socket is not initialized yet' });
        }

        // WhatsApp අංකය සකස් කර ගැනීම (උදා: 9477xxxxxxx@s.whatsapp.net)
        const formattedJid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;

        // මැසේජ් එක යැවීම
        await sock.sendMessage(formattedJid, { text: message });

        console.log(`Message sent successfully to ${phone}`);
        res.status(200).json({ success: true, message: 'WhatsApp message sent successfully' });
    } catch (err) {
        console.error('Error sending WhatsApp message:', err);
        res.status(500).json({ error: err.message || 'Failed to send message' });
    }
});

app.get('/qr', async (req, res) => {
    if (!latestQR) {
        return res.send('<h3>WhatsApp is already connected or QR is not generated yet!</h3>');
    }
    try {
        const urlImage = await qrcode.toDataURL(latestQR);
        res.send(`
            <div style="text-align: center; margin-top: 50px;">
                <h2>Scan this QR Code with WhatsApp</h2>
                <img src="${urlImage}" alt="WhatsApp QR Code" style="width: 300px; height: 300px;" />
            </div>
        `);
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

app.get('/ping', (req, res) => {
    res.send('Pong! Server is awake.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startWhatsApp();
});