
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            console.log('Running database initialization...');

            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                CONSTRAINT username_unique UNIQUE (username)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS bugs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bugName TEXT,
                description TEXT,
                createdBy INTEGER,
                assignedTo INTEGER,
                severity TEXT,
                priority TEXT,
                status TEXT,
                creationDate TEXT,
                closingDate TEXT, -- ADDED THIS
                FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (assignedTo) REFERENCES users (id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bug_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                description TEXT NOT NULL,
                FOREIGN KEY (bug_id) REFERENCES bugs (id) ON DELETE CASCADE
            )`);

            const checkUserSql = `SELECT * FROM users WHERE username = ?`;
            db.get(checkUserSql, ['admin'], (err, row) => {
                if (err) {
                    console.error("Error checking for admin user:", err.message);
                    return;
                }
                if (!row) {
                    console.log('Seeding initial data...');
                    const salt = bcrypt.genSaltSync(10);
                    const adminPassword = bcrypt.hashSync('admin', salt);
                    const user1Password = bcrypt.hashSync('user1', salt);

                    const insertUser = 'INSERT INTO users (username, password) VALUES (?,?)';
                    db.run(insertUser, ["admin", adminPassword]);
                    db.run(insertUser, ["user1", user1Password]);

                    const insertBug = 'INSERT INTO bugs (bugName, description, createdBy, assignedTo, severity, priority, status, creationDate, closingDate) VALUES (?,?,?,?,?,?,?,?,?)';
                    db.run(insertBug, ["UI Glitch on Homepage", "The main navigation bar overlaps with the hero section on smaller screens.", 1, 2, "Major", "High", "Open", new Date().toISOString(), null]);
                    db.run(insertBug, ["API Timeout Error", "The '/api/data' endpoint is timing out after 30 seconds.", 2, 1, "Critical", "High", "In Progress", new Date().toISOString(), null]);
                    console.log('Finished seeding data.');
                } else {
                    console.log('Database already seeded.');
                }
            });
        });
    }
});

module.exports = db;