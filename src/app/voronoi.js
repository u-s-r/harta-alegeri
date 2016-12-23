import d3 from 'd3';
import Promise from 'bluebird';
import fetch from 'isomorphic-fetch';
import { find, maxBy, filter, reduce } from 'lodash';

import * as helpers from './helpers';
import * as Boxes from './boxes';
import * as Loader from './loader';

// Clears the overlay that contains the Voronoi map
const clearVoronoiOverlay = () => {
  d3.select('#overlay').remove();
}

const getCountyPoints = (county) => {
  return new Promise((resolve, reject) => {
    d3.csv(`./rezultate/${county.toUpperCase()}.csv`, (response) => {
      let cities = [];

      let points = filter(response, o => (o.id != 'total')).map((point) => {
        // Change the structure of the point
        point = {
          id: point.id,
          name: point.name,
          address: point.address,
          county: point.circumscriptie,
          city: point.city,
          lat: point.lat,
          lng: point.lng,
          county,
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

        // Collect the city list
        if (!cities.includes(point.city)) {
          cities.push(point.city);
        }

        // Save point at coord
        return point;
      });

      resolve({
        points,
        cities: cities.map((city, id) => ({id, city}))
      });
    }); // d3.csv
  }); // Promise
};

const setViewToCity = (city, points, map) => {
  const coord = find(points, { city: city });
  map.setView([coord.lat, coord.lng], 14)
  Boxes.drawCityResults(points, city);
}

const appendToCitiesSelect = (cities, county, points, map) => {
  Boxes.drawCities(cities, county);

  let $citiesSelect = $('.cities').removeClass('dn');
  $citiesSelect.off('change select2:select select2:unselect'); // Needs to happen before the select2 init
  map.off('click moveend'); // Needs to happen before the select2 init

  $citiesSelect.select2({
    placeholder: "Afișează secții din localitățile",
  }).data('select2').$container.addClass('mt2');

  map.on('click moveend', () => { $citiesSelect.select2('close') });

  $citiesSelect.on('select2:select', (e) => {
    setViewToCity(e.params.data.id, points, map);
  });

  $citiesSelect.on('select2:unselect', (e) => {
    const selectedCities = $citiesSelect.val();
    if (!selectedCities.length)
      return;
    setViewToCity(selectedCities[selectedCities.length-1], points, map);
  });

  $citiesSelect.on('change', (e) => {
    let $container = $('.results-navigator-box').find('.cities-nav');
    $container.find('.nav').empty();
    let selectedCities = $citiesSelect.val();
    if (!selectedCities.length) {
      return $container.addClass('dn');
    }

    drawWithLoader(map, points, selectedCities);

    $container.removeClass('dn');
    const $navContainer = $container.find('.nav');
    selectedCities.forEach(city => {
      let $link = $(`<a href="#" class="black pv1 bl bb b--white ph2 bg-light-gray hover-bg-gray hover-light-gray dib" data="${city}">${city}</a>`)
        .click(e => {
          e.preventDefault();
          let city = $(e.target).attr('data');
          let clickedCoord = find(points, { city: city });
          map.setView([clickedCoord.lat, clickedCoord.lng], 14);
          Boxes.drawCityResults(points, city);
        });
      $navContainer.append($link);
    });
  });

  return $citiesSelect;
}

const drawCountiesSelect = (map, selectedCallback) => {
  let $countiesSelect = $('select.counties');

  Boxes.drawCounties();
  const selectOptions = {
    placeholder: "Încarcă date din județul",
    allowClear: false
  };
  $countiesSelect.select2(selectOptions);

  map.on('click moveend', () => $countiesSelect.select2('close'));

  $countiesSelect.val('').trigger('change');

  // When a new county is selected
  $countiesSelect.on('select2:select', (e, county) => {
    if (typeof e.params != 'undefined') {
      county = e.params.data.id;
    }

    // TODO, maybe move after load
    $countiesSelect.find(`option[value=${county}]`).prop('disabled', true);
    $countiesSelect.find(`option[value=${county}]`).text((i, t) => `${t} (Încărcat)`);
    $countiesSelect.select2(selectOptions);
    $countiesSelect.val('').trigger('change');

    selectedCallback({
      selectedCounty: county,
      container: $(e.target).closest('.box'),
      element: $countiesSelect
    });
  });
}

const focusOnCounty = (county, points, map, move = true) => {
  if (move) {
    map.setView(helpers.counties[county.toUpperCase()].center.reverse(), 10);
  }
  Boxes.drawCountyResults(points, county);
}

// Draws a Voronoi map
const drawVoronoiOverlay = (map, points, visibleCities) => {
  clearVoronoiOverlay();

  let bounds = map.getBounds(),
    topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
    bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
    existing = d3.set(),
    // Expands drawing bounds
    drawLimits = bounds.pad(0.4);

  // Filter the points to remove duplicates and points that are out of bounds
  let pointsAtCoord = d3.map();
  let filteredPoints = points.map((point) => {
    const latlng = new L.LatLng(point.lat, point.lng);
    if (
      !drawLimits.contains(latlng)
      || !visibleCities.includes(point.city)
    ) { return false };

    // Get points the points at a certain coordinate
    const coord = helpers.getCoord(point);
    const existingPoints = pointsAtCoord.get(coord) || [];
    pointsAtCoord.set(coord, existingPoints.concat(point));

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
  }).filter(p => p);

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
        Boxes.drawCityResults(points, lastSelectedPoint.point.city);
        lastSelectedPoint = null;
        return;
      }

      lastSelectedPoint = data;
      cell.classed('selected', true);

      d3.select(this.parentNode).select('circle').classed('selected', true);

      Boxes.drawPointResults(pointsAtCoord.get(helpers.getCoord(data.point)));
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
    .attr('class', d => {
      return helpers.getWinnerColor(pointsAtCoord.get(helpers.getCoord(d.point))) == helpers.partyColors['none'] ? 'none' : ''
    })
    .style('fill', d => helpers.getWinnerColor(pointsAtCoord.get(helpers.getCoord(d.point))))
    .style('stroke', d => helpers.getWinnerColor(pointsAtCoord.get(helpers.getCoord(d.point))))
    .attr("r", d => {
      //console.log()
      const numberOfBooths = pointsAtCoord.get(helpers.getCoord(d.point)).length;
      const mapZoom = map.getZoom();
      let radius = (3/8)*mapZoom + numberOfBooths;//numberOfBooths + 1 //+ (20 + Math.max(map.getZoom(), 0)) / 10;
      //console.log(mapZoom);
      return radius;
    })
}

const drawWithLoader = (map, points, visibleCities) => {
  Loader.show();
  setTimeout(() => {
    drawVoronoiOverlay(map, points, visibleCities);
    Loader.hide();
  }, 0);
}

const selectDefault = () => {
  // Show results for county
  let urlCounty = find(
    Object.keys(helpers.counties),
    c => helpers.counties[c].shortname == helpers.findGetParameter('judet').toUpperCase()
  );
  if (!urlCounty)
    return;
  urlCounty = helpers.toTitleCase(urlCounty);
  let $countiesSelect = $('select.counties');
  $countiesSelect.one('select2:select', () => {
    let $citiesSelect = $('.cities'),
      city = helpers.findGetParameter('loc');
      $citiesSelect.one('select2:cities:appended', (e, cities, setViewToCity) => {
        const urlCity = find(cities, c => c.city.toUpperCase() == city.toUpperCase());
        if (typeof urlCity == 'undefined')
          return;

        setViewToCity(urlCity.city);
        $citiesSelect.val(urlCity.city).trigger('change');
      });
  });
  $countiesSelect.val(urlCounty).trigger('select2:select', [urlCounty]);
}

// In prima faza dupa numarul de sectii, apoi dupa numarul de voturi
// Marimea la bile zoom out si in sa fie ok
// Harta culorilor partidelor
// Update UI
export default function (map, url) {

  map.on('ready', () => {
    let points = [];
      drawCountiesSelect(map, ({ selectedCounty, container: $container, element: $counties }) => {
        /*
        * When a certain county is selected, get the list of points
        * from this county.
        */
        getCountyPoints(selectedCounty)
        // When the list of points is complete...
        .then(pointData => {
          // 1. Draw the cities select
          let { points: newPoints, cities } = pointData;
          points = [...newPoints, ...points];
          let $cities = appendToCitiesSelect(
            cities,
            selectedCounty,
            points,
            map
          );

          // 3. Append a new navigation link
          let $link = $(`<a href="#" class="black pv1 bl bb b--white ph2 bg-light-gray hover-bg-gray hover-light-gray dib">${selectedCounty}</a>`)
          .click(e => {
            e.preventDefault();
            //Boxes.drawCountyResults(points, $(e.target).text());
            focusOnCounty($(e.target).text(), points, map, false);
          });
          $('.results-navigator-box')
            .find('.results-nav')
            .removeClass('dn')
              .find('.counties-nav .nav')
              .append($link);

          $('.results-navigator-box')
            .find('.cities-select-container')
            .addClass('bounceIn animated');

          // 4. Zoom to the county on the map, and draw the county results
          focusOnCounty(selectedCounty, newPoints, map);

          //map.off('viewreset move');
          map.on('viewreset moveend', (e) => {
            drawWithLoader(map, points, $cities.val());
          });//.fire('viewreset');
          drawWithLoader(map, points, $cities.val());

          $cities.trigger(
            'select2:cities:appended',
            [cities, (city) => setViewToCity(city, points, map)]
          );
        });
      });
      selectDefault();
    });
}
