const express = require('express');
const router = express.Router();
const db = require('../models/database.js');
const bcrypt = require('bcryptjs');

// Register Page
router.get('/register', (req, res) => {
 res.render('register', { currentUserId: null });
});

router.post('/register', (req, res) => {
 console.log('--- A /register request was received ---'); // DEBUG LOG 1
 const { username, password } = req.body;

 if (!username || !password) {
  return res.render('register', { error: 'Please enter a username and password.', currentUserId: null });
 }

 const findUserSql = 'SELECT * FROM users WHERE username = ?';
 console.log(`[QUERY] Running: ${findUserSql} with username = ${username}`); // DEBUG LOG 2

 db.get(findUserSql, [username], (err, user) => {
  if (err) {
   console.error('DATABASE ERROR during SELECT:', err.message); // DEBUG LOG
   return res.render('register', { error: 'Something went wrong. Please try again.', currentUserId: null });
  }

  console.log('[RESULT] User found in database:', user); // DEBUG LOG 3

  if (user) {
   // User was found! This is the block that should run.
   console.log('CONCLUSION: Username exists. Sending error message to user.'); // DEBUG LOG 4
   return res.render('register', { error: 'Username is already taken. Please choose another.', currentUserId: null });
  } else {
   // User was NOT found, so we can safely insert.
   console.log('CONCLUSION: Username is available. Proceeding to create user.'); // DEBUG LOG 5

   bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
     console.error('BCRYPT ERROR:', err);
     throw err;
    };

    const insertUserSql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    console.log(`[QUERY] Running INSERT for username = ${username}`); // DEBUG LOG 6

    db.run(insertUserSql, [username, hash], function (err) {
     if (err) {
      // If you see this log, it means the INSERT failed.
      console.error('DATABASE ERROR during INSERT:', err.message); // DEBUG LOG 7
      return res.render('register', { error: 'Error creating account. Please try again.', currentUserId: null });
     }
     console.log('SUCCESS: User created. Redirecting to /login.'); // DEBUG LOG 8
     res.redirect('/login');
    });
   });
  }
 });
});

// Login Page
router.get('/login', (req, res) => {
 res.render('login', { currentUserId: null });
});

// Login Handle
router.post('/login', (req, res) => {
 const { username, password } = req.body;
 db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
  if (err) throw err;
  if (!user) {
   return res.redirect('/login');
  }
  bcrypt.compare(password, user.password, (err, isMatch) => {
   if (err) throw err;
   if (isMatch) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
   } else {
    res.redirect('/login');
   }
  });
 });
});

// Logout Handle
router.get('/logout', (req, res) => {
 req.session.destroy(err => {
  if (err) {
   return res.redirect('/dashboard');
  }
  res.clearCookie('sid');
  res.redirect('/login');
 });
});

module.exports = router;