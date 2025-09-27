# ChatFlow - Real-Time Chat Application with Authentication

A modern real-time chat application built with Node.js, Express, Socket.IO, and MongoDB featuring user authentication, solo chat rooms, and group chat functionality.

## Features

### 🔐 **Authentication System**
- User registration with email and username
- Secure password hashing using bcrypt
- JWT token-based authentication
- Automatic token verification
- Protected chat routes

### 💬 **Chat Features**
- **Solo Chat**: Private 1-on-1 conversations (max 2 users per room)
- **Group Chat**: Public group discussions (unlimited users)
- Real-time messaging with Socket.IO
- Typing indicators
- User presence tracking
- Message history

### 🎨 **Modern UI**
- Beautiful gradient backgrounds
- Responsive design
- Clean authentication forms
- Intuitive chat interface

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, bcrypt
- **Real-time**: Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ChatFlow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup MongoDB**
   - Install MongoDB locally OR use MongoDB Atlas (cloud)
   - Create a database named `chatflow`

4. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/chatflow
   
   # JWT Configuration  
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   
   # Server Configuration
   PORT=4000
   NODE_ENV=development
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to:
   - **Authentication**: `http://localhost:4000/auth.html`
   - **Chat Interface**: `http://localhost:4000/index.html` (requires authentication)

## Usage Guide

### Getting Started
1. **Register**: Create a new account at `/auth.html`
2. **Login**: Use your credentials to access the chat
3. **Choose Chat Type**: Select either Solo Chat or Group Chat
4. **Start Chatting**: Send and receive messages in real-time

### Chat Types
- **Solo Chat**: Automatically pairs you with one other user
- **Group Chat**: Join a shared room with multiple users

### API Endpoints

#### Authentication Routes
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Verify JWT token

#### Request/Response Examples

**Signup Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Login Request:**
```json
{
  "identifier": "john_doe", // username or email
  "password": "password123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

## Socket.IO Events

### Client → Server
- `join-chat`: Join a chat room with specified type
- `message`: Send a chat message
- `feedback`: Send typing indicator

### Server → Client
- `chat-joined`: Confirmation of successful room join
- `chat-message`: Receive chat message
- `clients-total`: Update total connected users
- `feedback`: Typing indicator from other users
- `room-full`: Solo chat room is full

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure authentication tokens
- **Input Validation**: Server-side validation for all inputs
- **Socket Authentication**: JWT verification for Socket.IO connections
- **XSS Protection**: Safe HTML rendering

## File Structure

```
ChatFlow/
├── app.js                 # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── config/
│   └── database.js        # Database connection
├── models/
│   └── User.js           # User schema and methods
├── routes/
│   └── auth.js           # Authentication routes
├── middleware/
│   └── auth.js           # JWT middleware
└── public/
    ├── index.html        # Main chat interface
    ├── auth.html         # Authentication page
    ├── main.js           # Chat functionality
    ├── auth.js           # Authentication logic
    ├── style.css         # Chat styling
    └── auth-style.css    # Authentication styling
```

## Development

### Running in Development Mode
```bash
# Install nodemon for auto-restart
npm install -g nodemon

# Start with nodemon
nodemon app.js
```

### Environment Variables
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time
- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment (development/production)

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Authentication Issues**
   - Clear browser localStorage
   - Check JWT_SECRET in environment
   - Verify token expiration

3. **Socket Connection Failed**
   - Check CORS configuration
   - Verify JWT token is being sent
   - Check network/firewall settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please open an issue on the GitHub repository.