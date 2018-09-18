const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000
const { Client } = require('pg');
var _ = require('lodash');
var Morgan = require('morgan');
var path = require('path');
var bodyParser = require('body-parser');
var webpack = require('webpack');
var scoreBoard = {}



app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname + '/dist')))
app.get('/*', function (req, res) {
  res.sendFile(__dirname+'/dist/index.html')
})

http.listen(PORT, function () {
  console.log('listening on *:' + PORT);
});

var nicknames = {};           //nickname array
var count = 0;                //Number of times target has been shown
var total = {};               //collection of all clicks from various users
var numCal = 0;               //a seperate counter for first winner request
var timeCal = 0;              //
var numCount = 0;             //num of count winner requests send by clients
var isTimer = false;          //timer status
var enabled = true;           //button status
var isFirst = true;           //first click status
var sendResponse = true;      //check to prevent multiple target dispatch
var timeCount = 10            //initial counter
var gameOn = false            //check to prevent game session
//var throttledCollection = _.throttle(collection, 1000)
var target = null
var interval = null;
var black = false

io.on('connection', (socket) => {
  console.log('Client connected, ID assigned:' + socket.id);
  var id = socket.id

  //Recieving username
  socket.on('RECIEVE_USER_NAME', function (name) {

    //Assigning color
    if (black) {
      socket.color = 'white'
    }
    else {
      socket.color = 'gray'
    }

    //Checking if a game is session or not
    if (!gameOn) {

      //If game is not in session
      socket.clicks = 0
      console.log("Connected user's username is:" + name)

      //Checking if max players are 4
      if (Object.keys(nicknames).length < 5) {

        //If players are less then 5
        socket.nickname = name
        nicknames[id] = name

        //numCal initialization
        timeCal = Object.keys(nicknames).length
        numCal = Object.keys(nicknames).length
        console.log('player list has: ' + Object.values(nicknames))
        console.log(Object.keys(nicknames).length)

        //If minimum palyers != true
        if (Object.keys(nicknames).length < 2) {
          console.log('Failed the minimum player check')
          io.emit('NOT_ENOUGH_PLAYERS')
        }
        else {

          //player more than 2
          console.log('passed the minimum player check')
          io.emit('SHOW_MESSAGE', 'Starting game session. Starting count down.', 'green')
        }
      }
      else {

        //If maximum player limit is breached
        socket.emit('SHOW_MESSAGE', 'Game room is full. Please try again in a little bit', 'red')
      }
    }
    else {

      //If game is in session
      if (isTimer) {

        //If timer is on
        socket.clicks = 0
        console.log("Connected user's username is:" + name)

        //Checking if max players are 4
        if (Object.keys(nicknames).length < 5) {
          io.emit('SHOW_MESSAGE', 'A new Challenger has appeared', 'green')
          timeCount = 10
          socket.nickname = name
          nicknames[id] = name

          //numCal initialization
          numCal = Object.keys(nicknames).length
          console.log('player list has: ' + Object.values(nicknames))
          console.log(Object.keys(nicknames).length)
        }
        else {

          //Error dialog in case of timer = 0
          socket.emit('SHOW_MESSAGE', 'Game room is full. Please try again in a little bit', 'red')
        }
      }
      else {
        socket.emit('SHOW_MESSAGE', 'Game is already in session. Come again later.', 'red')
      }
    }
  })

  //Routing chat messages
  socket.on('CHAT_RECIEVED', (message) => {
    console.log('chat message has: ' + message)
    io.emit('CHAT', message, socket.nickname, socket.color)
  })

  //Starting timer
  socket.on('START_TIMER', () => {
    if (enabled) {
      enabled = false

      //Show Timer 
      isTimer = true
      setTimeout(() => {
        console.log('Timer running')

        //If timer is not at 0
        var timer = setInterval(() => {
          if (timeCount > -1) {

            //Enabling interrupt prevention
            gameOn = true
            io.emit('TIMER', timeCount)
            timeCount--
          }
          else {
            clearInterval(timer)
            console.log('Count down over.')
            enabled = true
            io.emit('START_GAME')
            isTimer = false
          }
        }, 1000)
      }, 3000)
    }
  })

  //Collecting clicks
  //socket.on('COLLECTION', throttledCollection(btnId));
  socket.on('COLLECTION', function collection(btnId) {
    if (enabled) {
      enabled = false
      console.log('First click:' + socket.nickname)
      socket.clicks += 1
      console.log(socket.clicks)
      count++
      console.log(count)
      sendResponse = true
      console.log(socket.nickname)
      io.emit('RESET_BUTTON', btnId, socket.nickname)
      enabled = true
      console.log('Sent btn reset request.')
    }
  })

  socket.on('START', () => {
    timeCal--
    if (timeCal == 1) {
      interval = setInterval(() => {
        console.log('Inside START')
        if (count < 10) {
          if (target) {
            io.emit('RESET_BUTTON', target)
          }
          console.log('Inside if')
          enabled = true
          target = Math.floor((Math.random() * 24) + 1);
          io.emit('RETURN_TARGET', target)
          console.log('Target sent.')
        }
        else {
          clearInterval(interval)
          io.emit('STOP_GAME')
          console.log('Game over.Stopping game.')
        }
      }, 3000);
    }
  })

  //Generating target
  socket.on('TARGET_BUTTON', function () {

    //Checking if targets < 6
    if (count < 10) {

      //Checking if name_entered > 1
      if (Object.keys(nicknames).length > 1) {

        //Checking if response is enabled
        if (sendResponse) {
          sendResponse = false

          //Checking if it is the first target
          if (isFirst) {
            console.log('First Target')
            isFirst = false;

            //Sending target
            enabled = true
            setTimeout(() => {
              var target = Math.floor((Math.random() * 24) + 1);
              io.emit('RETURN_TARGET', target)
              console.log('Sent first target')
            }, 3000)
          }
          else {
            console.log('Target request recieved.')
            enabled = true
            var target = Math.floor((Math.random() * 24) + 1);
            io.emit('RETURN_TARGET', target)
            console.log('Target sent.')
          }
        }
      }
      else {
        var msg = 'Not enough players'
        io.emit('STOP_GAME', msg)
      }
    }
    else {
      io.emit('STOP_GAME')
      console.log('Game over.Stopping game.')
    }
  })

  //Sending players
  socket.on('SEND_PLAYER', () => {
    var names = [];
    for (var keys in nicknames) {
      console.log(nicknames[keys])
      names.push(nicknames[keys]);
    }
    io.emit('PLAYER_LIST', names)
  })


  //Calculating Winner
  socket.on('CAL_WINNER', function () {
    numCount++//Total requests
    numCal-- //First cal_winner requests

    //Collecting all clicks in an Object
    total[socket.id] = socket.clicks
    if (numCal === 1) {
      console.log('Calculating winner')
      numCount++
      console.log('numCount: ' + numCount)
      console.log(socket.id + ' ' + socket.nickname + '' + socket.clicks)
      console.log('total has:' + Object.values(total))
      var temp = 0

      //Finding the winner
      if (numCount == Object.values(nicknames).length) {
        for (var key in total) {
          console.log('Object.values(total[i]): ' + Object.values(total[key]))
          if (total[key] > temp) {
            temp = total[key]
            console.log('temp:' + temp)
          }
        }
        
        //Fetching the winner name
        Object.prototype.getKeyByValue = function (value) {
          for (var prop in this) {
            if (this.hasOwnProperty(prop)) {
              if (this[prop] === value)
                return prop;
            }
          }
        }
        id = total.getKeyByValue(temp);
        console.log(nicknames[id])
        io.emit('WINNER_NAME', nicknames[id])
      }
    }
    else if (numCal < Object.values(nicknames).length) {
      numCal++
    }
    else {
      numCal = 0
    }
  })

  //Stop Game
  socket.on('STOP', function () {
    io.emit('RESET_CLIENT')
  })

  socket.on('RESET_SERVER', function () {
    nicknames = {}
    count = 0
    total = {}
    numCount = 0
    numCal = 0
    isFirst = true;
    sendResponse = true;
    gameOn = false;
    timeCount = 10;
    enabled = true;
  })

  socket.on('disconnect', () => {
    console.log('Client :' + socket.nickname + ' disconnected')
    var id = socket.id
    delete nicknames[id]
    console.log('Remaining players: ' + Object.values(nicknames))
    count = 0
    total = {}
    numCount = 0
    numCal = 0
    timeCal = 0
    enabled = true;
    gameOn = false;
    isFirst = true;
    timeCount = 10;
    sendResponse = true
    clearInterval(interval)
    io.emit('STOP_GAME', 'Someone disconnected resetting everything. Game will start as soon as minimum players are connected.')
  });
});

setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
