const http = require('http');

async function test() {
  try {
    const loginData = JSON.stringify({
      username: "bhuvanesh", // guessing a user or trying local db details
      password: "password"
    });
    // Can't easily login without knowing password. 
    // Let me check if backend_actual.log captured any error when user clicked.
  } catch (e) {
    console.error(e);
  }
}
test();
