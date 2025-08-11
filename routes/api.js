// CREATE THIS NEW FILE at a/bug-tracker/routes/api.js

const express = require('express');
const router = express.Router();
const db = require('../models/database.js');

const checkAuth = (req, res, next) => {
 if (!req.session.userId) {
  return res.status(401).json({ error: 'Unauthorized' });
 }
 next();
};

// GET all steps for a bug
router.get('/bugs/:bug_id/steps', checkAuth, (req, res) => {
 const sql = "SELECT * FROM steps WHERE bug_id = ? ORDER BY step_order";
 db.all(sql, [req.params.bug_id], (err, rows) => {
  if (err) return res.status(500).json({ error: err.message });
  res.json(rows);
 });
});

// POST a new step for a bug
router.post('/bugs/:bug_id/steps', checkAuth, (req, res) => {
 const { description } = req.body;
 const bug_id = req.params.bug_id;
 const orderSql = "SELECT MAX(step_order) as max_order FROM steps WHERE bug_id = ?";
 db.get(orderSql, [bug_id], (err, row) => {
  if (err) return res.status(500).json({ error: err.message });
  const new_order = (row && row.max_order !== null) ? row.max_order + 1 : 0;
  const insertSql = "INSERT INTO steps (bug_id, step_order, description) VALUES (?, ?, ?)";
  db.run(insertSql, [bug_id, new_order, description], function (err) {
   if (err) return res.status(500).json({ error: err.message });
   res.status(201).json({ id: this.lastID, bug_id, step_order: new_order, description });
  });
 });
});

// PUT (update) an existing step
router.put('/steps/:step_id', checkAuth, (req, res) => {
 const { description } = req.body;
 const sql = "UPDATE steps SET description = ? WHERE id = ?";
 db.run(sql, [description, req.params.step_id], function (err) {
  if (err) return res.status(500).json({ error: err.message });
  res.json({ message: 'Step updated successfully' });
 });
});

// DELETE a step
router.delete('/steps/:step_id', checkAuth, (req, res) => {
 const sql = "DELETE FROM steps WHERE id = ?";
 db.run(sql, [req.params.step_id], function (err) {
  if (err) return res.status(500).json({ error: err.message });
  res.json({ message: 'Step deleted successfully' });
 });
});

// POST to reorder steps
router.post('/bugs/:bug_id/steps/reorder', checkAuth, (req, res) => {
 const { orderedIds } = req.body;
 if (!Array.isArray(orderedIds)) {
  return res.status(400).json({ error: 'orderedIds must be an array' });
 }
 db.serialize(() => {
  db.run("BEGIN TRANSACTION");
  orderedIds.forEach((id, index) => {
   const sql = "UPDATE steps SET step_order = ? WHERE id = ?";
   db.run(sql, [index, id]);
  });
  db.run("COMMIT", (err) => {
   if (err) return res.status(500).json({ error: 'Failed to reorder steps.' });
   res.json({ message: 'Steps reordered successfully' });
  });
 });
});

module.exports = router;