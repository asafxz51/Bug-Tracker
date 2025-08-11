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

// Dashboard - Display all bugs
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

 if (severity) {
  whereClauses.push("b.severity = ?");
  params.push(severity);
 }
 if (priority) {
  whereClauses.push("b.priority = ?");
  params.push(priority);
 }
 if (status) {
  whereClauses.push("b.status = ?");
  params.push(status);
 }
 if (search) {
  whereClauses.push("(b.bugName LIKE ? OR b.description LIKE ? OR u_created.username LIKE ? OR u_assigned.username LIKE ?)");
  const searchTerm = `%${search}%`;
  params.push(searchTerm, searchTerm, searchTerm, searchTerm);
 }

 if (whereClauses.length > 0) {
  sql += " WHERE " + whereClauses.join(" AND ");
 }

 db.all(sql, params, (err, bugs) => {
  if (err) throw err;
  res.render('dashboard', { bugs, query: req.query });
 });
});


// My Work Page - Bugs assigned to or created by the user
router.get('/my-work', checkAuth, (req, res) => {
   const userId = req.session.userId;

   const assignedSql = `
        SELECT b.id, b.bugName, b.description, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.severity, b.priority, b.status, b.creationDate
        FROM bugs b
        LEFT JOIN users u_created ON b.createdBy = u_created.id
        LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id
        WHERE b.assignedTo = ?
    `;

   const createdSql = `
        SELECT b.id, b.bugName, b.description, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.severity, b.priority, b.status, b.creationDate
        FROM bugs b
        LEFT JOIN users u_created ON b.createdBy = u_created.id
        LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id
        WHERE b.createdBy = ?
    `;

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
 const { bugName, description, assignedTo, severity, priority } = req.body;
 const createdBy = req.session.userId;
 const status = "Open";
 const creationDate = new Date().toISOString();
 const sql = 'INSERT INTO bugs (bugName, description, createdBy, assignedTo, severity, priority, status, creationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
 const params = [bugName, description, createdBy, assignedTo, severity, priority, status, creationDate];
 db.run(sql, params, function (err) {
  if (err) {
   return console.error(err.message);
  }
  res.redirect('/dashboard');
 });
});

// Bug Detail View
router.get('/bugs/:id', checkAuth, (req, res) => {
 const sql = `
        SELECT b.id, b.bugName, b.description, u_created.username AS createdBy, u_assigned.username AS assignedTo, b.assignedTo as assignedToId, b.severity, b.priority, b.status, b.creationDate, b.createdBy as createdById
        FROM bugs b
        LEFT JOIN users u_created ON b.createdBy = u_created.id
        LEFT JOIN users u_assigned ON b.assignedTo = u_assigned.id
        WHERE b.id = ?
    `;
 db.get(sql, [req.params.id], (err, bug) => {
  if (err) throw err;
  res.render('bug-detail', { bug });
 });
});

// Edit Bug Form
router.get('/bugs/:id/edit', checkAuth, (req, res) => {
 const sql = "SELECT * FROM bugs WHERE id = ?";
 db.get(sql, [req.params.id], (err, bug) => {
  if (err) throw err;
  if (bug.createdBy !== req.session.userId) {
   return res.redirect('/dashboard');
  }
  db.all("SELECT * FROM users", [], (err, users) => {
   if (err) throw err;
   res.render('edit-bug', { bug, users });
  });
 });
});

// Update Bug Handle
router.post('/bugs/:id/edit', checkAuth, (req, res) => {
 const { bugName, description, assignedTo, severity, priority } = req.body;
 const sql = `UPDATE bugs SET
                    bugName = ?,
                    description = ?,
                    assignedTo = ?,
                    severity = ?,
                    priority = ?
                 WHERE id = ?`;
 const params = [bugName, description, assignedTo, severity, priority, req.params.id];
 db.run(sql, params, function (err) {
  if (err) {
   return console.error(err.message);
  }
  res.redirect(`/bugs/${req.params.id}`);
 });
});

// Update Bug Status

router.post('/bugs/:id/status', checkAuth, (req, res) => {
   const { status } = req.body;
   const bugId = req.params.id;
   const sql = `UPDATE bugs SET status = ? WHERE id = ?`;

   db.run(sql, [status, bugId], function (err) {
      if (err) {
         console.error("Error updating bug status:", err.message);
         return res.redirect(`/bugs/${bugId}`);
      }
      console.log(`Bug ${bugId} status updated to ${status}.`);
      res.redirect(`/bugs/${bugId}`);
   });
});

// Delete Bug
router.post('/bugs/:id/delete', checkAuth, (req, res) => {
 const sql = 'SELECT createdBy FROM bugs WHERE id = ?';
 db.get(sql, [req.params.id], (err, bug) => {
  if (err) throw err;
  if (bug && bug.createdBy === req.session.userId) {
   const deleteSql = 'DELETE FROM bugs WHERE id = ?';
   db.run(deleteSql, [req.params.id], function (err) {
    if (err) {
     return console.error(err.message);
    }
    res.redirect('/dashboard');
   });
  } else {
   res.redirect('/dashboard');
  }
 });
});

module.exports = router;