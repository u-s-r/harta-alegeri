#!/usr/bin/env babel-node

import d3 from 'd3';
import Promise from 'bluebird';
import { sortBy, find, forEach } from 'lodash';
import fs from 'fs';
import Papa from 'papaparse';

import * as util from './src/app/helpers';

const getResultsCsv = (csvSource) => {
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

      let partyVotes = {};
      Papa.parse(csvString, {
        delimiter: ',',
        //preview: 10,
        header: true,
        step: (results) => {
          const row = results.data[0];
          if (!row['Localitate'] || row['Țara'] !== 'România') {
            return;
          }
          if (results.error) { reject(results.error); return; }
          const county = row['Denumire circumscriptie'] != 'MUNICIPIUL BUCURESTI' ? row['Denumire circumscriptie'] : 'BUCUREȘTI';
          if (typeof partyVotes[county] == 'undefined') { partyVotes[county] = []; }

          partyVotes[county].push({
            id: parseInt(row['Numar sectie votare']),
            nr_circumscriptie: row['Numar circumscriptie'],
            circumscriptie: county,
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
        },
        complete: () => { resolve(partyVotes) }
      });
    });
  });
}

const parsePoints = (source) => {

  new Promise((resolve, reject) => {
    let locations = new Map();
    fs.readFile(source, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        console.log(`Could not load ${source}`, err);
        reject(err);
      }
      JSON.parse(data).features.forEach(location => {
        const l = location.properties;
        locations.set(`${l.nr_circumscriptie}_${l.nr_sectie}`, location);
      });

      resolve(locations);
    });
  })
  .then(locations => {
    Promise.all([
      getResultsCsv('./src-data/cdep.csv'),
      getResultsCsv('./src-data/senat.csv')
    ]).then(d => {
      if (d[0].length != d[1].length) {
        console.log(`\nIncongruency between senate and cdep number of counties.`);
        return;
      }

      let voturiCdep = d[0],
      voturiSenat = d[1];
      //console.log(find(voturiCdep, o => o.id == 23));
      forEach(voturiCdep, (cdepCountyPoints, county) => {
        if (cdepCountyPoints.length != voturiSenat[county].length) {
          return console.log(`\nIncongruency between senate and cdep number of results for ${county}.`);
        }
        let results = cdepCountyPoints.map((p, i) => {
          const locationInfo = locations.get(`${p.nr_circumscriptie}_${p.id}`);
          //console.log(`${p.nr_circumscriptie}_${p.id}`, locationInfo);
          if (p.id != locationInfo.properties.nr_sectie) {
            console.log('Something is amiss', point, locationInfo);
          }
          return {
            ...p,
            ...voturiSenat[county][i],
            name: locationInfo.properties.sediu,
            address: locationInfo.properties.adresa == 'null' ? '' : locationInfo.properties.adresa,
            city: locationInfo.properties.uat,
            lat: locationInfo.geometry.coordinates[1],
            lng: locationInfo.geometry.coordinates[0]
          };
        });
        results = sortBy(results, ['city']);

        fs.writeFile(`rezultate/${county}.csv`, Papa.unparse(results), (err) => {
          if (err) {
            return console.log(`Writing "rezultate/${county}.csv" failed.`);
          }
          console.log(`\n${results.length} points written to "rezultate/${county}.csv"`);
        });
      });

    });
  }).catch(reason => {
    console.warn(reason);
  });

};

if (require.main === module) {
  parsePoints('./src-data/sectii.geojson');
}
