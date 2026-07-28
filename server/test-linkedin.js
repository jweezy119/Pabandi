const express = require('express');
const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const app = express();
app.use(passport.initialize());
passport.use(new LinkedInStrategy({
    clientID: 'fake',
    clientSecret: 'fake',
    callbackURL: 'http://localhost/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'customer' }));
app.use((err, req, res, next) => {
  console.error("Error caught:", err.message);
  res.status(500).send(err.message);
});
const request = require('http').request({
  hostname: 'localhost',
  port: 3008,
  path: '/auth/linkedin',
  method: 'GET'
}, (res) => {
  console.log('Status Code:', res.statusCode);
  if(res.statusCode === 302) console.log('Location:', res.headers.location);
});
app.listen(3008, () => request.end());
