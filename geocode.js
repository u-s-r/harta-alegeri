#!/usr/bin/env babel-node

import d3 from 'd3';
import Promise from 'bluebird';
import { find, forEach } from 'lodash';
import fetch from 'isomorphic-fetch';
import csv from 'csv';
import json2csv from 'json2csv';
import fs from 'fs';
import Papa from 'papaparse';

import * as util from './src/app/helpers';
import xlsx from 'node-xlsx';

const getCsv = (csvSource, county) => {
  return new Promise((resolve, reject) => {
    fs.readFile(csvSource, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        console.log(`Could not load ${csvSource}`, err);
        reject(err);
      }
      resolve(data);
    });
  })
  .then(csvString => {
    return new Promise((resolve, reject) => {
      const getPartyColumn = (p) => csvSource.includes('cdep') ? `${p}_cdep` : `${p}_senat`;
      const addOthers = (rowResults) => {
        const ignoredFields = [
          '1',
          'Tara',
          'Țara',
          'Numar circumscriptie',
          'Denumire circumscriptie',
          'Numar sectie votare',
          'Localitate',
          'SIRUTA',
          'a',
          'a1',
          'a2',
          'a3',
          'b',
          'b1',
          'b2',
          'b3',
          'c',
          'd',
          'e',
          'f',
          'g',
          'PARTIDUL NAȚIONAL LIBERAL',
          'PARTIDUL ALIANȚA LIBERALILOR ȘI DEMOCRAȚILOR',
          'UNIUNEA SALVAȚI ROMÂNIA',
          'UNIUNEA DEMOCRATĂ MAGHIARĂ DIN ROMÂNIA',
          'PARTIDUL SOCIAL DEMOCRAT',
          'PARTIDUL MIȘCAREA POPULARĂ',
          'Data trimiterii Procesului-verbal'
        ];
        return rowResults.meta.fields.reduce((total, field) => {
          let votes = rowResults.data[0][field];
          return total + (ignoredFields.includes(field) || !votes ? 0 : parseInt(votes));
        }, 0);
      };

      const getVotes = (party, row) => {
        return parseInt(row[party]);
      }

      let partyVotes = [];
      Papa.parse(csvString, {
        delimiter: ',',
        //preview: 10,
        header: true,
        step: (results) => {
          let row = results.data[0];
          if (!row['Localitate']) {
            return;
          }
          if (results.error) { reject(results.error); return; }

          if (row['Denumire circumscriptie'].toUpperCase().includes(county.toUpperCase())) {
            partyVotes.push({
              id: parseInt(row['Numar sectie votare']),
              circumscriptie: row['Denumire circumscriptie'],
              localitate: row['Localitate'],
              [getPartyColumn('psd')]: getVotes('PARTIDUL SOCIAL DEMOCRAT', row),
              [getPartyColumn('usr')]: getVotes('UNIUNEA SALVAȚI ROMÂNIA', row),
              [getPartyColumn('pnl')]: getVotes('PARTIDUL NAȚIONAL LIBERAL', row),
              [getPartyColumn('pmp')]: getVotes('PARTIDUL MIȘCAREA POPULARĂ', row),
              [getPartyColumn('udmr')]: getVotes('UNIUNEA DEMOCRATĂ MAGHIARĂ DIN ROMÂNIA', row),
              [getPartyColumn('alde')]: getVotes('PARTIDUL ALIANȚA LIBERALILOR ȘI DEMOCRAȚILOR', row),
              [getPartyColumn('pru')]: getVotes('PARTIDUL ROMÂNIA UNITĂ', row),
              [getPartyColumn('altele')]: addOthers(results)
            });
          }
        },
        complete: () => resolve(partyVotes)
      });
    });
  });
}

const getExcel = (file) => {
  return new Promise((resolve, reject) => {
    let parsedData = xlsx.parse(fs.readFileSync(file));
    let points = [];
    parsedData[0].data.forEach((line, i) => {
      if (!line[5])
        return;
      points.push({
        id: line[4],
        name: line[5],
        address: line[6],
        city: line[7]
      });
    });
    resolve(points);
  });
}


export function parseData(apiKey, dataPromise, csvDest, county) {

  dataPromise
  .then(points => {
    let request = {
      method: 'GET',
      headers: new Headers({
        'Accept': 'application/json'
      })
    };

    let getGeocodeUrl = (address, apiKey)  => {
      return 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + apiKey;
    };

    let failLog = [];
    let fails = 0;
    let processPoint = function(point, resolve) {

      /* Loc. CLUJ-NAPOCA,  Calea Moţilor (Strada Moţilor) (D) , Nr. 78-80 */
      let address = point.address.replace(/\(.*?\)/g, "").split(',').map(point => point.trim());
      // => [ 'Loc. CLUJ-NAPOCA', 'Calea Moţilor', 'Nr. 78-80' ]

      let city = util.toTitleCase(address.shift().replace('Loc. ', ''))
      let computeGeoAddress = (address) => {
        return address
          .concat([city, county])
          .join(' ').split('Nr.')
          .map(i => i.trim()).join(' ').trim();
      }

      // First try
      // ['Calea Moților', 'Nr. 78-80'] => ['Calea Moților', 'Nr. 78-80']
      // ['Nr. 78-80'] => ['Liceul de pe Moților']
      let geoaddress = computeGeoAddress(address.length > 1 ? [address] : [point.name]);
      // If first try results in error, try the backup
      // ['Calea Moților', 'Nr. 78-80'] => ['Liceul de pe Moților']
      // ['Nr. 78-80'] => []
      let backupGeoAddress = computeGeoAddress(address.length > 1 ? [point.name] : []);

      address = address
        .concat([city, county])
        // => [ 'Calea Moţilor', 'Nr. 78-80', 'Cluj-napoca', 'Cluj County' ]
        .map(i => i.trim()).join(' ').trim();
        // => Calea Moţilor 78-80 Cluj-napoca Cluj County

      const fetchGeocode = (geoaddr, backup = false) => {
        return fetch(getGeocodeUrl(backup ? geoaddr[1] : geoaddr[0], apiKey), request)
        .then(response => response.json())
        .then(json => {
          if ( json.results.length == 0 ) {
            failLog.push({...point, firstTry: geoaddr[0], secondTry: geoaddr[1], tryingBackup: backup});
            if (backup) {
              fails++;
              console.log(`2nd: Failed for -=${geoaddr[1]}=-`, json, "\n");
              resolve(0);
              return false;
            }
            console.log(`1st: Failed for -=${geoaddr[0]}=-`, json, "\n");
            return fetchGeocode(geoaddr, true);
          } else {
            // console.log(`${!backup ? '1st' : '2nd'}: ${geoaddr}.`);
            //console.log('Worked for ' + point.name);
            resolve({
              ...point,
              city,
              address,
              ...json.results[0].geometry.location
            });
          }
        });
      };

      return fetchGeocode([geoaddress, backupGeoAddress]);
   };

    // Bypass Google rate-limit by delaying each geolocate with 200ms
    let coordPromises = points.map((point, i) => {
      return new Promise((resolve, reject) => {
        setTimeout(function () {
          processPoint(point, resolve);
        }, 200 * i);
      });
    });

    // When all points have been geolocated, write the CSV
    Promise.all(coordPromises)
      .then(points => {

        Promise.all([
          getCsv('./cdep.csv', 'Cluj'),
          getCsv('./senat.csv', 'Cluj')
        ]).then(d => {
          console.log(`\n${fails} Failures. ${points.length} Successes.`, failLog);

          let voturiCdep = d[0],
          voturiSenat = d[1];
          //console.log(find(voturiCdep, o => o.id == 23));
          points = points.filter(p => p).map(p => {
            return {
              ...p,
              ...find(voturiCdep, o => o.id == p.id),
              ...find(voturiSenat, o => o.id == p.id),
            }
          });

          fs.writeFile(csvDest, Papa.unparse(points), (err) => {
            if (err) {
              return console.log(`Writing "${csvDest}" failed.`);
            }
            console.log(`\nNew csv generated at "${csvDest}"`);
          });
        });

        //util.writeToCsv(
        //  points,
        //  [
        //    'id', 'name', 'lat', 'lng', 'address', 'city',
        //    'psd_cdep', 'usr_cdep', 'pnl_cdep', 'pmp_cdep', 'udmr_cdep', 'alde_cdep', 'pru_cdep', 'altele_cdep',
        //    'psd_senat', 'usr_senat', 'pnl_senat', 'pmp_senat', 'udmr_senat', 'alde_senat', 'pru_senat', 'altele_senat'
        //  ],
        //  csvDest
        //);
      }).catch(reason => {
        console.warn(reason);
      });
  });
};

if (require.main === module) {
 if (process.argv.length < 4) {
     console.log("Corect use is: npm run geocode Google_Maps_API_KEY src_file.csv [dest_file.csv]");
   } else if (!fs.existsSync(process.argv[3])) {
     console.log("The source file '" + process.argv[3] + "' needs to exist.");
   } else {
     parseData(
       process.argv[2],
       getExcel(process.argv[3]),
       process.argv.length > 4 ? process.argv[4] : './output-' + Date.now() + '.csv',
       util.toTitleCase(process.argv[3].split('.')[0])
     );
   }
}
