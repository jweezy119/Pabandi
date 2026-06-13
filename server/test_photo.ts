import axios from 'axios';
async function run() {
  try {
    const res = await axios.get(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=AWU5eFi3ZpWc2m5bF-Z5V8bE7QzH6bQeYg9n1wPq_Vv&key=AIzaSyDdhY1G-Y9XBHBSBzur8Ci2Tz_I9oUCEW0`);
    console.log("Final URL:", res.request.res.responseUrl);
  } catch (err) {
    console.error(err);
  }
}
run();
