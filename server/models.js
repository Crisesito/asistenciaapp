const db = require('./database');

// Modelo Usuario
const Usuario = {
    autenticar: (username, password, callback) => {
        db.get(
            "SELECT * FROM usuarios WHERE username = ? AND password = ?",
            [username, password],
            (err, row) => {
                if (err) return callback(err);
                callback(null, row);
            }
        );
    }
};

// Modelo Actividad
const Actividad = {
    crear: (nombre, fecha, callback) => {
        db.run(
            "INSERT INTO actividades (nombre, fecha) VALUES (?, ?)",
            [nombre, fecha],
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
    crear: (rut, nombre, callback) => {
        db.run(
            "INSERT OR IGNORE INTO personas (rut, nombre) VALUES (?, ?)",
            [rut, nombre],
            function(err) {
                callback(err, this.lastID);
            }
        );
    },
    listarPorActividad: (actividadId, callback) => {
        db.all(`
            SELECT p.* FROM personas p
            JOIN participaciones part ON p.id = part.persona_id
            WHERE part.actividad_id = ?
            ORDER BY p.nombre
        `, [actividadId], callback);
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
    obtenerReporte: (callback) => {
        db.all(`
            SELECT 
                p.rut,
                p.nombre,
                COUNT(part.id) as asistencias
            FROM personas p
            LEFT JOIN participaciones part ON p.id = part.persona_id
            GROUP BY p.id
        `, (err, rows) => {
            if (err) return callback(err);
            
            // Obtener total de actividades
            db.get("SELECT COUNT(*) as total FROM actividades", (err, countResult) => {
                if (err) return callback(err);
                
                const totalActividades = countResult.total || 1;
                const reporte = rows.map(row => ({
                    rut: row.rut,
                    nombre: row.nombre,
                    asistencias: row.asistencias,
                    totalActividades: totalActividades,
                    porcentaje: Math.round((row.asistencias * 100) / totalActividades)
                }));
                
                callback(null, reporte);
            });
        });
    }
};

module.exports = { Usuario, Actividad, Persona, Participacion };