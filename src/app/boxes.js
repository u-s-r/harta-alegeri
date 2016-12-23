import d3 from 'd3';
import Chart from 'chart.js';
import { mergePointsByCriterion, getPointsByCriterion, generatePie, getPointsByCity, calculatePointsVotes, toTitleCase, counties, partyColors, parties, votesToD3Hierarchy, getPointsByAddress, getCoord } from './helpers';
import * as helpers from './helpers';
import { reduce, maxBy } from 'lodash';

const sum = (d) => Object.keys(d).reduce((total, party) => (total + parseInt(d[party])), 0);

export const clearResults = () => {
  d3.select('.results-container').remove();
}

export const getResultsBoxSelection = (data, title = 0, copyLink = false) => {
  clearResults();

  let resultsBoxSelection = d3.select('.results-box')
    .append('div')
    .attr('class', 'relative results-container pa3');

  if (copyLink) {
    resultsBoxSelection
      .append('div')
        .attr('class', 'absolute right-0 top-0')
        .append('button')
          .attr('class', 'ba pa2 pointer pb1 bg-white hover-bg-light-gray dark-gray b--light-gray copy-link')
          .attr('data-clipboard-text', copyLink)
          .append('span')
            .attr('class', 'icon-clippy v-mid');

  }

  if (title) {
    resultsBoxSelection
      .append('div')
        .attr('class', 'f4 tc cf mv2 mb2 lh-solid')
        .html(title);
  }

  return resultsBoxSelection
    .selectAll('.results')
      .data(data)
      .enter()
        .append('div')
        .attr('class', 'results');
}

export const drawResults = (containerSelection, summary = true) => {
  d3.select('.results-box').classed('dn', false);
  d3.select('.results-box').classed('db', true);

  containerSelection
    .append('div')
    .attr('class', d => `${!sum(d.votes.cdep) ? 'dn ' : 'dib '}w-100 relative chart-container`)
    .attr('id', 'chart-cdep');

  containerSelection
    .append('div')
    .attr('class', d => `${!sum(d.votes.senat) ? 'dn ' : 'dib '}w-100 relative chart-container`)
    .attr('id', 'chart-senat');

  containerSelection.each((d, i) => {
    let cdepVotes = d.votes.cdep;
    let senatVotes = d.votes.senat;

    let cdepContent = [], senatContent = [];
    parties.forEach((partyName) => {
      const getDataTemplate = (partyName) => ({
        label: partyName.toLowerCase() == 'altele' ? toTitleCase(partyName) : partyName.toUpperCase(),
        color: partyColors[partyName]
      });
      cdepContent.push({
        ...getDataTemplate(partyName),
        value: cdepVotes[partyName]
      });

      senatContent.push({
        ...getDataTemplate(partyName),
        value: senatVotes[partyName]
      });
    });
    generatePie('chart-cdep', 'Camera Deputaților', cdepContent);
    generatePie('chart-senat', 'Senat', senatContent);
  });

  if (!summary)
    return;

  let stationsInfoSelection = containerSelection
      .append('div')
      .attr('class', 'polling-info');

  stationsInfoSelection
    .selectAll('div')
      .data(d => mergePointsByCriterion(d.points, ['name']))
      .enter()
      .append('div')
      .attr('class', 'cluster mt1 cf f5')
      .html(d => {
        let results = '';
        d.ids.forEach((id, i) => results += `<span class="bg-light-gray ph1 dib br1 ${i ? 'ml1' : ''}">${id}</span>`)
        return `${results}: ${d.name}${d.address ? ', ' + d.address : ''}`;
      });
}

// pointInfo object contains info about that polling station (name, adress, etc.)
// ids contains the ids of the pollings stations at that specific location
export const drawPointResults = points => {
  const pointsByCoord = getPointsByCriterion(points, ['lat', 'lng']);

  let title = `${pointsByCoord[0].city}, `;
  title += pointsByCoord[0].points.length == 1 ? 'secția de vot' : 'secțiile de vot';
  pointsByCoord[0].points.forEach(p => {
    title += `<span class="f5 br1 dib ph1 white bg-dark-gray ml1">${p.id}</span>`
  })

  drawResults(
    getResultsBoxSelection(pointsByCoord, title)
  );
}

export const drawCityResults = (points, city) => {
  points = getPointsByCriterion(points.filter(p => p.city == city), ['city']);
  const county = points[0].points[0].county;
  drawResults(
    getResultsBoxSelection(
      points,
      `Rezultatele pentru <span class="f4 br1 ph1 white bg-dark-gray">${city}</span>`,
      `${helpers.getCurrentUrl()}?judet=${county.toLowerCase()}&loc=${city.toLowerCase()}`
    ),
    false
  );
}

export const drawCountyResults = (points, county) => {
  points = getPointsByCriterion(points.filter(p => p.county.toUpperCase() == county.toUpperCase()));
  county = (county != 'București' ? 'județul ' : '') + county;
  drawResults(
    getResultsBoxSelection(
      points,
      `Rezultatele pentru <span class="f4 br1 ph1 white bg-dark-gray">${county}</span>`,
      `${helpers.getCurrentUrl()}?judet=${county.toLowerCase()}`
    ),
    false
  );
}

export const drawCities = (cities, county) => {
  //d3.select('.city-navigator-box').classed('dn', false);
  //d3.select('.cities').selectAll('optgroup').remove();
  let citiesDropdownSelection = d3.select('.cities')
    .insert('optgroup')
    .attr('label', county)
    .selectAll('option')
    .data(cities)
    .enter();

  citiesDropdownSelection
    .append('option')
      .attr('value', d => d.city)
      .text(d => d.city);
}

export const drawCounties = () => {
  let countyNames = Object.keys(counties).map(toTitleCase).sort();
  let citiesDropdownSelection = d3.select('.counties')
    .selectAll('option')
      .data(countyNames)
      .enter()
        .append('option')
        .attr('value', d => d)
        .text(d => d);
}
