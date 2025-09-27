// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!AuthManager.isAuthenticated()) {
        window.location.href = '/auth.html';
        return;
    }
    initializeChat();
});

// Authentication utilities
class AuthManager {
    static getToken() {
        return localStorage.getItem('chatflow_token');
    }

    static getUser() {
        const user = localStorage.getItem('chatflow_user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('chatflow_token');
        localStorage.removeItem('chatflow_user');
        if (socket) socket.disconnect();
        window.location.href = '/auth.html';
    }

    static isAuthenticated() {
        return !!localStorage.getItem('chatflow_token');
    }
}

let socket;

// Landing page elements
const landingPage = document.getElementById('landing-page')
const chatInterface = document.getElementById('chat-interface')
const groupChatBtn = document.getElementById('group-chat-btn')
const privateChatBtn = document.getElementById('private-chat-btn')
const onlineUsersSection = document.getElementById('online-users-section')
const onlineUsersList = document.getElementById('online-users-list')
const loadingUsers = document.getElementById('loading-users')

// Chat elements
let clientsTotal, messageContainer, messageForm, messageInput, messageTone

// Chat management
let chatType = null
let selectedUsers = new Set()
let currentUser = null
let activeChats = new Map() // Store multiple chat conversations
let currentChatId = null
let onlineUsers = []
let privateChatTabs = new Map() // Store private chat tabs data
let chatMessages = new Map() // Store messages for each chat

function initializeChat() {
    currentUser = AuthManager.getUser();
    
    if (!currentUser) {
        window.location.href = '/auth.html';
        return;
    }

    // Initialize socket with authentication
    socket = io({
        auth: {
            token: AuthManager.getToken()
        }
    });

    setupSocketListeners();
    setupEventListeners();
    
    // Display user info
    displayUserInfo();
    
    // Ensure message form is visible on mobile
    setTimeout(() => {
        ensureMessageFormVisible();
    }, 500);
    
    // Set up periodic visibility checks
    setInterval(ensureMessageFormVisible, 3000);
    
    // Handle screen orientation changes
    window.addEventListener('resize', () => {
        setTimeout(ensureMessageFormVisible, 300);
    });
    
    window.addEventListener('orientationchange', () => {
        setTimeout(ensureMessageFormVisible, 500);
    });
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server as:', currentUser.username);
        // Request initial online users list
        socket.emit('get-online-users');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        if (error.message.includes('Authentication error')) {
            AuthManager.logout();
        }
    });

    socket.on('clients-total', (data) => {
        if (clientsTotal) {
            clientsTotal.innerText = `Total users: ${data}`;
        }
    });

    socket.on('chat-message', (data) => {
        console.log(data);
        if (messageTone) messageTone.play();
        
        // Route message to correct chat
        if (data.chatId) {
            addMessageToChat(data.chatId, false, data);
        } else {
            addMessageToUI(false, data);
        }
    });

    socket.on('private-message', (data) => {
        console.log('Private message:', data);
        if (messageTone) messageTone.play();
        addMessageToChat(data.chatId, false, data);
        
        // Show notification if chat is not active
        if (currentChatId !== data.chatId) {
            showChatNotification(data.chatId, data.senderName);
        }
    });

    socket.on('chat-joined', (data) => {
        console.log('Joined chat:', data);
        if (data.roomMembers) {
            updateRoomMembers(data.roomMembers);
        }
    });

    socket.on('online-users', (users) => {
        onlineUsers = users.filter(user => user.id !== currentUser.id);
        updateOnlineUsersDisplay();
        updateOnlineUsers(users);
    });

    socket.on('user-joined', (data) => {
        addSystemMessage(data.message, 'join');
        console.log('User joined:', data.user);
    });

    socket.on('user-left', (data) => {
        addSystemMessage(data.message, 'leave');
        console.log('User left:', data.user);
    });

    socket.on('room-full', (message) => {
        alert(message);
        // Reset chat type selection
        chatType = null;
        groupChatBtn.classList.remove('selected');
        privateChatBtn.classList.remove('selected');
    });

    socket.on('feedback', (data) => {
        clearFeedback();
        const element = `<li class="message-feedback">
                    <p class="feedback" id="feedback">
                        ${data.feedback}
                    </p>
                </li>`;
        if (messageContainer) messageContainer.innerHTML += element;
    });

    socket.on('private-chats-created', (data) => {
        console.log('Private chats created:', data.chats);
        
        // Clear existing private chats
        privateChatTabs.clear();
        chatMessages.clear();
        
        // Add each private chat to the tabs
        data.chats.forEach(chat => {
            console.log('Adding chat to tabs:', chat);
            privateChatTabs.set(chat.chatId, {
                username: chat.targetUser.username,
                avatar: chat.targetUser.profile?.avatar || `https://ui-avatars.com/api/?name=${chat.targetUser.username}&background=667eea&color=fff&size=35`,
                verification: chat.targetUser.verification?.verificationBadge,
                userId: chat.targetUser.id
            });
        });
        
        console.log('Private chat tabs populated:', privateChatTabs);
        
        // Now initialize the private chat interface
        console.log('Initializing private chat interface...');
        initializePrivateChatInterface();
    });
}

function loadOnlineUsers() {
    loadingUsers.style.display = 'block';
    onlineUsersList.innerHTML = '';
    socket.emit('get-online-users');
}

function updateOnlineUsersDisplay() {
    loadingUsers.style.display = 'none';
    
    if (onlineUsers.length === 0) {
        onlineUsersList.innerHTML = '<p class="no-users">No other users are currently online</p>';
        return;
    }

    onlineUsersList.innerHTML = onlineUsers.map(user => `
        <div class="online-user-item" data-user-id="${user.id}" onclick="toggleUserSelection('${user.id}')">
            <img src="${user.profile?.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=667eea&color=fff&size=35`}" 
                 alt="${user.username}" class="online-user-avatar">
            <div class="online-user-info">
                <span class="online-user-name">${user.username}</span>
                ${getVerificationBadge(user.verification?.verificationBadge)}
                <div class="online-user-status">Online</div>
            </div>
            <input type="checkbox" class="online-user-checkbox" id="user-${user.id}">
        </div>
    `).join('');
}

function toggleUserSelection(userId) {
    const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    const checkbox = document.getElementById(`user-${userId}`);
    
    if (selectedUsers.has(userId)) {
        selectedUsers.delete(userId);
        userElement.classList.remove('selected');
        checkbox.checked = false;
    } else {
        selectedUsers.add(userId);
        userElement.classList.add('selected');
        checkbox.checked = true;
    }
}

function getVerificationBadge(badgeType) {
    const badges = {
        'verified': '<i class="fas fa-check-circle verification-badge verified" title="Verified User"></i>',
        'premium': '<i class="fas fa-star verification-badge premium" title="Premium User"></i>',
        'admin': '<i class="fas fa-shield-alt verification-badge admin" title="Administrator"></i>',
        'none': ''
    };
    return badges[badgeType] || '';
}

function updateRoomMembers(members) {
    const roomMembersContainer = document.getElementById('room-members');
    if (!roomMembersContainer) return;

    roomMembersContainer.innerHTML = members.map(member => `
        <div class="member-item">
            <img src="${member.profile?.avatar || `https://ui-avatars.com/api/?name=${member.username}&background=667eea&color=fff&size=30`}" 
                 alt="${member.username}" class="member-avatar">
            <div class="member-info">
                <span class="member-name">${member.username}</span>
                ${getVerificationBadge(member.verification?.verificationBadge)}
                <div class="member-status online">Online</div>
            </div>
        </div>
    `).join('');
}

function updateOnlineUsers(users) {
    const onlineUsersContainer = document.getElementById('online-users');
    if (!onlineUsersContainer) return;

    onlineUsersContainer.innerHTML = users.map(user => `
        <div class="user-item">
            <img src="${user.profile?.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=667eea&color=fff&size=30`}" 
                 alt="${user.username}" class="user-avatar">
            <div class="user-info">
                <span class="user-name">${user.username}</span>
                ${getVerificationBadge(user.verification?.verificationBadge)}
                <div class="user-status online">Online</div>
            </div>
        </div>
    `).join('');
}

function addSystemMessage(message, type) {
    if (!messageContainer) return;
    
    const element = `<li class="system-message ${type}">
        <p class="system-text">
            <i class="fas fa-info-circle"></i>
            ${message}
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        </p>
    </li>`;
    
    messageContainer.innerHTML += element;
    scrollToBottom();
}

function displayUserInfo() {
    // Add user info to the landing page
    const subtitle = document.querySelector('.app-subtitle');
    if (subtitle) {
        subtitle.textContent = `Welcome back, ${currentUser.username}!`;
    }
}

function setupEventListeners() {
    // Chat type selection handlers
    if (groupChatBtn) {
        groupChatBtn.addEventListener('click', () => {
            chatType = 'group';
            groupChatBtn.classList.add('selected');
            privateChatBtn.classList.remove('selected');
            onlineUsersSection.classList.add('hidden');
            selectedUsers.clear();
        });
    }

    if (privateChatBtn) {
        privateChatBtn.addEventListener('click', () => {
            chatType = 'private';
            privateChatBtn.classList.add('selected');
            groupChatBtn.classList.remove('selected');
            onlineUsersSection.classList.remove('hidden');
            loadOnlineUsers();
        });
    }

    // Join button
    const joinButton = document.getElementById('join-button');
    if (joinButton) {
        joinButton.addEventListener('click', startChatting);
    }

    // Add logout button to the page
    addLogoutButton();
}

function addLogoutButton() {
    const landingCard = document.querySelector('.landing-card');
    if (landingCard && !document.getElementById('logout-button')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-button';
        logoutBtn.className = 'logout-button';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.addEventListener('click', AuthManager.logout);
        
        // Insert at the top of the card
        landingCard.insertBefore(logoutBtn, landingCard.firstChild);
    }
}

function startChatting() {
    if (!chatType) {
        alert('Please select Group Chat or Private Messages');
        return;
    }

    if (chatType === 'private' && selectedUsers.size === 0) {
        alert('Please select at least one user to chat with');
        return;
    }

    // Hide landing page and show chat interface
    landingPage.style.display = 'none';
    chatInterface.style.display = 'block';

    if (chatType === 'group') {
        // Handle group chat
        socket.emit('join-chat', { chatType: 'group' });
        initializeGroupChatInterface();
    } else if (chatType === 'private') {
        // Handle private chats
        const selectedUserIds = Array.from(selectedUsers);
        console.log('Starting private chats with users:', selectedUserIds);
        socket.emit('start-private-chats', { selectedUserIds });
        // Don't initialize interface here - wait for private-chats-created event
    }
}

// Initialize group chat interface
function initializeGroupChatInterface() {
    // Create chat interface HTML
    chatInterface.innerHTML = `
        <div class="chat-header">
            <div class="user-info">
                <img src="${currentUser.profile?.avatar || `https://ui-avatars.com/api/?name=${currentUser.username}&background=667eea&color=fff&size=40`}" 
                     alt="${currentUser.username}" class="user-avatar">
                <div class="user-details">
                    <span class="username">${currentUser.username}</span>
                    ${getVerificationBadge(currentUser.verification?.verificationBadge)}
                </div>
            </div>
            <h2>Group Chat</h2>
            <button class="logout-chat-btn" onclick="AuthManager.logout()">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        </div>

        <div class="chat-body">
            <div class="chat-sidebar">
                <div class="sidebar-section">
                    <h4>Room Members</h4>
                    <div id="room-members" class="members-list">
                        <!-- Room members will appear here -->
                    </div>
                </div>
                
                <div class="sidebar-section">
                    <h4>Online Users</h4>
                    <div id="online-users" class="users-list">
                        <!-- Online users will appear here -->
                    </div>
                </div>
            </div>
            
            <div class="chat-main">
                <ul class="message-container" id="message-container">
                    <!-- Messages will appear here -->
                </ul>

                <form action="#" class="message-form" id="message-form">
                    <input type="text" name="message" id="message-input" class="message-input" placeholder="Type a message...">
                    <div class="v-divider"></div>
                    <button type="submit" class="send-button">send
                        <span><i class="fas fa-paper-plane"></i></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="chat-footer">
            <span class="clients-total" id="clients-total">Total users: 1</span>
        </div>
    `;
    
    // Get references to chat elements
    clientsTotal = document.getElementById('clients-total');
    messageContainer = document.getElementById('message-container');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    messageTone = new Audio('/ding.mp3');
    
    // Add chat event listeners
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Add typing feedback listeners
    messageInput.addEventListener('focus', () => {
        socket.emit('feedback', {
            feedback: `${currentUser.username} is typing a message`
        });
    });

    messageInput.addEventListener('keypress', () => {
        socket.emit('feedback', {
            feedback: `${currentUser.username} is typing a message`
        });
    });

    messageInput.addEventListener('blur', () => {
        socket.emit('feedback', {
            feedback: ''
        });
    });
    
    // Focus on message input
    messageInput.focus();
}

// Initialize private chat interface
function initializePrivateChatInterface() {
    // Create private chat interface HTML
    chatInterface.innerHTML = `
        <div class="chat-header">
            <div class="user-info">
                <img src="${currentUser.profile?.avatar || `https://ui-avatars.com/api/?name=${currentUser.username}&background=667eea&color=fff&size=40`}" 
                     alt="${currentUser.username}" class="user-avatar">
                <div class="user-details">
                    <span class="username">${currentUser.username}</span>
                    ${getVerificationBadge(currentUser.verification?.verificationBadge)}
                </div>
            </div>
            <h2>Private Messages</h2>
            <button class="logout-chat-btn" onclick="AuthManager.logout()">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        </div>

        <div class="chat-body">
            <div class="private-chat-sidebar">
                <div class="sidebar-header">
                    <h4>Active Chats</h4>
                </div>
                <div class="private-chat-list" id="private-chat-list">
                    <!-- Private chat items will appear here -->
                </div>
                <div class="sidebar-footer">
                    <button class="new-chat-btn" onclick="startNewPrivateChat()">
                        <i class="fas fa-plus"></i>
                        New Chat
                    </button>
                </div>
            </div>
            
            <div class="chat-main">
                <div class="current-chat-header" id="current-chat-header">
                    <div class="no-chat-selected">
                        <i class="fas fa-comments"></i>
                        <p>Select a chat to start messaging</p>
                    </div>
                </div>
                
                <ul class="message-container" id="message-container">
                    <!-- Messages will appear here -->
                </ul>

                <form action="#" class="message-form" id="message-form">
                    <input type="text" name="message" id="message-input" class="message-input" placeholder="Type a message...">
                    <div class="v-divider"></div>
                    <button type="submit" class="send-button">send
                        <span><i class="fas fa-paper-plane"></i></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="chat-footer">
            <span class="clients-total" id="clients-total">Total users: 1</span>
        </div>
    `;
    
    // Get references to chat elements
    clientsTotal = document.getElementById('clients-total');
    messageContainer = document.getElementById('message-container');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    messageTone = new Audio('/ding.mp3');
    
    // Add chat event listeners
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendPrivateMessage();
    });
    
    // Force message form visibility
    ensureMessageFormVisible();
    
    // Create private chat list items for each private chat
    createPrivateChatList();
    
    // Initialize first chat if available
    if (privateChatTabs.size > 0) {
        const firstChatId = privateChatTabs.keys().next().value;
        switchToChat(firstChatId);
    }
}

// Create private chat list for sidebar
function createPrivateChatList() {
    console.log('createPrivateChatList called');
    const chatListContainer = document.getElementById('private-chat-list');
    console.log('Chat list container:', chatListContainer);
    
    if (!chatListContainer) {
        console.error('Private chat list container not found!');
        return;
    }
    
    // Clear existing chat list
    chatListContainer.innerHTML = '';
    
    console.log('Creating chat list items for', privateChatTabs.size, 'chats');
    
    // Create list items for each private chat
    privateChatTabs.forEach((chatData, chatId) => {
        console.log('Creating chat item for:', chatId, chatData);
        const chatItem = document.createElement('div');
        chatItem.className = `private-chat-item ${chatId === currentChatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chatId;
        chatItem.innerHTML = `
            <div class="chat-avatar-container">
                <img src="${chatData.avatar}" alt="${chatData.username}" class="private-chat-avatar">
                <span class="online-indicator"></span>
            </div>
            <div class="chat-info">
                <div class="chat-name">${chatData.username}</div>
                <div class="chat-status">Online</div>
            </div>
            <button class="close-chat" onclick="closeChat('${chatId}')" title="Close Chat">
                <i class="fas fa-times"></i>
            </button>
        `;
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.close-chat')) {
                switchToChat(chatId);
            }
        });
        chatListContainer.appendChild(chatItem);
        console.log('Chat item added to container');
    });
    
    console.log('Final chat list container HTML:', chatListContainer.innerHTML);
}

// Switch to a specific chat
function switchToChat(chatId) {
    console.log('switchToChat called with chatId:', chatId);
    currentChatId = chatId;
    const chatData = privateChatTabs.get(chatId);
    
    console.log('Chat data for switching:', chatData);
    
    if (!chatData) {
        console.error('Chat data not found for chatId:', chatId);
        return;
    }
    
    // Update active chat item in sidebar
    document.querySelectorAll('.private-chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
    
    // Update chat header
    const chatHeader = document.getElementById('current-chat-header');
    console.log('Chat header element:', chatHeader);
    
    if (chatHeader) {
        chatHeader.innerHTML = `
            <div class="chat-user-info">
                <img src="${chatData.avatar}" alt="${chatData.username}" class="chat-user-avatar">
                <div class="chat-user-details">
                    <span class="chat-username">${chatData.username}</span>
                    ${getVerificationBadge(chatData.verification)}
                    <span class="online-status">Online</span>
                </div>
            </div>
        `;
        console.log('Chat header updated');
    } else {
        console.error('Chat header element not found!');
    }
    
    // Load messages for this chat
    loadChatMessages(chatId);
    console.log('Chat switched successfully to:', chatId);
}

// Ensure message form is always visible
function ensureMessageFormVisible() {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.querySelector('.send-button');
    
    if (messageForm) {
        // Force styles
        messageForm.style.display = 'flex';
        messageForm.style.position = 'fixed';
        messageForm.style.bottom = '0px';
        messageForm.style.left = '0px';
        messageForm.style.right = '0px';
        messageForm.style.width = '100%';
        messageForm.style.zIndex = '99999';
        messageForm.style.background = 'white';
        messageForm.style.padding = '12px 16px';
        messageForm.style.borderTop = '2px solid #e2e8f0';
        messageForm.style.boxShadow = '0 -2px 10px rgba(0, 0, 0, 0.1)';
        messageForm.style.visibility = 'visible';
        messageForm.style.opacity = '1';
        messageForm.style.gap = '10px';
        messageForm.style.alignItems = 'center';
        messageForm.style.boxSizing = 'border-box';
    }
    
    if (messageInput) {
        messageInput.style.display = 'block';
        messageInput.style.flex = '1';
        messageInput.style.height = '44px';
        messageInput.style.padding = '0 14px';
        messageInput.style.border = '2px solid #e2e8f0';
        messageInput.style.borderRadius = '25px';
        messageInput.style.background = '#f7fafc';
        messageInput.style.fontSize = '16px';
        messageInput.style.visibility = 'visible';
        messageInput.style.opacity = '1';
        messageInput.style.outline = 'none';
    }
    
    if (sendButton) {
        sendButton.style.display = 'flex';
        sendButton.style.width = '44px';
        sendButton.style.height = '44px';
        sendButton.style.borderRadius = '50%';
        sendButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        sendButton.style.color = 'white';
        sendButton.style.border = 'none';
        sendButton.style.alignItems = 'center';
        sendButton.style.justifyContent = 'center';
        sendButton.style.cursor = 'pointer';
        sendButton.style.visibility = 'visible';
        sendButton.style.opacity = '1';
        sendButton.style.flexShrink = '0';
        sendButton.style.fontSize = '16px';
        sendButton.style.textAlign = 'center';
        sendButton.style.lineHeight = '1';
        sendButton.style.position = 'relative';
        
        // Ensure only icon is shown, remove any text
        const iconSpan = sendButton.querySelector('span i');
        if (iconSpan) {
            sendButton.innerHTML = '<span style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;"><i class="fas fa-paper-plane" style="font-size: 16px; line-height: 1;"></i></span>';
        }
    }
    
    // Hide v-divider
    const vDivider = document.querySelector('.v-divider');
    if (vDivider) {
        vDivider.style.display = 'none';
    }
}

// Start a new private chat
function startNewPrivateChat() {
    // Show the user selection interface again
    document.getElementById('landing-page').style.display = 'flex';
    document.getElementById('chat-interface').style.display = 'none';
    
    // Reset chat type to private messages
    document.getElementById('private-chat-btn').click();
    
    // Show online users section
    document.getElementById('online-users-section').classList.remove('hidden');
}

// Load messages for a specific chat
function loadChatMessages(chatId) {
    if (!messageContainer) return;
    
    messageContainer.innerHTML = '';
    
    const messages = chatMessages.get(chatId) || [];
    messages.forEach(message => {
        addMessageToUI(message.mine, message);
    });
    
    // Scroll to bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Close a chat
function closeChat(chatId) {
    privateChatTabs.delete(chatId);
    chatMessages.delete(chatId);
    
    // If this was the active chat, switch to another one
    if (currentChatId === chatId) {
        const remainingChats = Array.from(privateChatTabs.keys());
        if (remainingChats.length > 0) {
            switchToChat(remainingChats[0]);
        } else {
            // No more chats, reset everything and go back to landing page
            currentChatId = null;
            
            // Reset chat type selection
            chatType = null;
            if (groupChatBtn) groupChatBtn.classList.remove('selected');
            if (privateChatBtn) privateChatBtn.classList.remove('selected');
            
            // Clear selected users
            selectedUsers.clear();
            document.querySelectorAll('.online-user-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Hide online users section
            if (onlineUsersSection) {
                onlineUsersSection.classList.add('hidden');
            }
            
            // Smoothly transition back to landing page
            chatInterface.style.display = 'none';
            landingPage.style.display = 'flex'; // Use flex to maintain centering
            
            // Ensure body maintains proper layout
            document.body.style.display = 'flex';
            document.body.style.justifyContent = 'center';
            document.body.style.alignItems = 'center';
            
            return; // Don't recreate tabs since we're going back to landing page
        }
    }
    
    // Recreate chat list only if staying in chat interface
    createPrivateChatList();
}

// Send private message
function sendPrivateMessage() {
    if (!messageInput.value.trim() || !currentChatId) return;
    
    const chatData = privateChatTabs.get(currentChatId);
    if (!chatData) {
        console.error('Chat data not found for chatId:', currentChatId);
        return;
    }
    
    const messageData = {
        message: messageInput.value.trim(),
        chatId: currentChatId,
        targetUserId: chatData.userId // This is needed by the backend
    };
    
    console.log('Sending private message:', messageData);
    socket.emit('private-message', messageData);
    
    // Add message to local chat immediately with display data
    const displayData = {
        message: messageInput.value.trim(),
        senderName: currentUser.username,
        senderId: currentUser.id,
        dateTime: new Date(),
        chatId: currentChatId
    };
    
    addMessageToChat(currentChatId, true, displayData);
    
    messageInput.value = '';
}

// Add message to specific chat
function addMessageToChat(chatId, mine, data) {
    console.log('Adding message to chat:', chatId, 'mine:', mine, 'data:', data);
    console.log('Current chat ID:', currentChatId);
    
    // Store message in chat history
    if (!chatMessages.has(chatId)) {
        chatMessages.set(chatId, []);
    }
    chatMessages.get(chatId).push({
        ...data,
        mine: mine
    });
    
    // If this is the active chat, display the message
    if (currentChatId === chatId) {
        console.log('Displaying message in active chat');
        addMessageToUI(mine, data);
    } else {
        console.log('Message not displayed - not active chat');
    }
}

// Show notification for inactive chat
function showChatNotification(chatId, senderName) {
    const tab = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (tab && !tab.classList.contains('active')) {
        tab.classList.add('has-notification');
        
        // Remove notification when chat is opened
        const removeNotification = () => {
            tab.classList.remove('has-notification');
        };
        
        tab.addEventListener('click', removeNotification, { once: true });
    }
}

socket.on('clients-total', (data) => {
    if (clientsTotal) {
        clientsTotal.innerText = `Total users: ${data}`
    }
})


function sendMessage() {
    if (messageInput.value === '') return;
    
    const data = {
        message: messageInput.value,
        // name and dateTime will be added by server
    };
    
    socket.emit('message', data);
    
    // Add to UI as own message
    const displayData = {
        message: messageInput.value,
        name: currentUser.username,
        dateTime: new Date()
    };
    
    addMessageToUI(true, displayData);
    messageInput.value = '';
}

function addMessageToUI(isOwnMessage, data) {
    console.log('addMessageToUI called:', isOwnMessage, data);
    console.log('messageContainer:', messageContainer);
    
    if (!messageContainer) {
        console.error('Message container not found!');
        return;
    }
    
    clearFeedback();
    
    const timestamp = data.dateTime ? new Date(data.dateTime).toLocaleString() : new Date().toLocaleString();
    const displayName = data.senderName || data.name;
    const senderName = isOwnMessage ? "You" : displayName;
    const userAvatar = isOwnMessage 
        ? (currentUser.profile?.avatar || `https://ui-avatars.com/api/?name=${currentUser.username}&background=667eea&color=fff&size=35`)
        : `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff&size=35`;
    
    const element = `<li class="${isOwnMessage ? "message-right" : "message-left"}">
            <div class="message-content">
                <div class="message-header">
                    <img src="${userAvatar}" alt="${senderName}" class="message-avatar">
                    <div class="message-sender">
                        <span class="sender-name">${senderName}</span>
                        ${isOwnMessage ? '' : getVerificationBadge('none')}
                    </div>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${data.message}</div>
            </div>
        </li>`;

    messageContainer.innerHTML += element;
    scrollToBottom();
}

function scrollToBottom() {
    messageContainer.scrollTo(0, messageContainer.scrollHeight);
}

function clearFeedback() {
    document.querySelectorAll('li.message-feedback').forEach(element => {
        element.parentNode.removeChild(element);
    });
}