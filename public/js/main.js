// DOM Elements
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const leaveBtn = document.getElementById('leave-btn');
const modal = document.getElementById('welcomeModal');
const closeModalBtn = document.getElementById('closeModal');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const form = document.querySelector('.chat-inputbar');
const input = form.querySelector('input');
const messages = document.querySelector('.chat-messages');

// Parse query string for username and room
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Initialize Socket.io
const socket = io();

// Join chat room
socket.emit('joinRoom', { username, room });

// Receive updated room and users list
socket.on('roomUsers', (data) => {
  outputRoomName(data.room);
  outputUsers(data.count);
});

// Receive message from server or users
socket.on('message', function(msg) {
  // Render the message in the chat
  // Example:
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = msg.username === 'ASKME' ? 'flex-start' : 'flex-end';

  const userLabel = document.createElement('div');
  userLabel.textContent = msg.username;
  userLabel.style.fontSize = '0.92em';
  userLabel.style.fontWeight = 'bold';
  userLabel.style.color = msg.username === 'ASKME' ? '#2563eb' : '#23272f';
  userLabel.style.marginBottom = '2px';

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (msg.username === 'ASKME' ? 'incoming' : 'outgoing');
  bubble.textContent = msg.text;

  wrapper.appendChild(userLabel);
  wrapper.appendChild(bubble);

  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
});

// Receive message from bot
socket.on('botMessage', (message) => {
  outputMessage(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Submit chat message
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msgInput = e.target.elements.msg;
  const msg = msgInput.value.trim();

  if (!msg) return;

  // Emit user message
  socket.emit('chatMessage', msg);

  // Simulate bot reply
  simulateBotResponse(msg);

  // Reset input
  msgInput.value = '';
  msgInput.focus();
});

// Display room name
function outputRoomName(room) {
  roomName.innerText = room;
}

// Display users list
function outputUsers(count) {
  userList.innerHTML = '';
  const li = document.createElement('li');
  if (typeof count !== 'number') {
    li.innerText = 'Connecting...';
  } else {
    li.innerText = count === 1 ? `User online: 1` : `Users online: ${count}`;
  }
  userList.appendChild(li);
}

// Bot response simulation
function simulateBotResponse(userMessage) {
  setTimeout(() => {
    const botReply = generateBotReply(userMessage);
    const botMessage = {
      username: 'InstaBot 🤖',
      text: botReply,
      time: getTime(),
    };
    socket.emit('botMessage', botMessage);
  }, 1000);
}

// Generate AI bot's reply
function generateBotReply(userMessage) {
  const lower = userMessage.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) {
    return "Hi there! How can I assist you?";
  } else if (lower.includes('how are you')) {
    return "I'm just code, but I'm doing great! 😊";
  } else if (lower.includes('help')) {
    return "Sure! What do you need help with?";
  } else if (lower.includes('bye')) {
    return "Goodbye! Have a great day!";
  } else {
    return "I'm not sure I understand. Can you ask in a different way?";
  }
}

// Format time
function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(message.username === 'InstaBot 🤖' ? 'bot' : 'user');
  div.innerHTML = `
    <div class="avatar">
      <img src="img/${message.username === 'InstaBot 🤖' ? 'bot.png' : 'user.png'}" alt="avatar">
    </div>
    <div class="msg-content">
      <p class="meta">${message.username}</p>
      <p class="text">${message.text}</p>
    </div>
  `;
  document.querySelector('.chat-messages').appendChild(div);
  document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
}

// Handle leave button
leaveBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this chatroom?')) {
    window.location.href = '../index.html';
  }
});

// Modal close button logic
if (closeModalBtn && modal) {
  closeModalBtn.onclick = function () {
    modal.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

document.querySelector('form').addEventListener('submit', function(e) {
  e.preventDefault(); // Prevent default form submission

  // Send data to backend before redirecting
  fetch('/api/save-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailInput.value,
      username: usernameInput.value,
      room: "Chill Zone" // Always use Chill Zone
    })
  });

  // Always redirect to Chill Zone
  window.location.href = `chill.html?username=${encodeURIComponent(usernameInput.value)}&email=${encodeURIComponent(emailInput.value)}`;
});

document.getElementById('username').addEventListener('input', function(e) {
  this.value = this.value.replace(/[^a-zA-Z0-9]/g, '');
});

form.addEventListener('submit', function(e) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chatMessage', text);
  input.value = '';
});

// Listen for disconnect event
socket.on('disconnect', () => {
  const { username, room } = socket;
  if (room && users[room]) {
    users[room] = users[room].filter(u => u !== username);
    io.to(room).emit('roomUsers', { room, count: users[room].length });
  }
});