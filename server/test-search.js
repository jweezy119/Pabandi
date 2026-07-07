const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/businesses?search=mexican+food');
    console.log(`Found ${res.data.data.businesses.length} businesses.`);
    if (res.data.data.businesses.length > 0) {
      console.log(res.data.data.businesses[0].name);
    }
  } catch (e) {
    console.error(e.message);
  }
}
test();
