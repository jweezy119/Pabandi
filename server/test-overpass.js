const axios = require('axios');
const q = `[out:json][timeout:10];(node["name"~"pizza",i]["amenity"](23.6,60.8,37.1,77.8););out center 15;`;
axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(q)}`, {
  headers: { 
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)'
  }
}).then(res => console.log(res.data.elements.length)).catch(err => console.error(err.message, err.response?.status));
