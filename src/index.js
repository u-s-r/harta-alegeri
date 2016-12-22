import * as d3 from 'd3';
import { Promise } from 'es6-promise';
import voronoi from './app/voronoi';

L.mapbox.accessToken = process.env['MAPBOX_ACCESS_TOKEN'];

var map = L.mapbox.map('map', 'zetter.i73ka9hn')
    .setView([46.88647742351024, 23.461303710937504], 10);

voronoi(map, process.env['CSV_PATH']);
