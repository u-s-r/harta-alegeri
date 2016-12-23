import fs from 'fs';
import d3pie from 'd3pie';
import json2csv from 'json2csv';
import { difference, pick, findIndex, maxBy, map, reduce, isArray } from 'lodash';

export const toTitleCase = (str) => {
  const split = str.split('-');
  const capitalize = (str) => {
    return str.replace(/\w\S*/g, (txt) => (
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    ));
  };
  return split.map(capitalize).join('-');
}


export const writeToCsv = (data, fields, destFile) => {
    let csv = json2csv({
      data: data,
      fileds: fields
    });

    fs.writeFile(destFile, csv, (err) => {
      if (err) {
        return console.log(`Writing "${destFile}" failed.`);
      }
      console.log(`\nNew csv generated at "${destFile}"`);
    })
}

export const getCoord = point => `${point.lat},${point.lng}`;

export const partyColors = {
  none: '#363636', // Will be returned when all votes equal 0
  psd: '#de1313',
  usr: '#01a0e4',
  pnl: '#e6c835',
  udmr: '#63ab26',
  alde: '#095685',
  pmp: '#e7981c',
  pru: '#ff00ff',
  altele: '#e1e1e1'
};

export const parties = ['psd', 'usr', 'pnl', 'udmr', 'alde', 'pmp', 'pru', 'altele'];

export const sum = function(a, b) {
	a = isNaN(a) ? 0 : a;
	b = isNaN(b) ? 0 : b;
	return a + b
};

// Calculates the total number of votes / party from a number of points
// TODO: Memoize
export const calculatePointsVotes = function (points) {
  let cdepPartyVotes = {}, senatPartyVotes = {};
  parties.map(key => {
    cdepPartyVotes[key] = 0;
	senatPartyVotes[key] = 0;
  });

  points.forEach(function(point){
	  parties.forEach(function(partyName){
		cdepPartyVotes[partyName] += point.votes.cdep[partyName] ? parseInt(point.votes.cdep[partyName]) : 0;
		senatPartyVotes[partyName] += point.votes.senat[partyName] ? parseInt(point.votes.senat[partyName]) : 0;
	  });
  });

	return {
		cdep: cdepPartyVotes,
		senat: senatPartyVotes
	};

  // return points.reduce((votesArray, point, i) => {
  //   Object.keys(votesArray).map(party => {
  //     votesArray[party] += point.votes[party] ? parseInt(point.votes[party]) : 0;
  //   });
  //   return votesArray;
  // }, partyVotes);
}

export const calculateReportedPollingStations = points => {
  return points.filter(point => {
    return reduce(point.votes.cdep, sum, 0) + reduce(point.votes.senat, sum, 0) > 0;
  }).length;
}

// Returns the winner party key
export const getWinner = (points) => {
  let votes = calculatePointsVotes(points);
  let totalVotesByParty = {};
  let totalVotes = 0;
  parties.map(key => { totalVotesByParty[key] = 0; });

  Object.keys(votes.cdep).forEach(function(partyName){
	  totalVotes += votes.cdep[partyName];
	  totalVotesByParty[partyName] += votes.cdep[partyName];
  });
  Object.keys(votes.senat).forEach(function(partyName){
	  totalVotes += votes.senat[partyName];
	  totalVotesByParty[partyName] += votes.senat[partyName];
  });

  // no votes, no winner
  if (totalVotes === 0 ) {
	  return 'none';
  }

  let winner = maxBy(Object.keys(totalVotesByParty), o => totalVotesByParty[o]);
  return winner;
}

export const getWinnerColor = points => partyColors[getWinner(points)];

// Adds an array of point ids to the first point in the array that has an
// identical address. It is assumed that using the first point name will suffice.
export const getPointsByAddress = points => {
  // Group points by address
  let pointsByAddress = [];
  let votes;

  points.forEach(point => {
    let existingIndex = findIndex(
      pointsByAddress,
      addrPoint => addrPoint.address === point.address
    );
    if (existingIndex === -1) {
      pointsByAddress.push({
        ...point,
        ids: [point.id]
      });
    } else {
      votes = calculatePointsVotes([
        pointsByAddress[existingIndex],
        point
      ]);

      pointsByAddress[existingIndex] = {
        ...pointsByAddress[existingIndex],
        votes,
        ids: [...pointsByAddress[existingIndex].ids, point.id]
      };
    };
  });

  return pointsByAddress;
}

export const getPointsByCriterion = (points, properties = false) => {
  // Group points by city
  let groupedPoints = [];
  let votes;

  points.forEach(point => {
    let existingIndex = properties ? findIndex(
        groupedPoints,
        p => {
          let conditionIsMet = true;
          properties.forEach(prop => {
            conditionIsMet = conditionIsMet && (p[prop] === point[prop]);
          });
          return conditionIsMet;
        }
      ) : (groupedPoints.length ? 0 : -1); // If no props are supplied, group onto the first point

    let getGroupedPoints = (point, existing = false) => {
      const minimalPoint = pick(point, difference(Object.keys(point), [...properties, 'votes']));
      const result = {
        points: existing ? [...existing['points'], minimalPoint] : [minimalPoint]
      };
      return result;
    }

    if (existingIndex === -1) {
      groupedPoints.push({
        ...pick(point, [...properties, 'votes', 'city']),
        ...getGroupedPoints(point)
      });
    } else {
      votes = calculatePointsVotes([
        groupedPoints[existingIndex],
        point
      ]);

      groupedPoints[existingIndex] = {
        ...groupedPoints[existingIndex],
        votes,
        ...getGroupedPoints(point, groupedPoints[existingIndex])
      };
    };
  });

  return groupedPoints;
}

// Merges points that satisfy an certain property equality criterion into
// the first point encountered, and preserves a list of ids.
export const mergePointsByCriterion = (points, properties) => {
  // Group points by city
  let mergedPoints = [];
  let votes;

  points.forEach(point => {
    let existingIndex = findIndex(
      mergedPoints,
      p => {
        let conditionIsMet = true;
        properties.forEach(prop => {
          conditionIsMet = conditionIsMet && (p[prop] === point[prop]);
        });
        return conditionIsMet;
      }
    );

    if (existingIndex === -1) {
      mergedPoints.push({
        ...point,
        ids: [point.id]
      });
    } else {
      mergedPoints[existingIndex] = {
        ...mergedPoints[existingIndex],
        ids: [...mergedPoints[existingIndex].ids, point.id]
      };
    };
  });

  return mergedPoints;
}

export const getPointsByCity = (points) => {
  // Group points by city
  let pointsByCity = [];
  let votes;

  points.forEach(point => {
    let existingIndex = findIndex(
      pointsByCity,
      addrPoint => addrPoint.city === point.city
    );

    if (existingIndex === -1) {
      pointsByCity.push({
        ...point,
        ids: [point.id]
      });
    } else {
      votes = calculatePointsVotes([
        pointsByCity[existingIndex],
        point
      ]);

      pointsByCity[existingIndex] = {
        ...pointsByCity[existingIndex],
        votes,
        ids: [...pointsByCity[existingIndex].ids, point.id]
      };
    };
  });

  return pointsByCity;

}

export const counties = {
  "MARAMUREȘ": { "shortname": "MM", "center": [24.196311,47.670505] },
  "SĂLAJ": { "shortname": "SJ", "center": [23.020902,47.1568] },
  "SATU MARE": { "shortname": "SM", "center": [22.753082,47.726611] },
  "ARGEȘ": { "shortname": "AG", "center": [24.848027,44.993603] },
  "CĂLĂRAȘI": { "shortname": "CL", "center": [27.139129,44.315] },
  "DÂMBOVIȚA": { "shortname": "DB", "center": [25.485363,44.921683] },
  "GIURGIU": { "shortname": "GR", "center": [26.046045,44.121805] },
  "IALOMIȚA": { "shortname": "IL", "center": [27.207825,44.601391] },
  "PRAHOVA": { "shortname": "PH", "center": [26.038481,45.107216] },
  "TELEORMAN": { "shortname": "TR", "center": [25.190647,44.06833] },
  "BRĂILA": { "shortname": "BR", "center": [27.666679,45.120288] },
  "BACĂU": { "shortname": "BC", "center": [26.715951,46.422221] },
  "CONSTANȚA": { "shortname": "CT", "center": [28.349535,44.262836] },
  "GALAȚI": { "shortname": "GL", "center": [27.749441,45.776276] },
  "ILFOV": { "shortname": "IF", "center": [26.240774,44.492266] },
  "ALBA": { "shortname": "AB", "center": [23.545842,46.01329] },
  "BRAȘOV": { "shortname": "BV", "center": [25.154827,45.785798] },
  "TULCEA": { "shortname": "TL", "center": [28.947239,45.03313] },
  "VRANCEA": { "shortname": "VN", "center": [26.882368,45.789054] },
  "DOLJ": { "shortname": "DJ", "center": [23.664477,44.206969] },
  "GORJ": { "shortname": "GJ", "center": [23.324913,44.960853] },
  "MEHEDINȚI": { "shortname": "MH", "center": [23.056727,44.603683] },
  "OLT": { "shortname": "OT", "center": [24.466127,44.294229] },
  "VALCEA": { "shortname": "VL", "center": [24.15376,45.041301] },
  "ARAD": { "shortname": "AR", "center": [21.893004,46.292531] },
  "CARAȘ-SEVERIN": { "shortname": "CS", "center": [22.075788,45.126339] },
  "HUNEDOARA": { "shortname": "HD", "center": [22.90683,45.802093] },
  "TIMIȘ": { "shortname": "TM", "center": [21.631834,45.69082] },
  "COVASNA": { "shortname": "CV", "center": [26.009492,45.896527] },
  "HARGHITA": { "shortname": "HR", "center": [25.620666,46.641993] },
  "MUREȘ": { "shortname": "MS", "center": [24.625122,46.606357] },
  "SIBIU": { "shortname": "SB", "center": [24.237568,45.8886] },
  "BOTOȘANI": { "shortname": "BT", "center": [26.756967,47.852774] },
  "IAȘI": { "shortname": "IS", "center": [27.187467,47.206078] },
  "NEAMȚ": { "shortname": "NT", "center": [26.515025,46.99141] },
  "SUCEAVA": { "shortname": "SV", "center": [25.827202,47.534032] },
  "BIHOR": { "shortname": "BH", "center": [22.190961,46.991653] },
  "BUCUREȘTI": { "shortname": "B", "center": [26.087001,44.438622] },
  "VASLUI": { "shortname": "VS", "center": [27.803684,46.496985] },
  "BISTRIȚA-NĂSĂUD": { "shortname": "BN", "center": [24.508046,47.177309] },
  "CLUJ": { "shortname": "CJ", "center": [23.71807,46.888528] },
  "BUZĂU": { "shortname": "BZ", "center": [26.774682,45.267028] }
};

export const generatePie = (domId, title, content) => {
    const pie = new d3pie(domId, {
      header: {
        title: {
          text: title,
          fontSize: 24,
          font: "Helvetica"
        },
        titleSubtitlePadding: 9
      },
      footer: {
        color: "#999999",
        fontSize: 10,
        font: "Helvetica",
        location: "bottom-left"
      },
      size: {
        canvasWidth: '400',
        canvasHeight: '400',
        pieInnerRadius: "57%",
        pieOuterRadius: "82%"
      },
      data: {
        sortOrder: "value-asc",
        content: content
      },
      labels: {
        outer: {
          pieDistance: 14
        },
        inner: {
          hideWhenLessThanPercentage: 3
        },
        mainLabel: {
          fontSize: 17
        },
        percentage: {
          color: "#ffffff",
          decimalPlaces: 1,
          fontSize: 14
        },
        value: {
          color: "#adadad",
          fontSize: 14
        },
        lines: {
          enabled: true
        },
        truncation: {
          enabled: true
        }
      },
      tooltips: {
        enabled: true,
        type: "placeholder",
        string: "{label}: {value}, {percentage}%",
        styles: {
          borderRadius: 5,
          fontSize: 16
        }
      },
      effects: {
        load: {
          effect: "none"
        },
        pullOutSegmentOnClick: {
          effect: "none"
        }
      },
      misc: {
        gradient: {
          enabled: false,
          percentage: 100
        }
      }
    });

    $(`#${domId} svg`)
      //.attr('preserveAspectRatio', 'xMaxn meet')
      .attr('viewBox', '0 0 400 400')
      .attr('class', 'w-100 overflow-visible')
      .attr('height', '290');

    return pie;
}

export const doFetch = (url) => {
  let request = {
    method: 'GET',
    headers: new Headers({
      'Accept': 'application/json'
    })
  };
  return fetch(url, request);
}

export const findGetParameter = (parameterName) => {
    var result = null,
        tmp = [];
    var items = location.search.substr(1).split("&");
    for (var index = 0; index < items.length; index++) {
        tmp = items[index].split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    }
    return result;
}

export const getCurrentUrl = () => {
  return (location.protocol + '//' + location.host + location.pathname).replace(/\/$/, '') + '/';
}
