require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { Usuario, Actividad, Persona, Participacion } = require('./models');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Cambiar a true en producción con HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 día
    }
}));

// Middleware de autenticación
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado' });
    }
}

// ======================
// 1. Rutas de Autenticación
// ======================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    Usuario.autenticar(username, password, (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        req.session.user = { id: user.id, username: user.username };
        res.json({ message: 'Autenticación exitosa' });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.json({ message: 'Sesión cerrada' });
    });
});

app.get('/api/session', (req, res) => {
    res.json({ 
        authenticated: !!req.session.user,
        user: req.session.user || null
    });
});

// ======================
// 2. Rutas Protegidas
// ======================
app.use('/api', requireAuth);

// Actividades
app.get('/api/actividades', (req, res) => {
    Actividad.listar((err, actividades) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(actividades);
    });
});

app.post('/api/actividades', (req, res) => {
    const { nombre, fecha } = req.body;
    
    if (!nombre || !fecha) {
        return res.status(400).json({ error: 'Nombre y fecha requeridos' });
    }
    
    Actividad.crear(nombre, fecha, (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, nombre, fecha });
    });
});

// Participantes
app.post('/api/participantes/importar', (req, res) => {
    const { actividadId, participantes } = req.body;
    
    if (!actividadId || !participantes || !Array.isArray(participantes)) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }
    
    let importados = 0;
    let errores = 0;
    
    const procesarParticipante = (index) => {
        if (index >= participantes.length) {
            return res.json({ importados, errores });
        }
        
        const { rut, nombre } = participantes[index];
        
        if (!rut || !nombre) {
            errores++;
            return procesarParticipante(index + 1);
        }
        
        Persona.crear(rut, nombre, (err, personaId) => {
            if (err) {
                errores++;
            } else {
                Participacion.registrar(personaId, actividadId, (err) => {
                    if (!err) importados++;
                });
            }
            procesarParticipante(index + 1);
        });
    };
    
    procesarParticipante(0);
});

// Reportes
app.get('/api/reportes', (req, res) => {
    Participacion.obtenerReporte((err, reporte) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(reporte);
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});