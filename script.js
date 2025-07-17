let peer;
let conn;
let userId;
let userName;
let userLogin;
let avatarUrl;

// Хранилище логинов и их ID
const loginToIdMap = JSON.parse(localStorage.getItem('loginToIdMap')) || {};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function initializePeer() {
    peer = new Peer(userId);
    peer.on('open', () => {
        console.log('PeerJS открыт с ID:', userId);
    });
    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });
}

function setupConnection() {
    conn.on('data', (data) => {
        displayMessage(`${data.sender}: ${data.message}`);
    });
}

function login() {
    userName = document.getElementById('nameInput').value.trim();
    userLogin = document.getElementById('loginInput').value.trim();
    avatarUrl = document.getElementById('avatarInput').value.trim();
    
    if (!userName || !userLogin) {
        alert('Пожалуйста, введите имя и логин');
        return;
    }

    // Проверка уникальности логина
    if (loginToIdMap[userLogin] && loginToIdMap[userLogin] !== localStorage.getItem('userId')) {
        alert('Этот логин уже занят');
        return;
    }

    userId = localStorage.getItem('userId') || generateUUID();
    loginToIdMap[userLogin] = userId;
    
    localStorage.setItem('userName', userName);
    localStorage.setItem('userLogin', userLogin);
    localStorage.setItem('avatarUrl', avatarUrl);
    localStorage.setItem('userId', userId);
    localStorage.setItem('loginToIdMap', JSON.stringify(loginToIdMap));

    updateProfile();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('chatSection').style.display = 'block';
    initializePeer();
}

function updateProfile() {
    document.getElementById('username').textContent = userName;
    document.getElementById('userLogin').textContent = `@${userLogin}`;
    document.getElementById('userId').textContent = `ID: ${userId}`;
    const avatar = document.getElementById('avatar');
    if (avatarUrl) {
        avatar.innerHTML = `<img src="${avatarUrl}" alt="Аватар">`;
    } else {
        const initials = userName.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
        avatar.textContent = initials;
    }
}

function copyUserId() {
    const textToCopy = `@${userLogin}:${userId}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Логин и ID скопированы!');
    });
}

function checkFriendLogin() {
    const friendLogin = document.getElementById('friendLogin').value.trim();
    const startChatBtn = document.getElementById('startChatBtn');
    const friendId = loginToIdMap[friendLogin];
    startChatBtn.disabled = !friendId;
    if (friendId) {
        conn = peer.connect(friendId);
        setupConnection();
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && conn) {
        conn.send({ sender: userName, message });
        displayMessage(`${userName}: ${message}`);
        messageInput.value = '';
    }
}

function displayMessage(message) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('friendLogin').addEventListener('input', checkFriendLogin);

// Загрузка сохраненных данных
window.onload = () => {
    userName = localStorage.getItem('userName');
    userLogin = localStorage.getItem('userLogin');
    avatarUrl = localStorage.getItem('avatarUrl');
    userId = localStorage.getItem('userId');
    if (userName && userLogin && userId) {
        updateProfile();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        initializePeer();
    }
};