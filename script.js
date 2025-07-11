const users = JSON.parse(localStorage.getItem('users')) || {};
const messages = JSON.parse(localStorage.getItem('messages')) || {};
let currentUser = null;
let currentChat = null;

const connections = {};

const peer = new Peer({ host: 'peerjs.com', port: 443, secure: true });

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
}

function saveMessages() {
    localStorage.setItem('messages', JSON.stringify(messages));
}

function initPeer() {
    peer = new Peer(generateId());
    peer.on('open', (id) => {
        if (currentUser) {
            users[currentUser.login].peerId = id;
            saveUsers();
            broadcastUserUpdate(currentUser.login);
        }
    });

    peer.on('connection', (conn) => {
        connections[conn.peer] = conn;
        conn.on('data', (data) => {
            handlePeerData(data, conn);
        });
    });
}

function connectToPeer(peerId) {
    if (!connections[peerId]) {
        const conn = peer.connect(peerId);
        connections[peerId] = conn;
        conn.on('open', () => {
            conn.send({ type: 'userUpdate', user: users[currentUser.login] });
        });
        conn.on('data', (data) => {
            handlePeerData(data, conn);
        });
    }
}

function handlePeerData(data, conn) {
    if (data.type === 'userUpdate') {
        users[data.user.login] = data.user;
        saveUsers();
        updateFriendsList();
    } else if (data.type === 'friendRequest') {
        if (confirm(`Пользователь ${data.from} хочет добавить вас в друзья. Принять?`)) {
            users[currentUser.login].friends = users[currentUser.login].friends || [];
            users[currentUser.login].friends.push(data.from);
            saveUsers();
            broadcastUserUpdate(currentUser.login);
            updateFriendsList();
        }
    } else if (data.type === 'message') {
        const chatId = [currentUser.login, data.from].sort().join('-');
        messages[chatId] = messages[chatId] || [];
        messages[chatId].push({
            from: data.from,
            text: data.text,
            timestamp: new Date().toISOString(),
            read: false
        });
        saveMessages();
        if (currentChat === data.from) {
            displayMessages();
        }
    }
}

function broadcastUserUpdate(login) {
    const user = users[login];
    Object.values(connections).forEach(conn => {
        conn.send({ type: 'userUpdate', user });
    });
}

function register() {
    const login = document.getElementById('reg-login').value;
    const name = document.getElementById('reg-name').value;
    const password = document.getElementById('reg-password').value;

    if (users[login]) {
        alert('Логин уже занят');
        return;
    }

    users[login] = { login, name, password, friends: [], avatar: '' };
    saveUsers();
    alert('Регистрация успешна');
    showLogin();
}

function login() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    if (users[login] && users[login].password === password) {
        currentUser = users[login];
        initPeer();
        showMessenger();
        updateProfileDisplay();
        updateFriendsList();
    } else {
        alert('Неверный логин или пароль');
    }
}

function showRegister() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-section').style.display = 'none';
    document.getElementById('auth-section').style.display = 'block';
}

function showMessenger() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'none';
    document.getElementById('messenger').style.display = 'flex';
    document.getElementById('profile-section').style.display = 'none';
}

function showProfile() {
    document.getElementById('messenger').style.display = 'none';
    document.getElementById('profile-section').style.display = 'block';
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-avatar').src = currentUser.avatar || '';
}

function updateProfile() {
    const newName = document.getElementById('profile-name').value;
    const newAvatar = document.getElementById('profile-avatar-url').value;

    if (newName) currentUser.name = newName;
    if (newAvatar) currentUser.avatar = newAvatar;
    users[currentUser.login] = currentUser;
    saveUsers();
    broadcastUserUpdate(currentUser.login);
    updateProfileDisplay();
    showMessenger();
}

function updateProfileDisplay() {
    document.getElementById('username').textContent = currentUser.name;
    document.getElementById('avatar').src = currentUser.avatar || '';
}

function searchUser() {
    const query = document.getElementById('search-user').value.toLowerCase();
    const found = Object.values(users).find(u => 
        u.login.toLowerCase() === query || u.name.toLowerCase() === query
    );

    if (found && found.login !== currentUser.login) {
        if (confirm(`Добавить ${found.name} (${found.login}) в друзья?`)) {
            users[currentUser.login].friends = users[currentUser.login].friends || [];
            users[currentUser.login].friends.push(found.login);
            saveUsers();
            updateFriendsList();
            if (found.peerId) {
                connectToPeer(found.peerId);
                connections[found.peerId].send({ 
                    type: 'friendRequest', 
                    from: currentUser.login 
                });
            }
        }
    } else {
        alert('Пользователь не найден или это вы');
    }
}

function updateFriendsList() {
    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = '';
    (currentUser.friends || []).forEach(friend => {
        const li = document.createElement('li');
        li.textContent = users[friend]?.name || friend;
        li.onclick = () => selectChat(friend);
        friendsList.appendChild(li);
    });
}

function selectChat(friend) {
    currentChat = friend;
    document.getElementById('chat-header').textContent = users[friend]?.name || friend;
    displayMessages();
    if (users[friend]?.peerId) {
        connectToPeer(users[friend].peerId);
    }
}

function displayMessages() {
    const chatId = [currentUser.login, currentChat].sort().join('-');
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';
    (messages[chatId] || []).forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.from === currentUser.login ? 'sent' : 'received'}`;
        div.innerHTML = `
            <strong>${users[msg.from]?.name || msg.from}</strong><br>
            ${msg.text}<br>
            <small>${new Date(msg.timestamp).toLocaleString()} • ${msg.read ? 'Прочитано' : 'Не прочитано'}</small>
        `;
        messagesDiv.appendChild(div);
        if (msg.from !== currentUser.login && !msg.read) {
            msg.read = true;
            saveMessages();
        }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendMessage() {
    const text = document.getElementById('message-text').value;
    if (text && currentChat) {
        const chatId = [currentUser.login, currentChat].sort().join('-');
        messages[chatId] = messages[chatId] || [];
        const message = {
            from: currentUser.login,
            text,
            timestamp: new Date().toISOString(),
            read: false
        };
        messages[chatId].push(message);
        saveMessages();
        if (users[currentChat]?.peerId) {
            connectToPeer(users[currentChat].peerId);
            connections[users[currentChat].peerId].send({ 
                type: 'message', 
                from: currentUser.login, 
                text 
            });
        }
        displayMessages();
        document.getElementById('message-text').value = '';
    }
}