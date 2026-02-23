import fs from 'fs';
import { pmtiles, Protocol } from 'pmtiles';

async function main() {
  const p = new pmtiles.PMTiles("file://./public/krakow.pmtiles");
  await p.getHeader();
  await p.getMetadata();
}

main();
