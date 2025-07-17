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
        // Проверяем, есть ли логин друга в поле, чтобы сразу попытаться подключиться
        checkFriendLogin();
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
    conn.on('open', () => {
        document.getElementById('startChatBtn').disabled = false;
        console.log('Соединение с другом установлено');
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
    const avatar = document.getElementById('avatar');
    if (avatarUrl) {
        avatar.innerHTML = `<img src="${avatarUrl}" alt="Аватар">`;
    } else {
        const initials = userName.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
        avatar.textContent = initials;
    }
}

function copyUserLogin() {
    const textToCopy = `@${userLogin}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Логин скопирован!');
    });
}

function checkFriendLogin() {
    const friendLogin = document.getElementById('friendLogin').value.trim();
    const startChatBtn = document.getElementById('startChatBtn');
    const friendId = loginToIdMap[friendLogin];
    
    if (friendId && peer && !conn) {
        conn = peer.connect(friendId);
        setupConnection();
    } else {
        startChatBtn.disabled = true;
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && conn && conn.open) {
        conn.send({ sender: userName, message });
        displayMessage(`${userName}: ${message}`);
        messageInput.value = '';
    } else if (!conn || !conn.open) {
        alert('Соединение с другом не установлено');
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