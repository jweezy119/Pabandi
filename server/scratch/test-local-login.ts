async function testLogin() {
  const url = 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1/auth/login';
  const body = JSON.stringify({
    email: 's.hussain119@gmail.com',
    password: 'password123'
  });
  
  console.log('Sending login request to production server...');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });
    
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching:', error);
  }
}

testLogin();
