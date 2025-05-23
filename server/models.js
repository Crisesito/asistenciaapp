const db = require('./database');

// Modelo Usuario
const Usuario = {
    autenticar: (username, password, callback) => {
        db.get(
            "SELECT * FROM usuarios WHERE username = ? AND password = ?",
            [username, password],
            (err, row) => {
                if (err) {
                    console.error('Error en autenticación:', err);
                    return callback(err);
                }
                callback(null, row);
            }
        );
    }
};

// Modelo Actividad
const Actividad = {
    crear: (area, nombre, fecha, callback) => {
        if (!['Emprendimiento', 'Voluntariado'].includes(area)) {
            return callback(new Error('Área no válida. Use Emprendimiento o Voluntariado'));
        }

        db.run(
            "INSERT INTO actividades (area, nombre, fecha) VALUES (?, ?, ?)",
            [area, nombre, fecha],
            function(err) {
                if (err) {
                    console.error('Error al crear actividad:', err);
                    return callback(err);
                }
                callback(null, this.lastID);
            }
        );
    },

    listar: (callback) => {
        db.all(
            "SELECT * FROM actividades ORDER BY fecha DESC",
            (err, rows) => {
                if (err) {
                    console.error('Error al listar actividades:', err);
                    return callback(err);
                }
                callback(null, rows || []);
            }
        );
    },

    listarPorArea: (area, callback) => {
        db.all(
            "SELECT * FROM actividades WHERE area = ? ORDER BY fecha DESC",
            [area],
            (err, rows) => {
                if (err) {
                    console.error('Error al listar actividades por área:', err);
                    return callback(err);
                }
                callback(null, rows || []);
            }
        );
    },

    obtenerPorId: (id, callback) => {
        db.get(
            "SELECT * FROM actividades WHERE id = ?",
            [id],
            (err, row) => {
                if (err) {
                    console.error('Error al obtener actividad:', err);
                    return callback(err);
                }
                callback(null, row);
            }
        );
    }
};

// Modelo Persona (completamente corregido)
const Persona = {
    crear: (rut, nombre, email, callback) => {
        db.run(
            `INSERT INTO personas (rut, nombre, email) VALUES (?, ?, ?)
             ON CONFLICT(rut) DO UPDATE SET
                nombre = excluded.nombre,
                email = COALESCE(excluded.email, email),
                ultima_actualizacion = CURRENT_TIMESTAMP`,
            [rut, nombre, email || null],
            function(err) {
                if (err) {
                    console.error('Error al crear/actualizar persona:', err);
                    // Fallback si falla por columna ultima_actualizacion
                    db.run(
                        `INSERT INTO personas (rut, nombre, email) VALUES (?, ?, ?)
                         ON CONFLICT(rut) DO UPDATE SET
                            nombre = excluded.nombre,
                            email = COALESCE(excluded.email, email)`,
                        [rut, nombre, email || null],
                        function(err) {
                            if (err) return callback(err);
                            callback(null, this.lastID);
                        }
                    );
                    return;
                }
                callback(null, this.lastID);
            }
        );
    },

    listarPorActividad: (actividadId, callback) => {
        db.all(
            `SELECT p.* FROM personas p
             JOIN participaciones part ON p.id = part.persona_id
             WHERE part.actividad_id = ?
             ORDER BY p.nombre`,
            [actividadId],
            (err, rows) => {
                if (err) {
                    console.error('Error al listar personas por actividad:', err);
                    return callback(err);
                }
                callback(null, rows || []);
            }
        );
    },

    obtenerPorRut: (rut, callback) => {
        db.get(
            "SELECT * FROM personas WHERE rut = ?",
            [rut],
            (err, row) => {
                if (err) {
                    console.error('Error al obtener persona por RUT:', err);
                    return callback(err);
                }
                callback(null, row);
            }
        );
    }
};

// Modelo Participacion (completamente corregido)
const Participacion = {
    registrar: (personaId, actividadId, callback) => {
        db.run(
            "INSERT OR IGNORE INTO participaciones (persona_id, actividad_id) VALUES (?, ?)",
            [personaId, actividadId],
            (err) => {
                if (err) {
                    console.error('Error al registrar participación:', err);
                    return callback(err);
                }
                callback(null);
            }
        );
    },

    obtenerReportePorActividad: (actividadId, callback) => {
        const id = parseInt(actividadId);
        if (isNaN(id)) return callback(new Error('ID de actividad inválido'));

        db.all(
            `SELECT 
                p.rut,
                p.nombre,
                COALESCE(p.email, 'N/A') as email
             FROM personas p
             JOIN participaciones part ON p.id = part.persona_id
             WHERE part.actividad_id = ?
             ORDER BY p.nombre`,
            [id],
            (err, rows) => {
                if (err) {
                    console.error('Error en reporte por actividad:', err);
                    return callback(err);
                }
                callback(null, rows || []);
            }
        );
    },

    obtenerReporteFiltrado: (areas, callback) => {
        if (!Array.isArray(areas) || areas.length === 0) {
            areas = ['Emprendimiento', 'Voluntariado'];
        }

        const placeholders = areas.map(() => '?').join(',');

        db.all(
            `SELECT 
                a.area,
                p.rut,
                p.nombre,
                COALESCE(p.email, 'N/A') as email,
                COUNT(part.id) as asistencias
             FROM personas p
             JOIN participaciones part ON p.id = part.persona_id
             JOIN actividades a ON part.actividad_id = a.id
             WHERE a.area IN (${placeholders})
             GROUP BY p.id`,
            areas,
            (err, rows) => {
                if (err) {
                    console.error('Error en reporte filtrado:', err);
                    return callback(err);
                }

                db.get(
                    `SELECT COUNT(*) as total 
                     FROM actividades 
                     WHERE area IN (${placeholders})`,
                    areas,
                    (err, countResult) => {
                        if (err) {
                            console.error('Error al contar actividades:', err);
                            return callback(err);
                        }

                        const totalActividades = countResult.total || 1;
                        const reporte = (rows || []).map(row => ({
                            area: row.area,
                            rut: row.rut,
                            nombre: row.nombre,
                            email: row.email,
                            asistencias: row.asistencias || 0,
                            totalActividades: totalActividades,
                            porcentaje: Math.round(((row.asistencias || 0) * 100) / totalActividades)
                        }));

                        callback(null, reporte);
                    }
                );
            }
        );
    }
};

module.exports = { Usuario, Actividad, Persona, Participacion };