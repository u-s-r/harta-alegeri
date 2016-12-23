import * as d3 from 'd3';
import { Promise } from 'es6-promise';
import voronoi from './app/voronoi';
import Clipboard from 'clipboard';

L.mapbox.accessToken = process.env['MAPBOX_ACCESS_TOKEN'];

var map = L.mapbox.map('map', 'zetter.i73ka9hn')
.setView([45.9432, 24.9668], 8);

voronoi(map, process.env['CSV_PATH']);


const copyButton = new Clipboard('.copy-link');
copyButton.on('success', function(e) {
    const $button = $(e.trigger);

    $button
    .attr('data-balloon', 'Copiat!')
    .attr('data-balloon-pos', 'down')
    .attr('data-balloon-visible', true);
    setTimeout(function () {
        $button
        .removeAttr('data-balloon-visible')
        .removeAttr('data-balloon-pos')
        .removeAttr('data-balloon');
    }, 1500);
    e.clearSelection();
});
