const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH);

// Función para inicializar la base de datos
const initializeDB = () => {
    db.serialize(() => {
        // Crear tabla usuarios si no existe
        db.run(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);

        // Crear tabla actividades
        db.run(`
            CREATE TABLE IF NOT EXISTS actividades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                area TEXT NOT NULL CHECK(area IN ('Emprendimiento', 'Voluntariado')),
                nombre TEXT NOT NULL,
                fecha TEXT NOT NULL,
                region TEXT NOT NULL
            )
        `);

        // Crear tabla personas
        db.run(`
            CREATE TABLE IF NOT EXISTS personas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rut TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                email TEXT,
                ultima_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla participaciones
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

        // Insertar usuario admin por defecto
        db.run(`
            INSERT OR IGNORE INTO usuarios (username, password)
            VALUES ('admin', 'Desafioadmin2024')
        `);

        console.log('Base de datos inicializada correctamente');
    });
};

// Verificar e inicializar la base de datos al iniciar
db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
    if (err || !row) {
        console.log('Inicializando base de datos...');
        initializeDB();
    }
});

module.exports = db;