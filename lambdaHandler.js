// lambdaHandler.js
import { loginHandler } from './js/login.js'; // Adjust the path if necessary

console.log("Starting lambdaHandler.js");  // Debug log

export const handler = async (event) => {
  console.log("Handler invoked with event:", JSON.stringify(event));  // Debug log

  if (event.path === '/login' && event.httpMethod === 'POST') {
    return await loginHandler(event);
  }
  
  return {
    statusCode: 404,
    body: JSON.stringify({ message: 'Not Found' }),
  };
};
