const express = require('express');
const passport = require('passport');
const TikTokStrategy = require('passport-tiktok-auth').Strategy;
const app = express();
app.use(passport.initialize());
passport.use(new TikTokStrategy({
    clientID: 'fake',
    clientSecret: 'fake',
    callbackURL: 'http://localhost/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));
app.get('/auth/tiktok', passport.authenticate('tiktok', { state: 'customer' }));
app.use((err, req, res, next) => {
  console.error("Error caught:", err.message);
  res.status(500).send(err.message);
});
const request = require('http').request({
  hostname: 'localhost',
  port: 3009,
  path: '/auth/tiktok',
  method: 'GET'
}, (res) => {
  console.log('Status Code:', res.statusCode);
  if(res.statusCode === 302) console.log('Location:', res.headers.location);
});
app.listen(3009, () => request.end());
