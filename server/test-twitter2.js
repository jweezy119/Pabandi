const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const app = express();

app.use(session({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new TwitterStrategy({
    consumerKey: 'fake',
    consumerSecret: 'fake',
    callbackURL: 'http://localhost/callback'
  },
  function(token, tokenSecret, profile, cb) {
    return cb(null, profile);
  }
));
app.get('/auth/twitter', passport.authenticate('twitter'));
app.use((err, req, res, next) => {
  console.error("Error caught:", err.message);
  res.status(500).send(err.message);
});
const request = require('http').request({
  hostname: 'localhost',
  port: 3006,
  path: '/auth/twitter',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response with session:', data));
});
app.listen(3006, () => request.end());
