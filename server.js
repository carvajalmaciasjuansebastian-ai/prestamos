const express = require('express');
const multer = require('multer');
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // <-- 1. Importamos CORS

const app = express();
const PORT = process.env.PORT || 3000; 

// 2. Permitimos que tu web de Netlify envíe datos sin restricciones de seguridad
app.use(cors({
    origin: '*', // Puedes cambiar el '*' por tu URL de Netlify (ej: 'https://tu-sitio.netlify.app') para mayor seguridad
    methods: ['POST', 'GET']
}));

// CONFIGURACIÓN DE TELEGRAM
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error("❌ ERROR: Falta configurar BOT_TOKEN o CHAT_ID en las variables de entorno.");
}

const bot = new Telegraf(BOT_TOKEN);

// CONFIGURACIÓN DE ALMACENAMIENTO TEMPORAL
const upload = multer({ 
    dest: '/tmp/',
    limits: { fileSize: 45 * 1024 * 1024 } 
});

app.use(express.urlencoded({ extended: true }));

// RUTA QUE RECIBE EL FORMULARIO DESDE NETLIFY
app.post('/solicitar', upload.fields([{ name: 'fotos[]' }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { nombre, documento, telefono, comercio } = req.body;
        
        const mensaje = `
🔔 *NUEVA SOLICITUD DE CRÉDITO*
━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${nombre}
🪪 *Documento:* ${documento}
📱 *WhatsApp:* [${telefono}](https://wa.me/${telefono.replace(/[^0-9]/g, '')})
🏪 *Comercio:* ${comercio}
━━━━━━━━━━━━━━━━━━━━━━━━
*Archivos adjuntos a continuación...*
        `;

        await bot.telegram.sendMessage(CHAT_ID, mensaje, { parse_mode: 'Markdown' });

        if (req.files['fotos[]'] && req.files['fotos[]'].length > 0) {
            const mediaGroup = req.files['fotos[]'].map((file, index) => ({
                type: 'photo',
                media: { source: file.path },
                caption: index === 0 ? `📷 Fotos de: ${comercio}` : ''
            }));
            
            await bot.telegram.sendMediaGroup(CHAT_ID, mediaGroup);
            req.files['fotos[]'].forEach(file => fs.unlinkSync(file.path));
        }

        if (req.files['video'] && req.files['video'].length > 0) {
            const videoFile = req.files['video'][0];
            
            await bot.telegram.sendVideo(CHAT_ID, { source: videoFile.path }, {
                caption: `🎥 Video del comercio: ${comercio}`
            });
            
            fs.unlinkSync(videoFile.path);
        }

        // Redirección o respuesta bonita de éxito
        res.send(`
            <script src="https://cdn.tailwindcss.com"></script>
            <body class="bg-gray-50 flex items-center justify-center h-screen font-sans">
                <div class="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm mx-4">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                    <h1 class="text-2xl font-bold text-gray-900">¡Solicitud Enviada!</h1>
                    <p class="text-gray-500 mt-2 text-sm">Gracias ${nombre}. Hemos recibido tus datos y los archivos de ${comercio}. Nos comunicaremos contigo por WhatsApp en menos de 24 horas.</p>
                    <button onclick="window.history.go(-1)" class="mt-6 inline-block bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">Volver a la página</button>
                </div>
            </body>
        `);

    } catch (error) {
        console.error("Error procesando la solicitud:", error);
        res.status(500).send("Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de procesamiento corriendo en el puerto ${PORT}`);
});