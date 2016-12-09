#!/usr/bin/env babel-node

import d3 from 'd3';
import Promise from 'bluebird';
import { forEach } from 'lodash';
import fetch from 'isomorphic-fetch';
import csv from 'csv';
import json2csv from 'json2csv';
import fs from 'fs';

import * as util from './src/app/helpers';
import xlsx from 'node-xlsx';

const getCsv = (csvSource) => {
  return new Promise((resolve, reject) => {
    fs.readFile(csvSource, 'utf8', (err, data) => {
      if (err) {
        console.log(`Could not load ${csvSource}`, err);
        reject(err);
      }
      resolve(data);
    });
  })
  .then(csvString => {
    return new Promise((resolve, reject) => {
      csv.parse(
        csvString,
        {
          columns: true
        },
        (err, data) => {
          if (err) { console.log('Could not parse csvString', err); reject(err); }
          resolve(data);
        }
      );
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
        return fetch(getGeocodeUrl(geoaddr[0], apiKey), request)
        .then(response => response.json())
        .then(json => {
          if ( json.results.length == 0 ) {
            failLog.push({...point, geoaddress, backupGeoAddress, secondTry: backup});
            if (backup) {
              fails++;
              console.log(`2nd: Failed for ${point.name}: ${geoaddr}`, json, geoaddr);
              return false;
            }
            console.log(`1st: Failed for ${point.name}: ${geoaddr}`, json, geoaddr);
            return fetchGeocode(geoaddr[1], true);
          } else {
            // console.log(`${!backup ? '1st' : '2nd'}: ${geoaddr}.`);
            //console.log('Worked for ' + point.name);
            resolve({
              ...point,
              city,
              address,
              psd: Math.floor((Math.random() * 10000) + 1),
              usr: Math.floor((Math.random() * 10000) + 1),
              pnl: Math.floor((Math.random() * 10000) + 1),
              pmp: Math.floor((Math.random() * 10000) + 1),
              udmr: Math.floor((Math.random() * 10000) + 1),
              alde: Math.floor((Math.random() * 10000) + 1),
              ...json.results[0].geometry.location
            });
          }
        });
      };

      return fetchGeocode([geoaddress, backupGeoAddress]);
   };

    let coordPromises = points.map((point, i) => {
      return new Promise((resolve, reject) => {
        setTimeout(function () {
          processPoint(point, resolve);
        }, 200 * i);
      });
    });

    Promise.all(coordPromises)
      .then(points => {
        console.log(`\n${fails} Failures. ${points.length} Successes.`, failLog);
        points = points.filter(point => point);

        util.writeToCsv(
          points.filter(p => p),
          ['id', 'name', 'lat', 'lng', 'address', 'city', 'psd', 'usr', 'pnl', 'pmp', 'urmr', 'alde'],
          csvDest
        );

      }).catch(reason => {
        console.warn(reason);
      });
  });
};

if (require.main === module) {
 if (process.argv.length < 4) {
     console.log("Corect use is: npm run parse Google_Maps_API_KEY src_file.csv [dest_file.csv]");
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
