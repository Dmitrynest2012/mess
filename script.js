let peer;
let conn;
let userId;
let userName;
let userLogin;
let avatarUrl;
let currentFriend = null;

// Хранилище логинов и их ID (для проверки уникальности текущего пользователя)
const loginToIdMap = JSON.parse(localStorage.getItem('loginToIdMap')) || {};
// Хранилище друзей с сообщениями и статусом
const friendsList = JSON.parse(localStorage.getItem('friendsList')) || [];

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
        document.getElementById('startChatBtn').textContent = 'Начать чат';
        document.getElementById('startChatBtn').classList.remove('reconnect');
        if (currentFriend) {
            document.getElementById('chatTitle').textContent = 'Начать чат';
            document.getElementById('chatSection').classList.add('chat-inactive');
        }
    });
}

function setupConnection() {
    conn.on('open', () => {
        // Отправляем свои данные другу
        conn.send({ type: 'userInfo', name: userName, login: userLogin, avatar: avatarUrl });
        // Обновляем статус друга
        const friend = friendsList.find(f => f.peerId === conn.peer);
        if (friend) {
            friend.online = true;
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
        document.getElementById('startChatBtn').disabled = false;
        document.getElementById('startChatBtn').textContent = 'Начать чат';
        document.getElementById('startChatBtn').classList.remove('reconnect');
        if (currentFriend) {
            document.getElementById('chatTitle').textContent = `Чат с ${currentFriend.name}`;
            document.getElementById('chatSection').classList.remove('chat-inactive');
        }
        console.log('Соединение с другом установлено');
    });
    conn.on('data', (data) => {
        if (data.type === 'userInfo') {
            // Обновляем данные друга при получении его информации
            const friend = friendsList.find(f => f.peerId === conn.peer);
            if (friend) {
                friend.name = data.name;
                friend.login = data.login;
                friend.avatar = data.avatar;
                friend.online = true;
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
            } else {
                // Автоматическое добавление нового друга
                const newFriend = {
                    name: data.name,
                    login: data.login,
                    peerId: conn.peer,
                    avatar: data.avatar,
                    messages: [],
                    online: true
                };
                friendsList.push(newFriend);
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
                // Открываем чат с новым другом, если он только что добавлен
                if (!currentFriend || currentFriend.peerId !== conn.peer) {
                    selectFriend(newFriend);
                }
            }
        } else {
            // Сохраняем сообщение
            const friend = friendsList.find(f => f.peerId === conn.peer);
            if (friend) {
                friend.messages = friend.messages || [];
                friend.messages.push({ sender: data.sender, message: data.message, avatar: data.avatar, timestamp: new Date().toISOString() });
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                if (currentFriend && currentFriend.peerId === conn.peer) {
                    displayMessage(data.sender, data.message, data.avatar, friend.messages[friend.messages.length - 1].timestamp);
                }
            }
        }
    });
    conn.on('close', () => {
        // Обновляем статус друга на оффлайн
        const friend = friendsList.find(f => f.peerId === conn.peer);
        if (friend) {
            friend.online = false;
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
        document.getElementById('startChatBtn').disabled = true;
        document.getElementById('startChatBtn').textContent = currentFriend ? 'Повторите копирование ID' : 'Начать чат';
        document.getElementById('startChatBtn').classList.add('reconnect');
        if (currentFriend) {
            document.getElementById('chatTitle').textContent = 'Начать чат';
            document.getElementById('chatSection').classList.add('chat-inactive');
        }
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
    document.getElementById('friendsPanel').style.display = 'block';
    document.getElementById('chatSection').classList.add('chat-inactive');
    updateFriendsList();
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
    localStorage.removeItem('friendsList');
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('userLogin').textContent = '';
    document.getElementById('avatar').textContent = '';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('profile').style.display = 'none';
    document.getElementById('friendsPanel').style.display = 'none';
    document.getElementById('friendLogin').value = '';
    document.getElementById('friendLogin').dataset.peerId = '';
    document.getElementById('chatBox').innerHTML = '';
    document.getElementById('chatTitle').textContent = 'Начать чат';
    document.getElementById('chatSection').classList.add('chat-inactive');
    currentFriend = null;
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
    const friendId = document.getElementById('friendLogin').dataset.peerId;
    
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
        startChatBtn.textContent = currentFriend ? 'Повторите копирование ID' : 'Начать чат';
        startChatBtn.classList.toggle('reconnect', !!currentFriend);
        if (currentFriend) {
            document.getElementById('chatTitle').textContent = 'Начать чат';
            document.getElementById('chatSection').classList.add('chat-inactive');
        }
        if (friendInput && !friendId) {
            console.log('Неверный формат ввода. Ожидается @login:PeerID');
        }
    }
}

function startChat() {
    const friendInput = document.getElementById('friendLogin').value.trim();
    const friendId = document.getElementById('friendLogin').dataset.peerId;
    const match = friendInput.match(/^@([^:]+)/);
    
    if (match && friendId) {
        const friend = friendsList.find(f => f.peerId === friendId);
        if (friend) {
            selectFriend(friend);
        }
    }
}

function addFriend() {
    const friendInput = prompt('Введите @login:PeerID друга:');
    if (friendInput) {
        const match = friendInput.match(/^@([^:]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
        if (match) {
            const friendLogin = match[1];
            const friendId = match[2];
            if (!friendsList.some(f => f.peerId === friendId)) {
                const friendName = friendLogin; // Имя пока равно логину
                const friendAvatar = ''; // Аватар пока пустой
                const friend = { name: friendName, login: friendLogin, peerId: friendId, avatar: friendAvatar, messages: [], online: false };
                friendsList.push(friend);
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
                selectFriend(friend); // Автоматически открываем чат с новым другом
            } else {
                alert('Этот друг уже в списке');
            }
        } else {
            alert('Неверный формат. Ожидается @login:PeerID');
        }
    }
}

function updateFriendsList() {
    const friendsListElement = document.getElementById('friendsList');
    friendsListElement.innerHTML = '';
    friendsList.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.onclick = () => selectFriend(friend);
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        if (friend.avatar) {
            avatar.innerHTML = `<img src="${friend.avatar}" alt="Аватар">`;
        } else {
            const initials = friend.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
            avatar.textContent = initials;
        }
        const statusIndicator = document.createElement('div');
        statusIndicator.className = `status-indicator ${friend.online ? 'status-online' : 'status-offline'}`;
        const friendInfo = document.createElement('div');
        friendInfo.className = 'friend-info';
        friendInfo.innerHTML = `<span>${friend.name}</span><span>@${friend.login}</span>`;
        friendItem.appendChild(avatar);
        friendItem.appendChild(statusIndicator);
        friendItem.appendChild(friendInfo);
        friendsListElement.appendChild(friendItem);
    });
}

function selectFriend(friend) {
    currentFriend = friend;
    document.getElementById('friendLogin').value = `@${friend.login}`;
    document.getElementById('friendLogin').dataset.peerId = friend.peerId;
    // Очищаем текущий чат и отображаем сообщения выбранного друга
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    if (friend.messages) {
        friend.messages.forEach(msg => {
            displayMessage(msg.sender, msg.message, msg.avatar, msg.timestamp);
        });
    }
    document.getElementById('chatTitle').textContent = `Чат с ${friend.name}`;
    document.getElementById('chatSection').classList.remove('chat-inactive');
    checkFriendLogin();
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && conn && conn.open) {
        conn.send({ sender: userName, message, avatar: avatarUrl });
        // Сохраняем отправленное сообщение в friendsList
        if (currentFriend) {
            currentFriend.messages = currentFriend.messages || [];
            currentFriend.messages.push({ sender: userName, message, avatar: avatarUrl, timestamp: new Date().toISOString() });
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            displayMessage(userName, message, avatarUrl, new Date().toISOString());
        }
        messageInput.value = '';
    } else if (!conn || !conn.open) {
        alert('Соединение с другом не установлено');
    }
}

function displayMessage(sender, message, avatar, timestamp) {
    if (!currentFriend || currentFriend.peerId !== conn?.peer) return; // Отображаем только для текущего друга
    const chatBox = document.getElementById('chatBox');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    const messageHeaderLeft = document.createElement('div');
    messageHeaderLeft.className = 'message-header-left';
    
    const avatarElement = document.createElement('div');
    avatarElement.className = 'avatar';
    if (avatar) {
        avatarElement.innerHTML = `<img src="${avatar}" alt="Аватар">`;
    } else {
        const initials = sender.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
        avatarElement.textContent = initials;
    }
    
    const nameElement = document.createElement('span');
    nameElement.className = 'name';
    nameElement.textContent = sender;
    
    const timestampElement = document.createElement('span');
    timestampElement.className = 'timestamp';
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(',', '');
    timestampElement.textContent = dateStr;
    
    messageHeaderLeft.appendChild(avatarElement);
    messageHeaderLeft.appendChild(nameElement);
    messageHeader.appendChild(messageHeaderLeft);
    messageHeader.appendChild(timestampElement);
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = message;
    
    messageContainer.appendChild(messageHeader);
    messageContainer.appendChild(messageText);
    chatBox.appendChild(messageContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Обработка ввода в поле friendLogin
document.getElementById('friendLogin').addEventListener('input', (event) => {
    const input = event.target.value.trim();
    const match = input.match(/^@([^:]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    
    if (match) {
        const login = match[1];
        const peerId = match[2];
        event.target.value = `@${login}`;
        event.target.dataset.peerId = peerId;
        // Проверяем, есть ли друг в списке
        let friend = friendsList.find(f => f.peerId === peerId);
        if (!friend) {
            // Добавляем нового друга
            const friendName = login; // Имя пока равно логину
            const friendAvatar = ''; // Аватар пока пустой
            friend = { name: friendName, login: login, peerId: peerId, avatar: friendAvatar, messages: [], online: false };
            friendsList.push(friend);
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
        selectFriend(friend); // Открываем чат с другом
    } else {
        event.target.dataset.peerId = '';
        document.getElementById('startChatBtn').disabled = true;
        document.getElementById('startChatBtn').textContent = currentFriend ? 'Повторите копирование ID' : 'Начать чат';
        document.getElementById('startChatBtn').classList.toggle('reconnect', !!currentFriend);
        document.getElementById('chatTitle').textContent = 'Начать чат';
        document.getElementById('chatSection').classList.add('chat-inactive');
    }
});

// Очистка localStorage и перезагрузка страницы по Ctrl + F8
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'F8') {
        localStorage.clear();
        location.reload();
    }
});

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
        document.getElementById('friendsPanel').style.display = 'block';
        document.getElementById('chatSection').classList.add('chat-inactive');
        updateFriendsList();
        initializePeer();
    } else {
        document.getElementById('profile').style.display = 'none';
        document.getElementById('friendsPanel').style.display = 'none';
    }
};