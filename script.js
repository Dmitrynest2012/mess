let peer;
let conn;
let userId;
let userName;
let userLogin;
let avatarUrl;

// Хранилище логинов и их ID (используется только для хранения текущего пользователя)
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
        checkFriendLogin();
    });
    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });
    peer.on('error', (err) => {
        console.error('PeerJS ошибка:', err);
        document.getElementById('startChatBtn').disabled = true;
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
    conn.on('close', () => {
        document.getElementById('startChatBtn').disabled = true;
        console.log('Соединение с другом закрыто');
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
    document.getElementById('profile').style.display = 'flex';
    initializePeer();
}

function logout() {
    if (conn) {
        conn.close();
        conn = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    localStorage.removeItem('userName');
    localStorage.removeItem('userLogin');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('userId');
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('userLogin').textContent = '';
    document.getElementById('avatar').textContent = '';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('profile').style.display = 'none';
    document.getElementById('friendLogin').value = '';
    document.getElementById('chatBox').innerHTML = '';
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
    const textToCopy = `@${userLogin}:${userId}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Логин и ID скопированы!');
    });
}

function checkFriendLogin() {
    const friendInput = document.getElementById('friendLogin').value.trim();
    const startChatBtn = document.getElementById('startChatBtn');
    
    // Извлекаем Peer ID из ввода (@login:PeerID)
    const friendIdMatch = friendInput.match(/^@[^:]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    const friendId = friendIdMatch ? friendIdMatch[1] : null;
    
    // Очищаем предыдущее соединение, если оно существует
    if (conn) {
        conn.close();
        conn = null;
    }

    if (friendId && peer) {
        console.log('Попытка подключения к ID:', friendId);
        conn = peer.connect(friendId);
        setupConnection();
    } else {
        startChatBtn.disabled = true;
        if (friendInput && !friendId) {
            console.log('Неверный формат ввода. Ожидается @login:PeerID');
        }
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

// Очистка localStorage и перезагрузка страницы по Ctrl + F8
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'F8') {
        localStorage.clear();
        location.reload();
    }
});

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
        document.getElementById('profile').style.display = 'flex';
        initializePeer();
    } else {
        document.getElementById('profile').style.display = 'none';
    }
};