require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const { authenticateSocket } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);

// Serve auth page as default
app.get('/', (req, res) => {
    res.redirect('/auth.html');
});

const server = app.listen(PORT, () => console.log(`Server on port ${PORT}`));

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket.IO authentication middleware
io.use(authenticateSocket);

const usersInSolo = {} // Track solo chat rooms
const onlineUsers = new Map() // Track online users
const roomMembers = {} // Track users in each room

// Helper function to create consistent private chat IDs
function createPrivateChatId(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort();
    return `private_${sortedIds[0]}_${sortedIds[1]}`;
}

io.on('connection', async (socket) => {
    console.log(`Authenticated user connected: ${socket.user.username} (${socket.id})`);
    
    // Update user online status
    try {
        await socket.user.updateOne({ 
            isOnline: true, 
            lastSeen: new Date() 
        });
        
        // Add to online users tracking
        onlineUsers.set(socket.user._id.toString(), {
            id: socket.user._id,
            username: socket.user.username,
            profile: socket.user.profile,
            verification: socket.user.verification,
            socketId: socket.id,
            connectedAt: new Date()
        });
        
        // Broadcast updated online users list
        io.emit('online-users', Array.from(onlineUsers.values()));
        
    } catch (error) {
        console.error('Error updating user online status:', error);
    }

    // Handle request for online users
    socket.on('get-online-users', () => {
        socket.emit('online-users', Array.from(onlineUsers.values()));
    });

    // Handle private message initiation
    socket.on('start-private-chats', ({ selectedUserIds }) => {
        console.log(`${socket.user.username} starting private chats with:`, selectedUserIds);
        
        const privateChats = [];
        
        selectedUserIds.forEach(targetUserId => {
            const targetUser = onlineUsers.get(targetUserId);
            if (targetUser) {
                // Create unique chat ID for this pair
                const chatId = createPrivateChatId(socket.user._id.toString(), targetUserId);
                
                // Join both users to the private room
                socket.join(chatId);
                const targetSocket = io.sockets.sockets.get(targetUser.socketId);
                if (targetSocket) {
                    targetSocket.join(chatId);
                }
                
                privateChats.push({
                    chatId,
                    targetUser: {
                        id: targetUser.id,
                        username: targetUser.username,
                        profile: targetUser.profile,
                        verification: targetUser.verification
                    }
                });
                
                console.log(`Created private chat: ${chatId}`);
            }
        });
        
        socket.emit('private-chats-created', { chats: privateChats });
    });

    // Handle private messages
    socket.on('private-message', ({ chatId, message, targetUserId }) => {
        const messageData = {
            chatId,
            message,
            senderName: socket.user.username,
            senderId: socket.user._id,
            senderProfile: socket.user.profile,
            dateTime: new Date()
        };
        
        // Send to the specific chat room
        socket.to(chatId).emit('private-message', messageData);
        console.log(`Private message from ${socket.user.username} in chat ${chatId}`);
    });

    socket.on('join-chat', ({ chatType }) => {
        const name = socket.user.username; // Use authenticated username
        socket.data.name = name;
        socket.data.chatType = chatType;
        socket.data.userId = socket.user._id;

        if (chatType === 'solo') {
            // Find available solo room
            let soloRoom = Object.keys(usersInSolo).find(room => usersInSolo[room].length < 2);

            if (!soloRoom) {
                // Create new room
                soloRoom = `solo-${socket.id}`;
                usersInSolo[soloRoom] = [];
                roomMembers[soloRoom] = [];
            }

            if (usersInSolo[soloRoom].length < 2) {
                socket.join(soloRoom);
                
                const userInfo = {
                    socketId: socket.id,
                    userId: socket.user._id,
                    username: socket.user.username,
                    profile: socket.user.profile,
                    verification: socket.user.verification
                };
                
                usersInSolo[soloRoom].push(userInfo);
                roomMembers[soloRoom].push(userInfo);
                socket.data.room = soloRoom;

                // Notify room members of new user
                socket.to(soloRoom).emit('user-joined', {
                    user: socket.user.getPublicProfile(),
                    message: `${socket.user.username} joined the chat`
                });

                socket.emit('chat-joined', { 
                    room: soloRoom, 
                    type: 'solo',
                    user: socket.user.getPublicProfile(),
                    roomMembers: roomMembers[soloRoom].map(member => ({
                        id: member.userId,
                        username: member.username,
                        profile: member.profile,
                        verification: member.verification
                    }))
                });
                
                console.log(`${name} joined solo room: ${soloRoom}`);
            } else {
                socket.emit('room-full', 'This solo chat is already full.');
            }
        } 
        else if (chatType === 'group') {
            socket.join('group-room');
            socket.data.room = 'group-room';
            
            // Initialize group room members if needed
            if (!roomMembers['group-room']) {
                roomMembers['group-room'] = [];
            }
            
            const userInfo = {
                socketId: socket.id,
                userId: socket.user._id,
                username: socket.user.username,
                profile: socket.user.profile,
                verification: socket.user.verification
            };
            
            roomMembers['group-room'].push(userInfo);
            
            // Notify group of new user
            socket.to('group-room').emit('user-joined', {
                user: socket.user.getPublicProfile(),
                message: `${socket.user.username} joined the group chat`
            });
            
            socket.emit('chat-joined', { 
                room: 'group-room', 
                type: 'group',
                user: socket.user.getPublicProfile(),
                roomMembers: roomMembers['group-room'].map(member => ({
                    id: member.userId,
                    username: member.username,
                    profile: member.profile,
                    verification: member.verification
                }))
            });
            
            console.log(`${name} joined group room`);
        }

        io.emit('clients-total', io.engine.clientsCount);
    });

    socket.on('message', (data) => {
        const room = socket.data.room;
        if (room) {
            const messageData = {
                ...data,
                name: socket.user.username,
                userId: socket.user._id,
                dateTime: new Date()
            };
            socket.to(room).emit('chat-message', messageData);
        }
    });

    socket.on('feedback', (data) => {
        const room = socket.data.room;
        if (room) {
            const feedbackData = {
                ...data,
                feedback: `${socket.user.username} is typing a message`
            };
            socket.to(room).emit('feedback', feedbackData);
        }
    });

    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
        
        try {
            // Update user offline status
            await socket.user.updateOne({ 
                isOnline: false, 
                lastSeen: new Date() 
            });
            
            // Remove from online users tracking
            onlineUsers.delete(socket.user._id.toString());
            
            // Notify room of user leaving
            if (socket.data.room) {
                socket.to(socket.data.room).emit('user-left', {
                    user: socket.user.getPublicProfile(),
                    message: `${socket.user.username} left the chat`
                });
            }
            
            // Remove from solo rooms
            for (const room in usersInSolo) {
                usersInSolo[room] = usersInSolo[room].filter(user => user.socketId !== socket.id);
                if (usersInSolo[room].length === 0) {
                    delete usersInSolo[room]; // delete empty room
                }
            }
            
            // Remove from room members tracking
            for (const room in roomMembers) {
                roomMembers[room] = roomMembers[room].filter(member => member.socketId !== socket.id);
                if (roomMembers[room].length === 0 && room !== 'group-room') {
                    delete roomMembers[room];
                }
            }
            
            // Broadcast updated online users list
            io.emit('online-users', Array.from(onlineUsers.values()));
            
        } catch (error) {
            console.error('Error updating user offline status:', error);
        }
        
        io.emit('clients-total', io.engine.clientsCount);
    });
});

