let peer;
let conn;
let userId;
let userName;
let avatarUrl;

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
    avatarUrl = document.getElementById('avatarInput').value.trim();
    
    if (!userName) {
        alert('Пожалуйста, введите имя');
        return;
    }

    userId = generateUUID();
    localStorage.setItem('userName', userName);
    localStorage.setItem('avatarUrl', avatarUrl);
    localStorage.setItem('userId', userId);

    updateProfile();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('chatSection').style.display = 'block';
    initializePeer();
}

function updateProfile() {
    document.getElementById('username').textContent = userName;
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
    navigator.clipboard.writeText(userId).then(() => {
        alert('ID скопирован!');
    });
}

function checkFriendId() {
    const friendId = document.getElementById('friendId').value.trim();
    const startChatBtn = document.getElementById('startChatBtn');
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

document.getElementById('friendId').addEventListener('input', checkFriendId);

// Загрузка сохраненных данных
window.onload = () => {
    userName = localStorage.getItem('userName');
    avatarUrl = localStorage.getItem('avatarUrl');
    userId = localStorage.getItem('userId');
    if (userName && userId) {
        updateProfile();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        initializePeer();
    }
};