import Map from "@engine/map";
import { CatalogView } from "@obora/catalog";

export default function Home() {
  return (
    <main className="flex w-screen h-screen overflow-hidden">
      <CatalogView />
      <div className="flex-1 relative">
        <Map
          geocoder={{
            provider: "photon",
            position: "top-left",
            placeholder: "Search with Photon",
            language: "en",
            limit: 8,
          }}
        />
      </div>
    </main>
  );
}
