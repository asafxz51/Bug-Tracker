// REPLACE a/bug-tracker/routes/bugs.js WITH THIS:

const express = require('express');
const router = express.Router();
const db = require('../models/database.js');

const checkAuth = (req, res, next) => {
   if (!req.session.userId) { res.redirect('/login'); }
   else {
      res.locals.currentUserId = req.session.userId;
      res.locals.username = req.session.username;
      next();
   }
};

router.get('/dashboard', checkAuth, (req, res) => {
   const { severity, priority, status, search } = req.query;
   let sql = `SELECT b.id, b.bugName, b.description, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.severity, b.priority, b.status, b.creationDate FROM bugs b LEFT JOIN users u_created ON b.createdBy = u_created.id LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id`;
   let params = [];
   let whereClauses = [];
   if (severity) { whereClauses.push("b.severity = ?"); params.push(severity); }
   if (priority) { whereClauses.push("b.priority = ?"); params.push(priority); }
   if (status) { whereClauses.push("b.status = ?"); params.push(status); }
   if (search) {
      whereClauses.push("(b.bugName LIKE ? OR b.description LIKE ? OR u_created.username LIKE ? OR u_assigned.username LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
   }
   if (whereClauses.length > 0) { sql += " WHERE " + whereClauses.join(" AND "); }
   sql += " ORDER BY b.id DESC";
   db.all(sql, params, (err, bugs) => {
      if (err) throw err;
      res.render('dashboard', { bugs, query: req.query });
   });
});

router.get('/my-work', checkAuth, (req, res) => {
   const userId = req.session.userId;
   const assignedSql = `SELECT b.id, b.bugName, u_created.username AS createdBy, b.severity, b.priority, b.status FROM bugs b LEFT JOIN users u_created ON b.createdBy = u_created.id WHERE b.assignedTo = ?`;
   const createdSql = `SELECT b.id, b.bugName, u_assigned.username AS assignedTo, b.severity, b.priority, b.status FROM bugs b LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id WHERE b.createdBy = ?`;
   db.all(assignedSql, [userId], (err, assignedBugs) => {
      if (err) throw err;
      db.all(createdSql, [userId], (err, createdBugs) => {
         if (err) throw err;
         res.render('my-work', { assignedBugs, createdBugs });
      });
   });
});

router.get('/bugs/new', checkAuth, (req, res) => {
   db.all("SELECT * FROM users", [], (err, users) => {
      if (err) throw err;
      res.render('new-bug', { users });
   });
});

router.post('/bugs', checkAuth, (req, res) => {
   const { bugName, description, assignedTo, severity, priority, steps } = req.body;
   const bugSql = 'INSERT INTO bugs (bugName, description, createdBy, assignedTo, severity, priority, status, creationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
   const bugParams = [bugName, description, req.session.userId, assignedTo, severity, priority, "Open", new Date().toISOString()];
   let stepsArray = [];
   try { if (steps) stepsArray = JSON.parse(steps); } catch (e) { return res.redirect('/bugs/new'); }
   db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(bugSql, bugParams, function (err) {
         if (err) { db.run("ROLLBACK"); return res.redirect('/dashboard'); }
         const bugId = this.lastID;
         if (stepsArray.length > 0) {
            const stepsSql = 'INSERT INTO steps (bug_id, step_order, description) VALUES (?, ?, ?)';
            stepsArray.forEach((stepDesc, index) => {
               db.run(stepsSql, [bugId, index, stepDesc], (err) => { if (err) { db.run("ROLLBACK"); } });
            });
         }
         db.run("COMMIT", (err) => {
            if (err) { return res.redirect('/dashboard'); }
            res.redirect(`/bugs/${bugId}`);
         });
      });
   });
});

router.get('/bugs/:id', checkAuth, (req, res) => {
   const bugSql = `SELECT b.*, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.createdBy as createdById, b.assignedTo as assignedToId FROM bugs b LEFT JOIN users u_created ON b.createdBy = u_created.id LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id WHERE b.id = ?`;
   const stepsSql = `SELECT * FROM steps WHERE bug_id = ? ORDER BY step_order ASC`;
   db.get(bugSql, [req.params.id], (err, bug) => {
      if (err) throw err;
      if (!bug) return res.status(404).send('Bug not found');
      db.all(stepsSql, [req.params.id], (err, steps) => {
         if (err) throw err;
         res.render('bug-detail', { bug, steps });
      });
   });
});

// ***FIXED***: Edit Bug Form now fetches steps
router.get('/bugs/:id/edit', checkAuth, (req, res) => {
   const bugSql = "SELECT * FROM bugs WHERE id = ?";
   const stepsSql = "SELECT * FROM steps WHERE bug_id = ? ORDER BY step_order ASC";
   db.get(bugSql, [req.params.id], (err, bug) => {
      if (err || !bug || bug.createdBy !== req.session.userId) return res.redirect('/dashboard');
      db.all("SELECT * FROM users", [], (err, users) => {
         if (err) throw err;
         db.all(stepsSql, [bug.id], (err, steps) => {
            if (err) throw err;
            res.render('edit-bug', { bug, users, steps });
         });
      });
   });
});

// ***FIXED***: Edit Bug Handle now processes steps
router.post('/bugs/:id/edit', checkAuth, (req, res) => {
   const bugId = req.params.id;
   const { bugName, description, assignedTo, severity, priority, steps } = req.body;

   const bugSql = `UPDATE bugs SET bugName = ?, description = ?, assignedTo = ?, severity = ?, priority = ? WHERE id = ?`;
   const bugParams = [bugName, description, assignedTo, severity, priority, bugId];

   let stepsArray = [];
   try { if (steps) stepsArray = JSON.parse(steps); } catch (e) { return res.redirect(`/bugs/${bugId}/edit`); }

   db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(bugSql, bugParams, (err) => { if (err) { db.run("ROLLBACK"); } });
      db.run('DELETE FROM steps WHERE bug_id = ?', [bugId], (err) => { if (err) { db.run("ROLLBACK"); } });

      if (stepsArray.length > 0) {
         const stepsSql = 'INSERT INTO steps (bug_id, step_order, description) VALUES (?, ?, ?)';
         stepsArray.forEach((stepDesc, index) => {
            db.run(stepsSql, [bugId, index, stepDesc], (err) => { if (err) { db.run("ROLLBACK"); } });
         });
      }
      db.run("COMMIT", (err) => {
         if (err) { return res.redirect(`/bugs/${bugId}/edit`); }
         res.redirect(`/bugs/${bugId}`);
      });
   });
});

router.post('/bugs/:id/status', checkAuth, (req, res) => {
   const { status } = req.body;
   const bugId = req.params.id;
   if (status === 'Closed' || status === 'Resolved') {
      const closingDate = new Date().toISOString();
      db.run(`UPDATE bugs SET status = ?, closingDate = ? WHERE id = ?`, [status, closingDate, bugId], (err) => res.redirect(`/bugs/${bugId}`));
   } else {
      db.run(`UPDATE bugs SET status = ?, closingDate = NULL WHERE id = ?`, [status, bugId], (err) => res.redirect(`/bugs/${bugId}`));
   }
});

router.post('/bugs/:id/delete', checkAuth, (req, res) => {
   db.get('SELECT createdBy FROM bugs WHERE id = ?', [req.params.id], (err, bug) => {
      if (bug && bug.createdBy === req.session.userId) {
         db.run('DELETE FROM bugs WHERE id = ?', [req.params.id], (err) => res.redirect('/dashboard'));
      } else { res.redirect('/dashboard'); }
   });
});

module.exports = router;