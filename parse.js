#!/usr/bin/env babel-node

import d3 from 'd3';
import Promise from 'bluebird';
import { forEach } from 'lodash';
import fetch from 'isomorphic-fetch';
import csv from 'csv';
import json2csv from 'json2csv';
import fs from 'fs';

import * as util from './helpers';

export function parseCsv(apiKey, csvSource, csvDest) {
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
  })
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

    let coordPromises = points.map((point) => {

      // ?
      setTimeout(() => {}, 100);

      /* Loc. CLUJ-NAPOCA,  Calea Moţilor (Strada Moţilor) (D) , Nr. 78-80 */
      let address = point.address.split(',').map(point => point.replace(/\(.*?\)/g, "").trim());
      // => [ 'Loc. CLUJ-NAPOCA', 'Calea Moţilor', 'Nr. 78-80' ]

      let city = util.toTitleCase(address.shift().replace('Loc. ', ''))
      let geoaddress = (address.length == 1 ? [] : address)
        .concat([city, 'Cluj County'])
        .join(' ').split('Nr.')
        .map(i => i.trim()).join(' ').trim() ;
      address = address
        .concat([city, 'Cluj'])
        // => [ 'Calea Moţilor', 'Nr. 78-80', 'Cluj-napoca', 'Cluj County' ]
        .map(i => i.trim()).join(' ').trim();
        // => Calea Moţilor 78-80 Cluj-napoca Cluj County

       return fetch(getGeocodeUrl(geoaddress, apiKey), request)
       .then(response => response.json())
       .then(json => {
         if ( json.results.length == 0 ) {
           console.log(`Failed for ${point.name}`, json);
           return false;
         } else {
           console.log('Worked for ' + point.name);
           return {
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
           };
         }
      });
    });

    Promise.all(coordPromises)
      .then(points => {
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
    parseCsv(
      process.argv[2],
      process.argv[3],
      process.argv.length > 4 ? process.argv[4] : './output-' + Date.now() + '.csv'
    );
  }
}
