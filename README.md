# Quizz App Server

## Overview
This project is a backend server for the Quizz App, built with Node.js and Express. It provides RESTful APIs for user registration, authentication, and session management using MongoDB.

## Features
- User registration and login
- Session management with cookies
- Role-based access control (Admin)
- Middleware for authentication

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yw07761/Quizz-app-server.git
   cd Quizz-app-server
   ```

2. Install dependencies:
   ```bash
   npm install express mongoose bcrypt cors express-session connect-mongo dotenv
   ```

3. Create a `.env` file and add your MongoDB URI and secret key:
   ```plaintext
   MONGODB_URI=your_mongo_db_uri
   SUPER_SECRET_KEY=your_secret_key
   ```

4. Start the server:
   ```bash
   node server.js
   ```

## API Endpoints
- `POST /sign-up`: Register a new user
- `POST /sign-in`: Authenticate a user
- `POST /logout`: Log out the current user
- `DELETE /user/:id`: Delete a user (admin only)
- `GET /is-authenticated`: Check if the user is authenticated

## Contributing
Contributions are welcome! Please create an issue or submit a pull request.

## License
This project is licensed under the MIT License.
