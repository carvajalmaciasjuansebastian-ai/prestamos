const express = require('express');
const multer = require('multer');
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors({
    origin: '*', 
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👀 NUEVA RUTA: NOTIFICACIÓN DE VISITANTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Llama a esta ruta mediante un fetch GET en el frontend apenas cargue la página
app.get('/visitante', async (req, res) => {
    try {
        const mensajeVisita = `👀 *¡Alguien acaba de entrar a la web de créditos!*`;
        await bot.telegram.sendMessage(CHAT_ID, mensajeVisita, { parse_mode: 'Markdown' });
        return res.status(200).json({ success: true, message: "Visita notificada" });
    } catch (error) {
        console.error("Error al notificar visitante:", error);
        return res.status(500).json({ success: false });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 RUTA CORREGIDA: RECIBE EL FORMULARIO (Cambiada a /solicitud)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.post('/solicitud', upload.fields([{ name: 'fotos[]' }, { name: 'video', maxCount: 1 }]), async (req, res) => {
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
            req.files['fotos[]'].forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }

        if (req.files['video'] && req.files['video'].length > 0) {
            const videoFile = req.files['video'][0];
            
            await bot.telegram.sendVideo(CHAT_ID, { source: videoFile.path }, {
                caption: `🎥 Video del comercio: ${comercio}`
            });
            
            if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
        }

        // RETORNO JSON COMPATIBLE CON TU FETCH FRONTEND
        return res.status(200).json({ 
            success: true, 
            message: "Datos y archivos procesados correctamente en el servidor." 
        });

    } catch (error) {
        console.error("Error procesando la solicitud:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Hubo un error interno en el servidor al procesar los archivos." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
