import d3 from 'd3';
import { maxBy, find } from 'lodash';

import { getWinnerColor, getCoord, counties, sum, getPointsByCity } from './helpers';
import * as Boxes from './boxes';
import * as Loader from './loader';
import {filter, reduce} from 'lodash';

// Clears the overlay that contains the Voronoi map
const clearVoronoiOverlay = () => {
  d3.select('#overlay').remove();
}

// Draws a Voronoi map
const drawVoronoiOverlay = (map, points, pointsAtCoord, visibleCities) => {
  clearVoronoiOverlay();

  let bounds = map.getBounds(),
    topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
    bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
    existing = d3.set(),
    // Expands drawing bounds
    drawLimits = bounds.pad(0.4);

  // Filter the points to remove duplicates and points that are out of bounds
  let filteredPoints = points.map((point) => {
    var latlng = new L.LatLng(point.lat, point.lng);
    if (
      !drawLimits.contains(latlng)
      || !visibleCities.includes(point.city)
    ) { return false };
    const layerPoint = map.latLngToLayerPoint(latlng);

    // Eliminates duplicate points
    const key = layerPoint.toString();
    if (existing.has(key)) { return false };
    existing.add(key);

    return {
      ...point,
      x: layerPoint.x,
      y: layerPoint.y
    };
  }).filter(point => point);

  // Transform the points into polygons that can be rendered
  const voronoi = d3.geom.voronoi().x(d => d.x).y(d => d.y);
  var polygons = voronoi(filteredPoints);
  polygons.forEach(d => { d.cell = d; });

  var svg = d3.select(map.getPanes().overlayPane).append("svg")
    .attr('id', 'overlay')
    .attr("class", "leaflet-zoom-hide")
    .style("width", map.getSize().x + 'px')
    .style("height", map.getSize().y + 'px')
    .style("margin-left", topLeft.x + "px")
    .style("margin-top", topLeft.y + "px");

  var g = svg.append("g")
    .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

  // Create the base selection
  var svgPoints = g.attr("class", "points")
    .selectAll("g")
      .data(polygons)
    .enter().append("g")
      .attr("class", "point");

  // Append the voronoi cells
  let lastSelectedPoint;
  svgPoints.append("path")
    .attr("class", "point-cell")
    .attr("d", (d) => ("M" + d.cell.join("L") + "Z"))
    .attr("id", (d, i) => `cell-${i}`)
    .on('click', function (polygon, e) {
      d3.selectAll('.selected').classed('selected', false);

      let cell = d3.select(this),
          data = cell.datum();

      if (lastSelectedPoint == data) {
        lastSelectedPoint = null;
        Boxes.clearDetails();
        return;
      }

      lastSelectedPoint = data;
      cell.classed('selected', true);

      d3.select(this.parentNode).select('circle').classed('selected', true);

      Boxes.drawDetails(pointsAtCoord.get(getCoord(data.point)));
    });
    //.classed("selected", function(d) { return lastSelectedPoint == d} );

  // Append a clipPath for circles that are the edges of the polygon
  // svgPoints.append("clipPath")
  //  .attr("id", (d, i) => `clip-${i}`)
  //  .append("use")
  //    .attr("xlink:href", (d, i) => `#cell-${i}`)

  // Append the circles
  svgPoints.append('circle')
    // .attr("clip-path", (d, i) => `url(#clip-${i})`)
    .attr('cx', d => d.point.x)
    .attr('cy', d => d.point.y)
    .style('fill', d => {
      return getWinnerColor(pointsAtCoord.get(getCoord(d.point)));
    })
    .style('stroke', d => getWinnerColor(pointsAtCoord.get(getCoord(d.point))))
    .attr("r", d => {
      //console.log()
      const numberOfBooths = pointsAtCoord.get(getCoord(d.point)).length;
      const mapZoom = map.getZoom();
      let radius = (3/8)*mapZoom + numberOfBooths;//numberOfBooths + 1 //+ (20 + Math.max(map.getZoom(), 0)) / 10;
      //console.log(mapZoom);
      return radius;
    })
}

// In prima faza dupa numarul de sectii, apoi dupa numarul de voturi
// Marimea la bile zoom out si in sa fie ok
// Harta culorilor partidelor
// Update UI
export default function (map, url) {
  let pointsAtCoord = d3.map(),
    points = [],
    $countiesSelect = $('.counties'),
    $reloadButton = $('#reload'),
    $citiesSelect = $('.cities');

  const drawWithLoader = (points, pointsAtCoord, visibleCities) => {
    Loader.show();
    setTimeout(() => {
      drawVoronoiOverlay(map, points, pointsAtCoord, visibleCities);
      Loader.hide();
    }, 0);
  }

  map.on('ready', () => {
    const getCityJson = (url, county, callback) => {
      d3.json(url + '?nocache=' + (new Date()).getTime(), (response) => {
        let cities = [];
        let points = filter(response, o => (o.id != 'total'));

        // Reset pointsAtCoord on each new json load
        // so that old points don't add up with the response
        pointsAtCoord = d3.map();

    // Get the IDs for each location
    points = points.map((point) => {
      // Change the structure of the point
      point = {
        id: point.id,
        name: point.name,
        address: point.address,
        city: point.city,
        lat: point.lat,
        lng: point.lng,
        votes: {
          cdep: {
            usr: parseInt(point.usr_cdep),
            psd: parseInt(point.psd_cdep),
            pnl: parseInt(point.pnl_cdep),
            pmp: parseInt(point.pmp_cdep),
            udmr: parseInt(point.udmr_cdep),
            alde: parseInt(point.alde_cdep),
            pru: parseInt(point.pru_cdep),
            altele: parseInt(point.altele_cdep)
          },
          senat: {
            usr: parseInt(point.usr_senat),
            psd: parseInt(point.psd_senat),
            pnl: parseInt(point.pnl_senat),
            pmp: parseInt(point.pmp_senat),
            udmr: parseInt(point.udmr_senat),
            alde: parseInt(point.alde_senat),
            pru: parseInt(point.pru_senat),
            altele: parseInt(point.altele_senat)
          }
        },
      };

      point.reportedStations = (reduce(point.votes.cdep, sum, 0) + reduce(point.votes.senat, sum, 0)) > 0 ? 1 : 0

      // Collect the city list
      if (!cities.includes(point.city)) {
        cities.push(point.city);
      }

      // Save point at coord
      const coord = getCoord(point);
      let existingPoints = pointsAtCoord.get(coord) || [];
      pointsAtCoord.set(coord, existingPoints.concat(point));
      return point;
    });

        cities = cities.map((city, id) => ({id, city}));

        Boxes.drawCities(cities, county);
        $citiesSelect.select2({
          placeholder: "Alege Localitatea",
        });
        $citiesSelect.on('select2:select', (e) => {
          let coord = find(points, {city: e.params.data.id});
          map.setView([coord.lat, coord.lng], 14);
        });

        $citiesSelect.on('select2:unselect', (e) => {
          let selectedCity = $citiesSelect.val();
          let coord = find(points, {city: selectedCity});
          map.setView([coord.lat, coord.lng], 14);
        })
        $citiesSelect.on('change', (e) => {
          drawWithLoader(points, pointsAtCoord, $citiesSelect.val());

          let selectedCity = $citiesSelect.val();
          let $navContainer = $(e.target).closest('.box').find('.city-navigator');
          $navContainer.find('.city-link').remove();
          $navContainer.find('.title').html();
          if (!selectedCity.length) {
            return;
          }

            let coord = find(points, {city: selectedCity});
            let $link = $(`<a href="#" class="city-link black dim ml1" data="${selectedCity}">${selectedCity.split(' ').join("&nbsp;")}</a>`)
            .click(e => {
              e.preventDefault();
              map.setView([coord.lat, coord.lng], 14);
              let city = $(e.target).attr('data');
              Boxes.drawCityResults(points.filter(p => p.city == city), city);
            });
            $navContainer
              .append($link)
              .find('.title').html('Vezi rezultate pentru:');

      // console.log(getPointsByCity(points));
        });

    $citiesSelect.val('Cluj-Napoca').trigger('change');
    let Clujcoords = find(points, {city: 'Cluj-Napoca'});
    map.setView([Clujcoords.lat, Clujcoords.lng], 14)
        map.on('viewreset moveend', () => {
          drawWithLoader(points, pointsAtCoord, $citiesSelect.val());
          Boxes.clearDetails();
        });
        drawWithLoader(points, pointsAtCoord, $citiesSelect.val());
        if (callback) callback();
      });
    };

    Boxes.drawCounties();
    $countiesSelect.select2({
      placeholder: "Alege Județul",
      allowClear: true
    });
    $countiesSelect.on('change', (e) => {
      getCityJson(`data.json`, e.target.value)
      //map.setView([coord.lat, coord.lng], 14);
    });
    $countiesSelect.val('Cluj').trigger('change'); // set the default to Cluj for now

    $reloadButton.on('click', () => {
      let selectedCity = $citiesSelect.val();
      getCityJson('data.json', 'Cluj', () => {
    Boxes.clearDetails();
    if (window.lastActivePoint) {
      Boxes.drawDetails(pointsAtCoord.get(getCoord(window.lastActivePoint)));
    }
      });
    });
  });
}
