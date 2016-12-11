import d3 from 'd3';
import Chart from 'chart.js';
import { getPointsByCity, calculatePointsVotes, toTitleCase, counties, partyColors, parties, votesToD3Hierarchy, getPointsByAddress, getCoord } from './helpers';
import { maxBy } from 'lodash';

export const clearDetails = () => {
  d3.select('.info-content').remove();
  d3.select('.info-container').classed('dn', true);
  d3.select('.results-container').remove();
}

let sum = (d) => Object.keys(d).reduce((total, party) => (total + parseInt(d[party])), 0);
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

export const drawResults = (containerSelection) => {
  d3.select('.results-box').classed('dn', false);
  d3.select('.results-box').classed('db', true);


  let legenda = containerSelection.append('div')
    .attr('class', 'f5 cf')
    .html('<div class="fl">Legendă:</div>')
    .selectAll('span')
    .data(Object.keys(partyColors))
    .enter()
    .append('span')
    .attr('class', d => d == 'none' ? 'dn' : `f5 mb2 fl ph1 ${d == 'altele' ? 'black' : 'white'} ml1`)
    .attr('style', d => `background-color: ${partyColors[d]}`)
    .text(d => d.toUpperCase())

  containerSelection
    .append('div')
      .attr('class', d => `${!sum(d.votes.cdep) ? 'dn ' : 'dib '}w-40 chart-container`)
      .text('Camera Deputatilor')

    .append('canvas')
      .attr('class', d => `${!sum(d.votes.cdep) ? 'dn ' : 'dib '}chart-deputati`);

  containerSelection
    .append('div')
      .attr('class', d => `${!sum(d.votes.senat) ? 'dn ' : 'dib '}w-40 chart-container`)
      .text('Senat')
    .append('canvas')
      .attr('class', d => `${!sum(d.votes.senat) ? 'dn ' : ''}chart-senatori`);

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
    let labels = [...parties].map(l => l.toUpperCase());
    parties.forEach((partyName) => {
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
      options: {
        legend: {
          display: false,
        },
        animation: {
          onAnimationComplete: function() {
            this.showTooltip(this.segments, true);
          },
          titleFontSize: 14
        },
        tooltips: {
          template: "<%= value %>",
        }
      }
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
      options: {
        legend: {
          display: false
        }
      }
    });
  });

  var winner = [];
  var dataPointCount, size;
  var roomType = ['Camera Deputaților', 'Senat'];
  var voteStatsEnter = containerSelection
    .append('div')
      .attr('class', 'vote-count f4 mb2')
      .append('div')
        .selectAll('div')
        .data(d => {
          return [d.votes.cdep, d.votes.senat]
        })
        .enter()
        .append('div')
        .attr('class', d => `${!sum(d) ? 'dn ' : ''}summary-rooms f5 mt2`)
        .text((d, i) => `${roomType[i]}`)
        .append('div')
        .attr('class', 'cf')
        .selectAll('span')
        .data((d, i) => {
          let voteData = [];

          // [
          //   /* party, votes, percentage */
          //   ['usr', 1241, 50],
          //   ['psd', 1241, 50],
          //   ...
          // ]
          let chartVoteData = [];
          let total = sum(d);
          Object.keys(d).map(party => {
            if (!d[party]) { return; }
            voteData.push([
              party,
              d[party],
              Math.round(100 * (100 * d[party] / total)) / 100
            ]);
          });
          // Formula to determine max size.
          winner[i] = maxBy(voteData, o => o[1]);
          size = 100 / winner[2];

          dataPointCount = voteData.length;

          return voteData;
        })
        .enter()
        .append('span')
          .attr('class', (d, i) => `br1 ph1 mt2 fl f5 ${d[0] == 'altele' ? 'black' : 'white'}${i ? ' ml1' : ''}`)
          .style('background-color', d => partyColors[d[0]])
          .text(d => `${d[2]}%`);

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
  points = getPointsByCity(points.filter(p => p.city == city));
  drawResults(getResultsBoxSelection(points, `Rezultatele pentru ${city}`))
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
