import fs from 'fs';
import { pmtiles, Protocol } from 'pmtiles';

async function main() {
  const p = new pmtiles.PMTiles("file://./public/krakow.pmtiles");
  const header = await p.getHeader();
  console.log("Header:", header);
  const metadata = await p.getMetadata();
  console.log("Metadata:", JSON.stringify(metadata, null, 2));
}

main().catch(console.error);
