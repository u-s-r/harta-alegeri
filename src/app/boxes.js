import d3 from 'd3';
import Chart from 'chart.js';
import { toTitleCase, counties, partyColors, votesToD3Hierarchy, getPointsByAddress, getCoord } from './helpers';
import { maxBy } from 'lodash';

export const clearDetails = () => {
  d3.select('.info-content').remove();
  d3.select('.info-container').classed('dn', true);
}

// pointInfo object contains info about that polling station (name, adress, etc.)
// ids contains the ids of the pollings stations at that specific location
export const drawDetails = points => {
  clearDetails();

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

  detailsBoxSelection
    .append('div')
      .attr('class', 'polling-name f4 mv2 mt3 lh-solid')
      .text('Rezultate');

  detailsBoxSelection
  	.append('div').attr('class', 'chart-container').text('Camera Deputatilor')
    .append('canvas')
      .attr('id', 'deputati_chart');

  let ctxd = document.getElementById("deputati_chart");
  let deputatiData = {
      labels: [
          "Red",
          "Blue",
          "Yellow"
      ],
      datasets: [
          {
              data: [300, 50, 100],
              backgroundColor: [
                  "#FF6384",
                  "#36A2EB",
                  "#FFCE56"
              ],
          }
	  ]
  };
  let deputatiChart = new Chart(ctxd, {
	  type: 'pie',
	  data: deputatiData,
	  options: {}
  });

  detailsBoxSelection
    .append('div').attr('class', 'chart-container').text('Camera Senatorilor')
    .append('canvas')
  	.attr('id', 'senatori_chart');

  let ctxs = document.getElementById("senatori_chart");
  let senatoriData = {
  	labels: [
  		"Red",
  		"Blue",
  		"Yellow"
  	],
  	datasets: [
  		{
  			data: [300, 500, 100],
  			backgroundColor: [
  				"#FF6384",
  				"#36A2EB",
  				"#FFCE56"
  			],
  		}
  	]
  };
  let senatoriChart = new Chart(ctxs, {
  	type: 'pie',
  	data: senatoriData,
  	options: {}
  });
  

  // et h = 200;
  // et barPadding = 5;
  // 	let size;
  // 
  // let dataPointCount;
  // let barChart = detailsBoxSelection.append('svg')
  //   .attr('width', '100%')
  //   .attr('height', h);
  // 
  // let w = detailsBoxSelection.node().getBoundingClientRect().width;
  // let winner;
  // 
  // barChart.selectAll('g')
  //   .data(d => {
  //     // [
  //     //   /* party, votes, percentage */
  //     //   ['usr', 1241, 50],
  //     //   ['psd', 1241, 50],
  //     //   ...
  //     // ]
  //     let chartVoteData = [];
  //     let sum = Object.keys(d.votes).reduce((total, party) => (total + parseInt(d.votes[party])), 0);
  //     Object.keys(d.votes).map(party => {
  //       if (!d.votes[party]) { return; }
  //       chartVoteData.push([
  //         party,
  //         d.votes[party],
  //         100 * d.votes[party] / sum
  //       ]);
  //     });
  //     // Formula to determine max size.
  //     winner = maxBy(chartVoteData, o => o[1]);
  //     size = 100 / winner[2];
  // 
  //     dataPointCount = chartVoteData.length;
  //     return chartVoteData;
  //   })
  //   .enter()
  //   .append('g');
  // 
  // let calcBarHeigh = (percentage) => Math.round(size * h * percentage / 100);
  // 
  // arChart.selectAll('g')
  //   .append('rect')
  // 	   .attr('x', (d, i) => i * (w / dataPointCount))
  // 	   .attr('y', d => h - (h * d[2] / 100 * size))
  // 	   .attr('width', w / dataPointCount - barPadding)
  // 	   .attr('height', d => calcBarHeigh(d[2]))
  //      .style('fill', d => partyColors[d[0]])
  //      .attr('class', d => (d[0] == winner[0] ? 'leader' : ''));
  // 
  // arChart.selectAll('g')
  //   .append('text')
  //   .text(function(d) {
  //      let qualifier = d[0] == winner[0] ? ' &#10112;' : '';
  //   		return `${d[0]}`;
  //   })
  //   .attr('text-anchor', 'middle')
  //   .attr('x', function(d, i) {
  //   		return i * (w / dataPointCount) + (w / dataPointCount - barPadding) / 2;
  //   })
  //   .attr('y', d => h - 22)
  //    .attr('class', 'b f6 ttu')
  //    .style('fill', d => (calcBarHeigh(d[2]) < 35 ? 'black' : 'white'))
  // 
  // arChart.selectAll('g')
  //   .append('text')
  //   .text(function(d) {
  //   		return `${Math.round(d[2] * 100) / 100}%`;
  //   })
  //   .attr('text-anchor', 'middle')
  //   .attr('x', function(d, i) {
  //   		return i * (w / dataPointCount) + (w / dataPointCount - barPadding) / 2;
  //   })
  //   .attr('y', d => h - 7)
  //    .attr('class', 'f6')
  //    .style('fill', d => (calcBarHeigh(d[2]) < 15 ? 'black' : 'white'))

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
