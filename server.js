const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// TODO: move to a separate model file
const Athlete = mongoose.model('Athlete', new mongoose.Schema({
  username: String,
}));

app.post('/api/exercise/new-user', (req, res) => {
  if (req.body.username === '') {
    res.send("Path `username` is required.");
    return;
  }

  let filter = { username: req.body.username };
  Athlete.count(filter, (err, count) => { 
    if (count > 0){
      res.send("Username already taken");    
    }
    else {
      let hero = new Athlete({ username: req.body.username });
      hero.save(function(err, doc) {
        if (err) return console.error(err); //TODO: log error properly
        res.json({"username": doc.username,"_id": doc._id});   
      });
    }
  });
});

// get an array of all users
app.get('/api/exercise/users', (req, res) => {
  Athlete.find({}, (err, result) => {
    if (err) return console.error(err); //TODO: log error properly
    res.json(result);
  });
});

// TODO: move to a separate model file
const Exercise = mongoose.model('Exercise', new mongoose.Schema({
  userId: String,
  description: String,
  duration: Number,
  date: Date,
}));

app.post('/api/exercise/add', (req, res) => {
  Athlete.findById(req.body.userId, (err, user) => { 
    if (user == null){
      res.send("Unknown userId");    
    }
    else {
        let activityDate = req.body.date;
        if (activityDate === '') activityDate = new Date();

        let activity = new Exercise({ 
          userId: req.body.userId,
          description: req.body.description,
          duration: req.body.duration,
          date: activityDate,
        });
        activity.save((err, doc) => {
          if (err) return console.error(err); //TODO: log error properly

          res.json({
            "_id": doc._id,
            "username": user.username,
            "date": doc.date,
            "duration": doc.duration,
            "description": doc.description
          });   
        });
    }
  });
});

// retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). 
// App will return the user object with added array log and count (total exercise count).
app.get('/api/exercise/log?userId=:user_id', (req, res) => {
  let filter = { userId: req.params.user_id };
  
  Exercise.find(filter, (err, result) => {
    if (err) return console.error(err); //TODO: log error properly
    res.json(result);
  });
});

// retrieve part of the log of any user by also passing along optional parameters of from & to or limit. 
// (Date format yyyy-mm-dd, limit = int)


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
