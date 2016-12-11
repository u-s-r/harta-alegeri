import d3 from 'd3';
import Chart from 'chart.js';
import { calculateReportedPollingStations, calculatePointsVotes, toTitleCase, counties, partyColors, parties, votesToD3Hierarchy, getPointsByAddress, getCoord, lastActivePoint } from './helpers';
import { maxBy } from 'lodash';

export const clearDetails = () => {
  d3.select('.info-content').remove();
  d3.select('.info-container').classed('dn', true);
  d3.select('.results-container').remove();
}

export const getResultsBoxSelection = (data, title) => {
  d3.select('.results-container').remove();

  let resultsBoxSelection = d3.select('.results-box')
    .selectAll('div')
    .data(data)
    .enter()
    .append('div')
      .attr('class', 'results-container');

  resultsBoxSelection
    .append('div')
      .attr('class', 'f4 mv2 mt3 lh-solid')
      .text(title)

  return resultsBoxSelection;
}

export const drawResults = (containerSelection, votes) => {
  d3.select('.results-box').classed('dn', false);
  d3.select('.results-box').classed('db', true);
  containerSelection
    .append('div')
      .attr('class', d => `${!d.reportedStations ? 'dn ' : 'dib '}w-40 chart-container`)
      .text('Camera Deputatilor')
    .append('canvas')
      .attr('class', d => `${!d.reportedStations ? 'dn ' : ''}chart-deputati`);

  containerSelection
    .append('div')
      .attr('class', d => `${!d.reportedStations ? 'dn ' : 'dib '}w-40 chart-container`)
      .text('Senat')
    .append('canvas')
      .attr('class', d => `${!d.reportedStations ? 'dn ' : ''}chart-senatori`);

  containerSelection
    .append('div')
      .attr('class', 'reported-polling-ids')
      .text(d => {
        if (!d.reportedStations) {
          return `Deocamdată nu sunt date pentru ${d.ids.length == 1 ? 'această secție.' : 'aceste secții.'}`
        }
        return `Secții de vot raportate: ${d.reportedStations} / ${d.ids.length}`
      });

  containerSelection.each((d, i) => {
    if (!d.reportedStations)
      return;

    let cdepVotes = d.votes.cdep;
    let senatVotes = d.votes.senat;

    let cdepValues = [], senatValues = [], colors = [];
    let labels = [...parties];
    labels.forEach((partyName) => {
      cdepValues.push(cdepVotes[partyName]);
      senatValues.push(senatVotes[partyName]);
      colors.push(partyColors[partyName]);
    });

    let ctxd = document.getElementsByClassName('chart-deputati');
    let ctxs = document.getElementsByClassName('chart-senatori');
    let deputatiChart = new Chart(ctxd[i], {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [
          {
            data: cdepValues,
            backgroundColor: colors,
          }
        ]
      },
      options: {}
    });

    let senatoriChart = new Chart(ctxs[i], {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [
          {
            data: senatValues,
            backgroundColor: colors,
          }
        ]
      },
      options: {}
    });
  });


  // detailsBoxSelection
  //   .append('div')
  //     .attr('class', 'vote-count f4 mb2')
  //     .text('Număr de voturi / partid')
  //     .append('div')
  //       .selectAll('span')
  //         .data(d => {
  //           // TODO I know this is repetead, but I need to ship.
  //           // [
  //           //   /* party, votes, percentage */
  //           //   ['usr', 1241, 50],
  //           //   ['psd', 1241, 50],
  //           //   ...
  //           // ]
  //           let chartVoteData = [];
  //           let sum = Object.keys(d.votes).reduce((total, party) => (total + d.votes[party]), 0);
  //           Object.keys(d.votes).map(party => {
  //             if (!d.votes[party]) { return; }
  //             chartVoteData.push([
  //               party,
  //               d.votes[party]
  //             ]);
  //           });
  //           dataPointCount = chartVoteData.length;
  //           return chartVoteData;
  //         })
  //         .enter()
  //           .append('span')
  //           .attr('class', 'br1 ph1 f5 white ml1')
  //           .style('background-color', (d) => partyColors[d[0]])
  //           .text(d => d[1]);
}

// pointInfo object contains info about that polling station (name, adress, etc.)
// ids contains the ids of the pollings stations at that specific location
export const drawDetails = points => {
  clearDetails();
  window.lastActivePoint = points[0];

  let pointsByAddress = getPointsByAddress(points);

  let detailsBoxSelection = d3.select('.info-container')
    .classed('dn', false)
    .append('div')
      .attr('class', 'info-content')
    .selectAll('div')
    .data(pointsByAddress)
    .enter()
    .append('div')
      .attr('class', d => `polling-station mb2 pb2 bb b--black-10 polling-${d.id}`)

  detailsBoxSelection
    .append('div')
      .attr('class', 'polling-name f3 mb2 lh-solid')
      .text(d => d.name);

  detailsBoxSelection
    .append('div')
      .attr('class', 'polling-address')
      .text(d => `Adresă: ${d.address}`);

  detailsBoxSelection
    .append('div')
      .attr('class', 'polling-ids')
      .text(d => {
        const label = d.ids.length == 1 ? 'Secția de vot:' : 'Secțiile de vot:';
        return `${label}`;
      })
      .selectAll('span')
        .data(d => d.ids)
        .enter()
          .append('span')
          .attr('class', 'br1 ph1 white bg-dark-gray ml1')
          .text(d => d);

  drawResults(
    getResultsBoxSelection(pointsByAddress, d => `Rezultate pentru ${d.name}`),
    pointsByAddress[0].votes
  );
}

export const drawCityResults = (points, city) => {
  points = getPointsByCity(points);
  let votes = calculatePointsVotes(points);
  let reportedStations = calculateReportedPollingStations(points);
  console.log(reportedStations);
  drawResults(getResultsBoxSelection([{votes}], `Rezultate pentru ${city}`), votes);
}

export const drawCities = (cities, county = 'Cluj') => {
  d3.select('.city-navigator-box').classed('dn', false);
  d3.select('.cities').selectAll('optgroup').remove();
  let citiesDropdownSelection = d3.select('.cities')
    .append('optgroup')
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
