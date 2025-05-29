const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH);

// Función para normalizar RUTs
function normalizarRUT(rut) {
    return rut.toString()
        .replace(/\./g, '')
        .replace(/\s/g, '')
        .replace(/-/g, '')
        .toUpperCase();
}

// Inicialización de la base de datos
const inicializarDB = (callback) => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area TEXT NOT NULL CHECK(area IN ('Emprendimiento', 'Voluntariado')),
            nombre TEXT NOT NULL,
            fecha TEXT NOT NULL,
            region TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rut TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            email TEXT,
            ultima_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS participaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id INTEGER NOT NULL,
            actividad_id INTEGER NOT NULL,
            fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (persona_id) REFERENCES personas(id),
            FOREIGN KEY (actividad_id) REFERENCES actividades(id),
            UNIQUE(persona_id, actividad_id)
        )`);

        // Insertar usuario admin por defecto
        db.run(`INSERT OR IGNORE INTO usuarios (username, password) VALUES (?, ?)`, 
            ['admin', 'Desafioadmin2024'], 
            (err) => {
                if (err) console.error("Error al crear usuario admin:", err);
                callback();
            }
        );
    });
};

// Modelo Usuario
const Usuario = {
    autenticar: (username, password, callback) => {
        db.get(
            "SELECT * FROM usuarios WHERE username = ? AND password = ?",
            [username, password],
            (err, row) => {
                if (err) {
                    if (err.message.includes('no such table')) {
                        return inicializarDB(() => Usuario.autenticar(username, password, callback));
                    }
                    return callback(err);
                }
                callback(null, row);
            }
        );
    }
};

// Modelo Actividad
const Actividad = {
    crear: (area, nombre, fecha, region, callback) => {
        db.run(
            "INSERT INTO actividades (area, nombre, fecha, region) VALUES (?, ?, ?, ?)",
            [area, nombre, fecha, region],
            function(err) {
                callback(err, this.lastID);
            }
        );
    },
    listar: (callback) => {
        db.all("SELECT * FROM actividades ORDER BY fecha DESC", callback);
    }
};

// Modelo Persona
const Persona = {
    crear: (rut, nombre, email, callback) => {
        const rutNormalizado = normalizarRUT(rut);
        db.run(
            `INSERT INTO personas (rut, nombre, email) VALUES (?, ?, ?)
             ON CONFLICT(rut) DO UPDATE SET
                nombre = excluded.nombre,
                email = COALESCE(excluded.email, email)`,
            [rutNormalizado, nombre.trim(), email?.trim() || null],
            function(err) {
                if (err) return callback(err);
                db.get("SELECT id FROM personas WHERE rut = ?", [rutNormalizado], (err, row) => {
                    callback(err, row?.id);
                });
            }
        );
    }
};

// Modelo Participacion
const Participacion = {
    registrar: (personaId, actividadId, callback) => {
        db.run(
            "INSERT OR IGNORE INTO participaciones (persona_id, actividad_id) VALUES (?, ?)",
            [personaId, actividadId],
            callback
        );
    },
    obtenerReportePorActividad: (actividadId, callback) => {
        db.all(
            `SELECT p.rut, p.nombre, COALESCE(p.email, 'N/A') as email
             FROM personas p
             JOIN participaciones part ON p.id = part.persona_id
             WHERE part.actividad_id = ?
             ORDER BY p.nombre`,
            [actividadId],
            callback
        );
    },
    obtenerReporteGeneral: (filtros, callback) => {
        const { areas = ['Emprendimiento', 'Voluntariado'], regiones = [], fechaInicio, fechaFin, rut } = filtros;
        
        // Consulta principal optimizada
        let query = `
            SELECT 
                p.id,
                p.rut,
                p.nombre,
                COALESCE(p.email, 'N/A') as email,
                a.area,
                a.region,
                COUNT(DISTINCT part.actividad_id) as asistencias,
                (
                    SELECT COUNT(DISTINCT a2.id) 
                    FROM actividades a2
                    WHERE a2.area IN (${areas.map(() => '?').join(',')})
                    ${regiones.length ? `AND a2.region IN (${regiones.map(() => '?').join(',')})` : ''}
                    ${fechaInicio ? `AND a2.fecha >= ?` : ''}
                    ${fechaFin ? `AND a2.fecha <= ?` : ''}
                ) as total_actividades,
                (
                    SELECT GROUP_CONCAT(a3.nombre, ', ')
                    FROM actividades a3
                    JOIN participaciones part3 ON a3.id = part3.actividad_id
                    WHERE part3.persona_id = p.id
                    AND a3.area IN (${areas.map(() => '?').join(',')})
                    ${regiones.length ? `AND a3.region IN (${regiones.map(() => '?').join(',')})` : ''}
                    ${fechaInicio ? `AND a3.fecha >= ?` : ''}
                    ${fechaFin ? `AND a3.fecha <= ?` : ''}
                ) as actividades_participadas
            FROM personas p
            JOIN participaciones part ON p.id = part.persona_id
            JOIN actividades a ON part.actividad_id = a.id
            WHERE a.area IN (${areas.map(() => '?').join(',')})
        `;
    
        // Parámetros en el orden correcto
        let params = [
            ...areas,
            ...(regiones.length ? regiones : []),
            ...(fechaInicio ? [fechaInicio] : []),
            ...(fechaFin ? [fechaFin] : []),
            ...areas,
            ...(regiones.length ? regiones : []),
            ...(fechaInicio ? [fechaInicio] : []),
            ...(fechaFin ? [fechaFin] : []),
            ...areas
        ];
    
        if (regiones.length) {
            query += ` AND a.region IN (${regiones.map(() => '?').join(',')})`;
            params.push(...regiones);
        }
    
        if (fechaInicio) {
            query += ` AND a.fecha >= ?`;
            params.push(fechaInicio);
        }
    
        if (fechaFin) {
            query += ` AND a.fecha <= ?`;
            params.push(fechaFin);
        }
    
        if (rut) {
            query += ` AND p.rut = ?`;
            params.push(normalizarRUT(rut));
        }
    
        query += ` GROUP BY p.id ORDER BY p.nombre`;
    
        db.all(query, params, (err, rows) => {
            if (err) return callback(err);
            
            const reporte = rows.map(row => ({
                ...row,
                porcentaje: row.total_actividades 
                    ? Math.round((row.asistencias * 100) / row.total_actividades)
                    : 0
            }));
            
            callback(null, reporte);
        });
    }
};

// Inicializar la base de datos al cargar el módulo
inicializarDB(() => {
    console.log('Base de datos verificada y lista');
});

module.exports = { 
    Usuario, 
    Actividad, 
    Persona, 
    Participacion,
    normalizarRUT 
};