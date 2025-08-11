// REPLACE a/bug-tracker/routes/bugs.js WITH THIS:

const express = require('express');
const router = express.Router();
const db = require('../models/database.js');

const checkAuth = (req, res, next) => {
   if (!req.session.userId) {
      res.redirect('/login');
   } else {
      res.locals.currentUserId = req.session.userId;
      res.locals.username = req.session.username;
      next();
   }
};

// Dashboard
router.get('/dashboard', checkAuth, (req, res) => {
   const { severity, priority, status, search } = req.query;
   let sql = `
        SELECT b.id, b.bugName, b.description, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.severity, b.priority, b.status, b.creationDate
        FROM bugs b
        LEFT JOIN users u_created ON b.createdBy = u_created.id
        LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id
    `;
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

// My Work Page
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

// Create Bug Form
router.get('/bugs/new', checkAuth, (req, res) => {
   db.all("SELECT * FROM users", [], (err, users) => {
      if (err) throw err;
      res.render('new-bug', { users });
   });
});

// Create Bug Handle
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
               db.run(stepsSql, [bugId, index, stepDesc], (err) => {
                  if (err) { db.run("ROLLBACK"); return res.redirect('/dashboard'); }
               });
            });
         }
         db.run("COMMIT", (err) => {
            if (err) return res.redirect('/dashboard');
            res.redirect(`/bugs/${bugId}`);
         });
      });
   });
});

// Bug Detail View
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

// Edit Bug Form & Handle
router.get('/bugs/:id/edit', checkAuth, (req, res) => {
   db.get("SELECT * FROM bugs WHERE id = ?", [req.params.id], (err, bug) => {
      if (err || !bug || bug.createdBy !== req.session.userId) return res.redirect('/dashboard');
      db.all("SELECT * FROM users", [], (err, users) => {
         if (err) throw err;
         res.render('edit-bug', { bug, users });
      });
   });
});
router.post('/bugs/:id/edit', checkAuth, (req, res) => {
   const { bugName, description, assignedTo, severity, priority } = req.body;
   const sql = `UPDATE bugs SET bugName = ?, description = ?, assignedTo = ?, severity = ?, priority = ? WHERE id = ?`;
   db.run(sql, [bugName, description, assignedTo, severity, priority, req.params.id], (err) => {
      if (err) return console.error(err.message);
      res.redirect(`/bugs/${req.params.id}`);
   });
});

// ***FIXED***: Update Bug Status - handles closingDate for Resolved and Closed
router.post('/bugs/:id/status', checkAuth, (req, res) => {
   const { status } = req.body;
   const bugId = req.params.id;
   let sql;

   // Check if the status is one that signifies completion
   if (status === 'Closed' || status === 'Resolved') {
      const closingDate = new Date().toISOString();
      sql = `UPDATE bugs SET status = ?, closingDate = ? WHERE id = ?`;
      db.run(sql, [status, closingDate, bugId], handleUpdate);
   } else {
      // Otherwise, it's an open status, so clear the closing date
      sql = `UPDATE bugs SET status = ?, closingDate = NULL WHERE id = ?`;
      db.run(sql, [status, bugId], handleUpdate);
   }

   function handleUpdate(err) {
      if (err) {
         console.error("Error updating bug status:", err.message);
      } else {
         console.log(`Bug ${bugId} status updated to ${status}.`);
      }
      res.redirect(`/bugs/${bugId}`);
   }
});

// Delete Bug
router.post('/bugs/:id/delete', checkAuth, (req, res) => {
   db.get('SELECT createdBy FROM bugs WHERE id = ?', [req.params.id], (err, bug) => {
      if (bug && bug.createdBy === req.session.userId) {
         db.run('DELETE FROM bugs WHERE id = ?', [req.params.id], (err) => {
            if (err) return console.error(err.message);
            res.redirect('/dashboard');
         });
      } else {
         res.redirect('/dashboard');
      }
   });
});

module.exports = router;
