const d3Geo = require('d3-geo');
const topojson = require('topojson-client');
const world = require('world-atlas/land-110m.json');
const fs = require('fs');

const projection = d3Geo.geoOrthographic()
  .scale(135)
  .translate([150, 150])
  .rotate([-20, -10, 0]) // Adjust rotation to show continents nicely (e.g., Africa/Europe/Americas)
  .clipAngle(90); // Only front side

const path = d3Geo.geoPath().projection(projection);

const landGeo = topojson.feature(world, world.objects.land);

const svgPath = path(landGeo);
fs.writeFileSync('paths.txt', svgPath);
