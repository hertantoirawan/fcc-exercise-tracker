const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const formatDate = require('date-fns/format'); 
const isDateValid = require('date-fns/isValid');
const parseISO = require('date-fns/parseISO');
const addDays = require('date-fns/addDays')

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
  userId: {
    type: mongoose.Types.ObjectId, // TODO: might need to be ObjectId type, instead of String
    required: true
  },
  description: String,
  duration: Number,
  date: Date,
}));

app.post('/api/exercise/add', (req, res) => {
  Athlete.findById(req.body.userId, (err, user) => { 
    if (user == null){
      res.send("Unknown userId");
      return;    
    }
    else {
        if (!isNumeric(req.body.duration)) {
          res.send("Invalid exercise duration");
          return;
        }

        let activityDate = req.body.date;
        if ((activityDate === '') || (activityDate === undefined)) {
          activityDate = new Date();
        }
        else if (!isValidDate(activityDate)) {
          res.send("Invalid exercise date");
          return;
        }        

        let activity = new Exercise({ 
          userId: mongoose.Types.ObjectId(req.body.userId),
          description: req.body.description,
          duration: req.body.duration,
          date: activityDate,
        });
        activity.save((err, doc) => {
          if (err) return console.error(err); //TODO: log error properly

          res.json({ 
            "_id": doc._id,
            "username": user.username,
            "date": formatDate(doc.date, 'iii MMM dd yyyy'),
            "duration": doc.duration,
            "description": doc.description
          });   
        });
    }
  });
});

// retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). 
// App will return the user object with added array log and count (total exercise count).
// retrieve part of the log of any user by also passing along optional parameters of from & to or limit. 
// (Date format yyyy-mm-dd, limit = int)
app.get('/api/exercise/log', (req, res) => {
  Athlete.findById(req.query.userId, (err, user) => {
    if (user == null){
      res.send("Unknown userId");
      return;    
    }
    else {
      let fromDate = req.query.from;
      let toDate = req.query.to;

      let limit = ((req.query.limit === '') || !isNumeric(req.query.limit)) ? 0 : req.query.limit;

      let filter = {};
      filter.userId = mongoose.Types.ObjectId(req.query.userId);

      // TODO: make this if-statements more elegant
      let filterFromDate = '', filterToDate = '';
      if (fromDate !== '') {
        if (isValidDate(fromDate)) {
          filterFromDate = new Date(new Date(fromDate).setHours(00, 00, 00));

          if (filterFromDate !== '') {
            filter.date = {};
            filter.date.$gte = filterFromDate;
          }
        }
        else {
          fromDate = '';
        }
      }
      if (toDate !== '') {
        if (isValidDate(toDate)) {
          filterToDate = new Date(new Date(toDate).setHours(00, 00, 00));
          filterToDate = addDays(filterToDate, 1);

          if (filterToDate !== '') {
            if (filter.date === undefined) {
              filter.date = {};
            }
            filter.date.$lt = filterToDate;
          }    
        }
        else {
          toDate = '';
        }
      }

      Exercise
      .find(filter, "description duration date -_id")
      .limit(parseInt(limit))
      .lean()
      .exec((err, result) => {
        if (err) return console.error(err); //TODO: log error properly

        // change date format to 'Sat Sep 05 2020'
        for (let a=0; a < result.length; a++) {
          result[a].date = formatDate(result[a].date, 'iii MMM dd yyyy');
        }

        res.json({
          "_id": req.query.userId,
          "username": user.username,
          "from": (fromDate === '') ? undefined : formatDate(new Date(fromDate), 'iii MMM dd yyyy'),
          "to": (toDate === '') ? undefined : formatDate(new Date(toDate), 'iii MMM dd yyyy'),
          "count": result.length,
          "log": result
        });
      });
    }    
  });
});

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function isValidDate(d) {
  return isDateValid(parseISO(d));
}

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
