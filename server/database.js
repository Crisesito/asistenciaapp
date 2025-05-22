const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const DB_PATH = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(DB_PATH);

// Crear tablas
db.serialize(() => {
    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // Tabla de actividades
    db.run(`
        CREATE TABLE IF NOT EXISTS actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            fecha TEXT NOT NULL
        )
    `);

    // Tabla de personas
    db.run(`
        CREATE TABLE IF NOT EXISTS personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rut TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL
        )
    `);

    // Tabla de participaciones
    db.run(`
        CREATE TABLE IF NOT EXISTS participaciones (
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
});

module.exports = db;