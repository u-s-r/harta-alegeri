import * as d3 from 'd3';
import { Promise } from 'es6-promise';
import voronoi from './app/voronoi';

L.mapbox.accessToken = process.env['MAPBOX_ACCESS_TOKEN'];

var map = L.mapbox.map('map', 'zetter.i73ka9hn')
    .setView([45.9432, 24.9668], 8);

voronoi(map, process.env['CSV_PATH']);
