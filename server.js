const qrcode = require('qrcode');
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = '';

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // ටර්මිනල් එකේ පෙන්වීම නවත්වයි
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) {
            latestQR = qr; // QR කෝඩ් ස්ට්‍රින්ග් එක සේව් කරගනී
        }
        if (connection === 'open') {
            console.log('WhatsApp Connected Successfully!');
            latestQR = '';
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// බ්‍රව්සරයෙන් QR කෝඩ් එක බලාගන්න එන්ඩ්පොයින්ට් එකක්
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