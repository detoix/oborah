import { PMTiles } from "pmtiles";

async function main() {
  const p = new PMTiles("http://localhost:3000/krakow.pmtiles");
  const metadata = await p.getMetadata();
  console.log(JSON.stringify(metadata, null, 2));
}

main().catch(console.error);
