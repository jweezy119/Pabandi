const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const app = express();
app.use(passport.initialize());
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
  port: 3005,
  path: '/auth/twitter',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
app.listen(3005, () => request.end());
