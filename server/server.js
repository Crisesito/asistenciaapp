require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { Usuario, Actividad, Persona, Participacion } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const db = require('./database'); // ajusta la ruta si es necesario


// Configuración de middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware para verificar la base de datos
app.use((req, res, next) => {
    req.dbReady = true;
    next();
});

// Rutas de autenticación
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    Usuario.autenticar(username, password, (err, user) => {
        if (err || !user) {
            console.error('Error de autenticación:', err || 'Credenciales inválidas');
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        req.session.user = { 
            id: user.id, 
            username: user.username 
        };
        res.json({ message: 'Autenticación exitosa', user: { username: user.username } });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Sesión cerrada correctamente' });
    });
});

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};

// Rutas protegidas
app.use('/api', requireAuth);

// Gestión de actividades
app.post('/api/actividades', (req, res) => {
    const { area, nombre, fecha, region } = req.body;
    
    if (!area || !nombre || !fecha || !region) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    Actividad.crear(area, nombre, fecha, region, (err, id) => {
        if (err) {
            console.error('Error al crear actividad:', err);
            return res.status(500).json({ error: 'Error al crear actividad' });
        }
        res.json({ id, message: 'Actividad creada exitosamente' });
    });
});

app.get('/api/actividades', (req, res) => {
    Actividad.listar((err, actividades) => {
        if (err) {
            console.error('Error al listar actividades:', err);
            return res.status(500).json({ error: 'Error al obtener actividades' });
        }
        res.json(actividades);
    });
});
// En server.js, añade esto junto con las otras rutas de actividades
app.get('/api/actividades/filtradas', (req, res) => {
    const { area, region, fechaInicio, fechaFin } = req.query;
    
    let query = "SELECT id, nombre, fecha, region FROM actividades WHERE 1=1";
    const params = [];
    
    if (area) {
        query += " AND area = ?";
        params.push(area);
    }
    
    if (region) {
        query += " AND region = ?";
        params.push(region);
    }
    
    if (fechaInicio) {
        query += " AND fecha >= ?";
        params.push(fechaInicio);
    }
    
    if (fechaFin) {
        query += " AND fecha <= ?";
        params.push(fechaFin);
    }
    
    query += " ORDER BY fecha DESC";
    
    db.all(query, params, (err, actividades) => {
        if (err) {
            console.error('Error al filtrar actividades:', err);
            return res.status(500).json({ error: 'Error al obtener actividades' });
        }
        res.json(actividades);
    });
});

// Importación de participantes
app.post('/api/participantes/importar', (req, res) => {
    const { actividadId, participantes } = req.body;
    
    if (!actividadId || !participantes || !Array.isArray(participantes)) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }
    
    let importados = 0;
    let errores = 0;
    const erroresDetalle = [];

    const procesarParticipante = (index) => {
        if (index >= participantes.length) {
            return res.json({ 
                importados, 
                errores,
                erroresDetalle: erroresDetalle.slice(0, 5) // Limitar a 5 errores
            });
        }
        
        const { rut, nombre, email } = participantes[index];
        
        if (!rut || !nombre) {
            errores++;
            erroresDetalle.push(`Fila ${index + 1}: RUT o nombre faltante`);
            return procesarParticipante(index + 1);
        }

        Persona.crear(rut, nombre, email, (err, personaId) => {
            if (err) {
                errores++;
                erroresDetalle.push(`Fila ${index + 1}: ${err.message}`);
                return procesarParticipante(index + 1);
            }
            
            Participacion.registrar(personaId, actividadId, (err) => {
                if (err) {
                    errores++;
                    erroresDetalle.push(`Fila ${index + 1}: ${err.message}`);
                } else {
                    importados++;
                }
                procesarParticipante(index + 1);
            });
        });
    };
    
    procesarParticipante(0);
});

// Reportes
app.get('/api/reportes/por-actividad', (req, res) => {
    const { actividadId } = req.query;
    
    if (!actividadId || isNaN(actividadId)) {
        return res.status(400).json({ error: 'ID de actividad inválido' });
    }

    Participacion.obtenerReportePorActividad(parseInt(actividadId), (err, reporte) => {
        if (err) {
            console.error('Error al generar reporte:', err);
            return res.status(500).json({ error: 'Error al generar reporte' });
        }
        res.json(reporte);
    });
});

// Cambia la ruta de reporte general a GET
app.get('/api/reportes/general', (req, res) => {
    const { areas, regiones, fechaInicio, fechaFin, rut } = req.query;
    
    Participacion.obtenerReporteGeneral({
        areas: areas ? areas.split(',') : ['Emprendimiento', 'Voluntariado'],
        regiones: regiones ? regiones.split(',') : [],
        fechaInicio,
        fechaFin,
        rut
    }, (err, reporte) => {
        if (err) {
            console.error('Error al generar reporte general:', err);
            return res.status(500).json({ error: 'Error al generar reporte' });
        }
        res.json(reporte);
    });
});

// Ruta de verificación de sesión
app.get('/api/session', (req, res) => {
    res.json({
        authenticated: !!req.session.user,
        user: req.session.user || null
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Base de datos inicializada correctamente');
});