import { PMTiles } from "pmtiles";

async function main() {
  const p = new PMTiles("http://localhost:3000/krakow.pmtiles");
  await p.getMetadata();
}

main();
