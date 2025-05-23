require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { Usuario, Actividad, Persona, Participacion } = require('./models');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado' });
    }
}

// Rutas de Autenticación
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

// Rutas Protegidas
app.use('/api', requireAuth);

// Actividades
app.get('/api/actividades', (req, res) => {
    Actividad.listar((err, actividades) => {
        if (err) {
            console.error('Error al listar actividades:', err);
            return res.status(500).json({ error: 'Error al obtener actividades' });
        }
        res.json(actividades);
    });
});

app.get('/api/actividades/por-area', (req, res) => {
    const { area } = req.query;
    if (!area) {
        return res.status(400).json({ error: 'Área requerida' });
    }
    
    Actividad.listarPorArea(area, (err, actividades) => {
        if (err) {
            console.error('Error al listar actividades por área:', err);
            return res.status(500).json({ error: 'Error al obtener actividades' });
        }
        res.json(actividades);
    });
});

app.post('/api/actividades', (req, res) => {
    const { area, nombre, fecha } = req.body;
    
    console.log('Datos recibidos:', { area, nombre, fecha }); // Log para depuración
    
    if (!area || !nombre || !fecha) {
        console.error('Faltan campos requeridos');
        return res.status(400).json({ 
            error: 'Área, nombre y fecha requeridos',
            received: req.body
        });
    }
    
    if (!['Emprendimiento', 'Voluntariado'].includes(area)) {
        console.error('Área no válida:', area);
        return res.status(400).json({ 
            error: 'Área no válida. Use Emprendimiento o Voluntariado'
        });
    }
    
    Actividad.crear(area, nombre, fecha, (err, id) => {
        if (err) {
            console.error('Error en la base de datos:', err);
            return res.status(500).json({ 
                error: 'Error al crear actividad en DB',
                details: err.message 
            });
        }
        console.log('Actividad creada con ID:', id);
        res.json({ 
            id, 
            area, 
            nombre, 
            fecha,
            message: 'Actividad creada exitosamente'
        });
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
        
        const { rut, nombre, email } = participantes[index];
        
        if (!rut || !nombre) {
            errores++;
            return procesarParticipante(index + 1);
        }
        
        Persona.crear(rut, nombre, email, (err, personaId) => {
            if (err) {
                console.error('Error al crear persona:', err);
                errores++;
            } else {
                Participacion.registrar(personaId, actividadId, (err) => {
                    if (err) {
                        console.error('Error al registrar participación:', err);
                        errores++;
                    } else {
                        importados++;
                    }
                });
            }
            procesarParticipante(index + 1);
        });
    };
    
    procesarParticipante(0);
});

// Reportes
app.get('/api/reportes/por-actividad', (req, res) => {
    const { actividadId } = req.query;
    
    console.log('Solicitud de reporte para actividad ID:', actividadId); // Log para depuración
    
    if (!actividadId || isNaN(actividadId)) {
        console.error('ID de actividad no válido:', actividadId);
        return res.status(400).json({ 
            error: 'ID de actividad requerido y debe ser numérico',
            received: actividadId
        });
    }

    Participacion.obtenerReportePorActividad(parseInt(actividadId), (err, reporte) => {
        if (err) {
            console.error('Error al generar reporte:', err);
            return res.status(500).json({ 
                error: 'Error al generar reporte',
                details: err.message 
            });
        }
        console.log('Reporte generado con', reporte.length, 'registros');
        res.json(reporte);
    });
});

app.get('/api/reportes', (req, res) => {
    let areas = req.query.areas;
    
    if (!areas) {
        areas = ['Emprendimiento', 'Voluntariado'];
    } else if (typeof areas === 'string') {
        areas = [areas];
    }
    
    Participacion.obtenerReporteFiltrado(areas, (err, reporte) => {
        if (err) {
            console.error('Error al obtener reporte filtrado:', err);
            return res.status(500).json({ error: 'Error al generar reporte' });
        }
        res.json(reporte);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});