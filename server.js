
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const db = require('./models/database.js');
const session = require('express-session');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(session({
 secret: 'your_secret_key',
 resave: false,
 saveUninitialized: true,
 cookie: { name: 'sid' }
}));

const checkAuth = (req, res, next) => {
 if (!req.session.userId) {
  res.redirect('/login');
 } else {
  res.locals.currentUserId = req.session.userId;
  res.locals.username = req.session.username;
  next();
 }
};

// Routes
const authRoutes = require('./routes/auth');
const bugRoutes = require('./routes/bugs');
const apiRoutes = require('./routes/api'); 

app.use(authRoutes);
app.use(bugRoutes);
app.use('/api', apiRoutes); 


app.get('/', (req, res) => {
 if (req.session.userId) {
  res.redirect('/dashboard');
 } else {
  res.redirect('/login');
 }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`Server is running on port ${PORT}`);
});