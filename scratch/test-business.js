const API_URL = 'http://localhost:5000/api/v1';

async function runTest() {
  const email = `testbizowner_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log('1. Registering Business Owner:', email);
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      role: 'BUSINESS_OWNER',
      firstName: 'Test',
      lastName: 'Owner',
      phone: '+1234567890'
    })
  });
  
  if (!regRes.ok) {
    console.error('Registration failed:', await regRes.text());
    return;
  }
  const regData = await regRes.json();
  const token = regData.token || regData.data?.token;
  console.log('Registered successfully! Token received.');

  console.log('2. Creating Business Profile...');
  const bizRes = await fetch(`${API_URL}/businesses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Neon Lounge & Spa',
      category: 'SALON',
      description: 'A premium neony grayish spa experience.',
      address: '123 Cyber Ave',
      city: 'New York',
      country: 'USA',
      depositRequired: true,
      depositAmount: 50
    })
  });

  if (!bizRes.ok) {
    console.error('Business creation failed:', await bizRes.text());
    return;
  }
  
  const bizData = await bizRes.json();
  console.log('Business Created Successfully!');
  console.log(JSON.stringify(bizData, null, 2));
}

runTest();
