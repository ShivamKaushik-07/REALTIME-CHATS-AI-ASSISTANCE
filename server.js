const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
require('dotenv').config();
const axios = require('axios'); // ✅ Using axios instead of OpenAI SDK
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Smart AI bot response using OpenRouter API
async function getAIResponse(message) {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo', // You can also try other models like claude or mistral
        messages: [{ role: 'user', content: message }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000', // your site or GitHub project
          'X-Title': 'SimpleChatApp'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("OpenRouter API error:", err.message);
    return "Oops! My AI brain ran into a problem. Try again later.";
  }
}

function censorMessage(msg) {
  // Simple example: replace "badword" with "***"
  const badWords = ["fuck","shit","bitch","asshole","bastard","dick","pussy","slut","whore","damn","crap","fucker", "motherfucker","cunt","nigga",  "nigger",  "fag","faggot","retard", "douche"];
  let found = false;
  let censored = msg;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    if (regex.test(censored)) found = true;
    censored = censored.replace(regex, '***');
  });
  return { censored, found };
}

const users = {};
const userWarnings = {}; // Track user warnings

// Handle new socket connections
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room, email }) => {
    socket.username = username;
    socket.room = room;
    socket.email = email;
    if (!users[room]) users[room] = [];
    users[room].push(username);

    // Emit updated user count to room
    io.to(room).emit('roomUsers', { room, count: users[room].length });

    socket.join(room);

    // Custom AI welcome message (improved)
    setTimeout(() => {
      const welcomeMsg = formatMessage(
        'ASKME',
        "Welcome to ASKME AI!\nIf you need any help, just tag me using @ai or @askme — I’m here to assist you.\nThanks for being here, and enjoy your time!",
        'bot'
      );
      socket.emit('message', welcomeMsg);
    }, 300); // 300ms delay
  });

  socket.on('disconnect', () => {
    const { username, room } = socket;
    if (room && users[room]) {
      users[room] = users[room].filter(u => u !== username);
      io.to(room).emit('roomUsers', { room, count: users[room].length }); // <-- CHANGED
    }
  });

  socket.on('chatMessage', async msg => {
    const userId = socket.email || socket.username; // Use email if available
    const now = Date.now();

    // Check for timeout
    if (userWarnings[userId] && userWarnings[userId].timeoutUntil && now < userWarnings[userId].timeoutUntil) {
      socket.emit('message', {
        username: 'System',
        text: '❌ Access Restricted: You have violated our community guidelines multiple times by using offensive language. You are now on a 24-hour timeout. You may rejoin the chat after this period using the same credentials. Thank you for understanding.'
      });
      return;
    }

    // Censor message
    const { censored, found } = censorMessage(msg);

    if (found) {
      // Increment warning count
      if (!userWarnings[userId]) userWarnings[userId] = { count: 0, timeoutUntil: null };
      userWarnings[userId].count += 1;

      // Log warning
      console.log(`Warning ${userWarnings[userId].count} for user ${userId}: ${msg}`);

      // Handle warnings and timeout
      if (userWarnings[userId].count === 1) {
        socket.emit('message', {
          username: 'System',
          text: '⚠️ Warning 1: Inappropriate language has been detected and censored. Please maintain respectful communication in this chat. Continued violations may lead to temporary suspension.'
        });
      } else if (userWarnings[userId].count === 2) {
        socket.emit('message', {
          username: 'System',
          text: '⚠️ Warning 2: This is your second warning for using offensive language. Further violations will result in a 24-hour timeout from the chat. Please adhere to the community guidelines.'
        });
      } else if (userWarnings[userId].count >= 3) {
        // Timeout for 24 hours
        userWarnings[userId].timeoutUntil = now + 24 * 60 * 60 * 1000;
        socket.emit('message', {
          username: 'System',
          text: '❌ Access Restricted: You have violated our community guidelines multiple times by using offensive language. You are now on a 24-hour timeout. You may rejoin the chat after this period using the same credentials. Thank you for understanding.'
        });
        socket.leave(socket.room);
        return;
      }
    }

    // Broadcast censored message to room
    const userMessage = formatMessage(socket.username || 'User', censored, 'user');
    io.to(socket.room).emit('message', userMessage);

    // AI response logic (unchanged)
    if (/@ai\b|@askme\b/i.test(msg)) {
      const aiReply = await getAIResponse(msg);
      const botMessage = formatMessage('ASKME', aiReply, 'bot');
      io.to(socket.room).emit('message', botMessage);
    }
  });
});

// Save user data to a file
app.post('/api/save-user', (req, res) => {
  console.log('Received:', req.body); // Add this line
  const { email, username, room } = req.body;
  if (!email || !username || !room) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const userData = { email, username, room, time: new Date().toISOString() };
  fs.appendFile(
    path.join(__dirname, 'users.txt'),
    JSON.stringify(userData) + '\n',
    err => {
      if (err) return res.status(500).json({ message: 'Failed to save' });
      res.json({ message: 'Saved successfully' });
    }
  );
});

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`💬 Server running on port ${PORT}`));
