const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // Tabla de actividades (corregida)
    db.run("DROP TABLE IF EXISTS actividades");
    db.run(`
        CREATE TABLE actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area TEXT NOT NULL CHECK(area IN ('Emprendimiento', 'Voluntariado')),
            nombre TEXT NOT NULL,
            fecha TEXT NOT NULL
        )
    `);

    // Tabla de personas (estructura completa)
    db.run("DROP TABLE IF EXISTS personas");
    db.run(`
        CREATE TABLE personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rut TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            email TEXT,
            ultima_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de participaciones
    db.run("DROP TABLE IF EXISTS participaciones");
    db.run(`
        CREATE TABLE participaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id INTEGER NOT NULL,
            actividad_id INTEGER NOT NULL,
            fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (persona_id) REFERENCES personas(id),
            FOREIGN KEY (actividad_id) REFERENCES actividades(id),
            UNIQUE(persona_id, actividad_id)
        )
    `);

    // Insertar usuario admin si no existe
    db.get("SELECT * FROM usuarios WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run(
                "INSERT INTO usuarios (username, password) VALUES (?, ?)",
                ['admin', 'Desafioadmin2024'],
                (err) => {
                    if (err) console.error("Error creando usuario admin:", err);
                    else console.log("Usuario admin creado");
                }
            );
        }
    });

    // Insertar datos de prueba iniciales
    db.run(`
        INSERT OR IGNORE INTO actividades (area, nombre, fecha)
        VALUES ('Emprendimiento', 'Taller inicial', '2023-01-01')
    `);
});

module.exports = db;