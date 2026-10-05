const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let connectionStatus = "disconnected";

// සර්වර් එක නිදාගැනීම (Sleep) වැළැක්වීමට සහ තත්ත්වය බැලීමට Ping route එකක්
app.get('/ping', (req, res) => {
    res.json({ status: "online", connection: connectionStatus });
});

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            connectionStatus = "disconnected";
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            connectionStatus = "connected";
            console.log('WhatsApp connected successfully to 0775431562!');
        }
    });
}

// මැසේජ් යවන API Endpoint එක
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ success: false, error: "Phone and message are required" });
        }

        if (connectionStatus !== "connected") {
            return res.status(500).json({ success: false, error: "WhatsApp is not connected yet. Please scan QR." });
        }

        // දුරකථන අංකය නිවැරදි ෆෝමැට් එකට සැකසීම (077... -> 9477... @s.whatsapp.net)
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '94' + formattedPhone.slice(1);
        }
        const jid = formattedPhone + '@s.whatsapp.net';

        await sock.sendMessage(jid, { text: message });

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectToWhatsApp();
});