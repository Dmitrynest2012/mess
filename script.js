let peer;
let conn;
let userId;
let userName;
let userLogin;
let avatarUrl;
let currentFriend = null;
let typingTimeout;
let typingInterval;
let connections = {};

const loginToIdMap = JSON.parse(localStorage.getItem('loginToIdMap')) || {};
let friendsList = JSON.parse(localStorage.getItem('friendsList')) || [];

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function updateUnreadCount() {
    const unreadCount = friendsList.reduce((total, friend) => {
        return total + (friend.messages || []).filter(msg => msg.sender !== userName && !msg.viewed).length;
    }, 0);
    document.title = unreadCount > 0 ? `(${unreadCount}) Пиринговый чат` : 'Пиринговый чат';
}

function initializePeer() {
    peer = new Peer(userId);
    peer.on('open', () => {
        console.log('PeerJS открыт с ID:', userId);
        friendsList.forEach(friend => {
            if (!connections[friend.peerId]) {
                connectToFriend(friend.peerId);
            }
        });
    });
    peer.on('connection', (connection) => {
        const friendId = connection.peer;
        connections[friendId] = connection;
        setupConnection(connection);
        const friend = friendsList.find(f => f.peerId === friendId);
        if (friend) {
            friend.online = true;
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
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

function connectToFriend(friendId) {
    if (peer && !connections[friendId]) {
        console.log('Попытка подключения к ID:', friendId);
        const connection = peer.connect(friendId);
        connections[friendId] = connection;
        setupConnection(connection);
    }
}

function setupConnection(connection) {
    const friendId = connection.peer;
    connection.on('open', () => {
        connection.send({ type: 'userInfo', name: userName, login: userLogin, avatar: avatarUrl });
        const friend = friendsList.find(f => f.peerId === friendId);
        if (friend) {
            friend.online = true;
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
        if (currentFriend && currentFriend.peerId === friendId) {
            document.getElementById('startChatBtn').disabled = false;
            document.getElementById('startChatBtn').textContent = 'Начать чат';
            document.getElementById('startChatBtn').classList.remove('reconnect');
            document.getElementById('chatTitle').textContent = `Чат с ${currentFriend.name}`;
            document.getElementById('chatSection').classList.remove('chat-inactive');
        }
        console.log('Соединение с другом установлено:', friendId);
    });
    connection.on('data', (data) => {
        const friend = friendsList.find(f => f.peerId === friendId);
        if (data.type === 'userInfo') {
            if (friend) {
                friend.name = data.name;
                friend.login = data.login;
                friend.avatar = data.avatar;
                friend.online = true;
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
                if (currentFriend && currentFriend.peerId === friendId) {
                    document.getElementById('chatTitle').textContent = `Чат с ${friend.name}`;
                    updateMessagesDisplay();
                }
            } else {
                const newFriend = {
                    name: data.name,
                    login: data.login,
                    peerId: friendId,
                    avatar: data.avatar,
                    messages: [],
                    online: true
                };
                friendsList.push(newFriend);
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
                if (!currentFriend || currentFriend.peerId !== friendId) {
                    selectFriend(newFriend);
                }
            }
        } else if (data.type === 'typing') {
            if (currentFriend && currentFriend.peerId === friendId) {
                showTypingIndicator(data.sender, data.avatar);
            }
        } else if (data.type === 'stopTyping') {
            if (currentFriend && currentFriend.peerId === friendId) {
                hideTypingIndicator();
            }
        } else if (data.type === 'messageViewed') {
            if (currentFriend && currentFriend.peerId === friendId) {
                const messageElement = document.querySelector(`.message-container[data-message-id="${data.messageId}"] .status-checks`);
                if (messageElement) {
                    messageElement.classList.add('viewed');
                }
            }
            if (friend && friend.messages) {
                const message = friend.messages.find(m => m.messageId === data.messageId);
                if (message) {
                    message.viewed = true;
                    localStorage.setItem('friendsList', JSON.stringify(friendsList));
                    updateUnreadCount();
                    updateFriendsList();
                }
            }
        } else if (data.type === 'removeFriend') {
            friendsList = friendsList.filter(f => f.peerId !== friendId);
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
            if (currentFriend && currentFriend.peerId === friendId) {
                currentFriend = null;
                document.getElementById('chatBox').innerHTML = '';
                document.getElementById('chatTitle').textContent = 'Начать чат';
                document.getElementById('chatSection').classList.add('chat-inactive');
                document.getElementById('friendLogin').value = '';
                document.getElementById('friendLogin').dataset.peerId = '';
            }
            if (connections[friendId] && connections[friendId].open) {
                connections[friendId].close();
                delete connections[friendId];
            }
        } else {
            if (friend) {
                friend.messages = friend.messages || [];
                const messageId = generateUUID();
                const isCurrentChat = currentFriend && currentFriend.peerId === friendId;
                friend.messages.push({ 
                    sender: data.sender, 
                    message: data.message, 
                    avatar: data.avatar, 
                    timestamp: new Date().toISOString(), 
                    messageId: messageId,
                    viewed: isCurrentChat // Помечаем как прочитанное, если чат открыт
                });
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                if (isCurrentChat) {
                    displayMessage(data.sender, data.message, data.avatar, friend.messages[friend.messages.length - 1].timestamp, messageId);
                    // Отправляем событие messageViewed другу
                    if (connections[friendId] && connections[friendId].open) {
                        connections[friendId].send({ type: 'messageViewed', messageId: messageId });
                    }
                }
                const audio = document.getElementById('notificationSound');
                audio.play().catch(err => console.error('Ошибка воспроизведения звука:', err));
                updateUnreadCount();
                updateFriendsList();
            }
        }
    });
    connection.on('close', () => {
        const friend = friendsList.find(f => f.peerId === friendId);
        if (friend) {
            friend.online = false;
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
        }
        delete connections[friendId];
        if (currentFriend && currentFriend.peerId === friendId) {
            document.getElementById('startChatBtn').disabled = true;
            document.getElementById('startChatBtn').textContent = 'Повторите копирование ID';
            document.getElementById('startChatBtn').classList.add('reconnect');
            document.getElementById('chatTitle').textContent = 'Начать чат';
            document.getElementById('chatSection').classList.add('chat-inactive');
        }
        console.log('Соединение с другом закрыто:', friendId);
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
    localStorage.setItem('friendsList', JSON.stringify([]));

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
    Object.values(connections).forEach(conn => {
        if (conn.open) conn.close();
    });
    connections = {};
    if (peer) {
        peer.destroy();
        peer = null;
    }
    localStorage.removeItem('userName');
    localStorage.setItem('friendsList', JSON.stringify([]));
    localStorage.removeItem('userLogin');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('userId');
    friendsList.length = 0;
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
    document.title = 'Пиринговый чат';
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

function openProfileEdit() {
    document.getElementById('editNameInput').value = userName;
    document.getElementById('editAvatarInput').value = avatarUrl;
    document.getElementById('profileEditModal').style.display = 'flex';
}

function closeProfileEdit() {
    document.getElementById('profileEditModal').style.display = 'none';
}

function updateProfileInfo() {
    const newName = document.getElementById('editNameInput').value.trim();
    const newAvatar = document.getElementById('editAvatarInput').value.trim();
    if (!newName) {
        alert('Пожалуйста, введите имя');
        return;
    }
    userName = newName;
    avatarUrl = newAvatar;
    localStorage.setItem('userName', userName);
    localStorage.setItem('avatarUrl', avatarUrl);
    updateProfile();
    Object.values(connections).forEach(conn => {
        if (conn.open) {
            conn.send({ type: 'userInfo', name: userName, login: userLogin, avatar: avatarUrl });
        }
    });
    document.getElementById('profileEditModal').style.display = 'none';
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
    
    if (currentFriend && connections[currentFriend.peerId]) {
        conn = connections[currentFriend.peerId];
    } else {
        conn = null;
    }

    if (friendId && peer && !connections[friendId]) {
        connectToFriend(friendId);
    } else if (!friendId) {
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
                const friendName = friendLogin;
                const friendAvatar = '';
                const friend = { name: friendName, login: friendLogin, peerId: friendId, avatar: friendAvatar, messages: [], online: false };
                friendsList.push(friend);
                localStorage.setItem('friendsList', JSON.stringify(friendsList));
                updateFriendsList();
                connectToFriend(friendId);
                selectFriend(friend);
            } else {
                alert('Этот друг уже в списке');
            }
        } else {
            alert('Неверный формат. Ожидается @login:PeerID');
        }
    }
}

function removeFriend(friendId) {
    const friend = friendsList.find(f => f.peerId === friendId);
    if (friend) {
        if (connections[friendId] && connections[friendId].open) {
            connections[friendId].send({ type: 'removeFriend', peerId: userId });
            connections[friendId].close();
            delete connections[friendId];
        }
        friendsList = friendsList.filter(f => f.peerId !== friendId);
        localStorage.setItem('friendsList', JSON.stringify(friendsList));
        updateFriendsList();
        if (currentFriend && currentFriend.peerId === friendId) {
            currentFriend = null;
            document.getElementById('chatBox').innerHTML = '';
            document.getElementById('chatTitle').textContent = 'Начать чат';
            document.getElementById('chatSection').classList.add('chat-inactive');
            document.getElementById('friendLogin').value = '';
            document.getElementById('friendLogin').dataset.peerId = '';
        }
        updateUnreadCount();
    }
}

function updateFriendsList() {
    const friendsListElement = document.getElementById('friendsList');
    friendsListElement.innerHTML = '';
    friendsList.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        if (currentFriend && friend.peerId === currentFriend.peerId) {
            friendItem.classList.add('selected');
        }
        friendItem.onclick = () => selectFriend(friend);
        const unreadCount = (friend.messages || []).filter(msg => msg.sender !== userName && !msg.viewed).length;
        if (unreadCount > 0) {
            const unreadCounter = document.createElement('div');
            unreadCounter.className = 'unread-counter';
            unreadCounter.textContent = unreadCount;
            friendItem.appendChild(unreadCounter);
        }
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
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-friend-btn';
        removeButton.textContent = '🗑️';
        removeButton.title = 'Удалить друга';
        removeButton.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Удалить друга ${friend.name} (@${friend.login})?`)) {
                removeFriend(friend.peerId);
            }
        };
        friendItem.appendChild(avatar);
        friendItem.appendChild(statusIndicator);
        friendItem.appendChild(friendInfo);
        friendItem.appendChild(removeButton);
        friendsListElement.appendChild(friendItem);
    });
    updateUnreadCount();
}

function selectFriend(friend) {
    currentFriend = friend;
    document.getElementById('friendLogin').value = `@${friend.login}`;
    document.getElementById('friendLogin').dataset.peerId = friend.peerId;
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    if (friend.messages) {
        friend.messages.forEach(msg => {
            displayMessage(msg.sender, msg.message, msg.avatar, msg.timestamp, msg.messageId);
        });
    }
    document.getElementById('chatTitle').textContent = `Чат с ${friend.name}`;
    document.getElementById('chatSection').classList.remove('chat-inactive');
    if (friend.messages) {
        friend.messages.forEach(msg => {
            if (msg.sender !== userName && !msg.viewed) {
                msg.viewed = true;
                if (connections[friend.peerId] && connections[friend.peerId].open) {
                    connections[friend.peerId].send({ type: 'messageViewed', messageId: msg.messageId });
                }
            }
        });
        localStorage.setItem('friendsList', JSON.stringify(friendsList));
        updateUnreadCount();
        updateFriendsList();
    }
    checkFriendLogin();
}

function updateMessagesDisplay() {
    if (currentFriend) {
        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML = '';
        if (currentFriend.messages) {
            currentFriend.messages.forEach(msg => {
                displayMessage(msg.sender, msg.message, msg.avatar, msg.timestamp, msg.messageId);
            });
        }
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && currentFriend && connections[currentFriend.peerId] && connections[currentFriend.peerId].open) {
        const messageId = generateUUID();
        connections[currentFriend.peerId].send({ sender: userName, message, avatar: avatarUrl, messageId: messageId });
        currentFriend.messages = currentFriend.messages || [];
        currentFriend.messages.push({ 
            sender: userName, 
            message, 
            avatar: avatarUrl, 
            timestamp: new Date().toISOString(), 
            messageId: messageId,
            viewed: true 
        });
        localStorage.setItem('friendsList', JSON.stringify(friendsList));
        displayMessage(userName, message, avatarUrl, new Date().toISOString(), messageId);
        messageInput.value = '';
        connections[currentFriend.peerId].send({ type: 'stopTyping' });
        clearTimeout(typingTimeout);
        clearInterval(typingInterval);
        hideEmojiPicker();
    } else if (!currentFriend || !connections[currentFriend?.peerId]?.open) {
        alert('Соединение с другом не установлено');
    }
}

function showTypingIndicator(sender, avatar) {
    if (!currentFriend || currentFriend.peerId !== conn?.peer) return;
    let typingContainer = document.getElementById('typingIndicator');
    if (!typingContainer) {
        typingContainer = document.createElement('div');
        typingContainer.id = 'typingIndicator';
        typingContainer.className = 'message-container typing';
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
        messageHeaderLeft.appendChild(avatarElement);
        messageHeaderLeft.appendChild(nameElement);
        messageHeader.appendChild(messageHeaderLeft);
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.id = 'typingText';
        messageText.textContent = 'Печатает .';
        typingContainer.appendChild(messageHeader);
        typingContainer.appendChild(messageText);
        document.getElementById('chatBox').appendChild(typingContainer);
        let dots = 1;
        typingInterval = setInterval(() => {
            dots = (dots % 3) + 1;
            messageText.textContent = 'Печатает ' + '.'.repeat(dots);
        }, 500);
    }
    typingContainer.style.opacity = '0.7';
    document.getElementById('chatBox').scrollTop = document.getElementById('chatBox').scrollHeight;
}

function hideTypingIndicator() {
    const typingContainer = document.getElementById('typingIndicator');
    if (typingContainer) {
        typingContainer.style.opacity = '0';
        setTimeout(() => {
            typingContainer.remove();
            clearInterval(typingInterval);
        }, 300);
    }
}

function displayMessage(sender, message, avatar, timestamp, messageId) {
    if (!currentFriend || currentFriend.peerId !== connections[currentFriend.peerId]?.peer) return;
    const chatBox = document.getElementById('chatBox');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    messageContainer.dataset.messageId = messageId;
    
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
    
    if (sender === userName) {
        const statusChecks = document.createElement('span');
        statusChecks.className = 'status-checks';
        statusChecks.textContent = '✓✓';
        messageHeader.appendChild(statusChecks);
    }
    
    messageHeader.appendChild(timestampElement);
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let processedMessage = message.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank">${url}</a>`;
    });
    
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
    const youtubeMatch = message.match(youtubeRegex);
    if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        processedMessage += `<iframe class="youtube-player" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
    }
    
    messageText.innerHTML = processedMessage;
    
    messageContainer.appendChild(messageHeader);
    messageContainer.appendChild(messageText);
    chatBox.appendChild(messageContainer);
    chatBox.scrollTop = chatBox.scrollHeight;

    messageContainer.addEventListener('mouseenter', () => {
        if (currentFriend && connections[currentFriend.peerId] && connections[currentFriend.peerId].open && sender !== userName) {
            const friend = friendsList.find(f => f.peerId === currentFriend.peerId);
            if (friend && friend.messages) {
                const message = friend.messages.find(m => m.messageId === messageId);
                if (message && !message.viewed) {
                    message.viewed = true;
                    localStorage.setItem('friendsList', JSON.stringify(friendsList));
                    connections[currentFriend.peerId].send({ type: 'messageViewed', messageId: messageId });
                    updateUnreadCount();
                    updateFriendsList();
                }
            }
        }
    });
}

function toggleEmojiPicker() {
    let picker = document.getElementById('emojiPicker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'emojiPicker';
        picker.className = 'emoji-picker';
        const categories = [
            { name: 'Смайлы', emojis: ['😊', '😂', '😉', '😎'] },
            { name: 'Животные', emojis: ['🐱', '🐶', '🦁', '🐼'] },
            { name: 'Еда', emojis: ['🍎', '🍕', '🍔', '🍦'] }
        ];
        categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'emoji-category';
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = category.name;
            categoryDiv.appendChild(categoryTitle);
            const emojiList = document.createElement('div');
            emojiList.className = 'emoji-list';
            category.emojis.forEach(emoji => {
                const emojiSpan = document.createElement('span');
                emojiSpan.textContent = emoji;
                emojiSpan.onclick = () => {
                    const messageInput = document.getElementById('messageInput');
                    messageInput.value += emoji;
                    messageInput.focus();
                    if (currentFriend && connections[currentFriend.peerId] && connections[currentFriend.peerId].open) {
                        connections[currentFriend.peerId].send({ type: 'typing', sender: userName, avatar: avatarUrl });
                        clearTimeout(typingTimeout);
                        typingTimeout = setTimeout(() => {
                            connections[currentFriend.peerId].send({ type: 'stopTyping' });
                            clearInterval(typingInterval);
                        }, 2000);
                    }
                };
                emojiList.appendChild(emojiSpan);
            });
            categoryDiv.appendChild(emojiList);
            picker.appendChild(categoryDiv);
        });
        document.querySelector('.chat-input').appendChild(picker);
    }
    picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
}

function hideEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.style.display = 'none';
    }
}

window.addEventListener('load', () => {
    const chatInput = document.querySelector('.chat-input');
    const existingSendBtn = chatInput.querySelector('.send-btn');
    const chatButtons = document.createElement('div');
    chatButtons.className = 'chat-buttons';
    if (existingSendBtn) {
        chatInput.removeChild(existingSendBtn);
        chatButtons.appendChild(existingSendBtn);
    }
    const emojiButton = document.createElement('button');
    emojiButton.className = 'btn emoji-btn';
    emojiButton.textContent = '😊';
    emojiButton.title = 'Выбрать смайлик';
    emojiButton.onclick = toggleEmojiPicker;
    chatButtons.appendChild(emojiButton);
    chatInput.appendChild(chatButtons);
});

document.getElementById('friendLogin').addEventListener('input', (event) => {
    const input = event.target.value.trim();
    const match = input.match(/^@([^:]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    
    if (match) {
        const login = match[1];
        const peerId = match[2];
        event.target.value = `@${login}`;
        event.target.dataset.peerId = peerId;
        let friend = friendsList.find(f => f.peerId === peerId);
        if (!friend) {
            const friendName = login;
            const friendAvatar = '';
            friend = { name: friendName, login: login, peerId: peerId, avatar: friendAvatar, messages: [], online: false };
            friendsList.push(friend);
            localStorage.setItem('friendsList', JSON.stringify(friendsList));
            updateFriendsList();
            connectToFriend(peerId);
        }
        selectFriend(friend);
    } else {
        event.target.dataset.peerId = '';
        document.getElementById('startChatBtn').disabled = true;
        document.getElementById('startChatBtn').textContent = currentFriend ? 'Повторите копирование ID' : 'Начать чат';
        document.getElementById('startChatBtn').classList.toggle('reconnect', !!currentFriend);
        document.getElementById('chatTitle').textContent = 'Начать чат';
        document.getElementById('chatSection').classList.add('chat-inactive');
    }
});

document.getElementById('messageInput').addEventListener('input', () => {
    if (currentFriend && connections[currentFriend.peerId] && connections[currentFriend.peerId].open) {
        connections[currentFriend.peerId].send({ type: 'typing', sender: userName, avatar: avatarUrl });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            connections[currentFriend.peerId].send({ type: 'stopTyping' });
            clearInterval(typingInterval);
        }, 2000);
    }
});

document.getElementById('messageInput').addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
        sendMessage();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'F8') {
        localStorage.clear();
        location.reload();
    }
});

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