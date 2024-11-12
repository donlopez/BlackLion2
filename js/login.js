// login.js

export const loginHandler = async (event) => {
    // Parse the body to get the username and password
    const { username, password } = JSON.parse(event.body);
  
    // Here, add your authentication logic.
    // For this example, we’ll assume a successful login if a username and password are provided.
    if (username && password) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Login successful' }),
      };
    }
  
    // Return an error response if credentials are missing or invalid
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Invalid username or password' }),
    };
  };
  