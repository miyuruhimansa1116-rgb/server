const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = '';

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
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
            
            // 515 එරර් එකක් හෝ වෙනත් බිඳ වැටීමක් ආවොත් ස්වයංක්‍රීයව නැවත පණගන්වයි
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