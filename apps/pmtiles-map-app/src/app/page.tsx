import Map from "@engine/map";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <Map
        geocoder={{
          provider: "photon",
          position: "top-left",
          placeholder: "Search with Photon",
          language: "en",
          limit: 8,
        }}
      />
    </main>
  );
}
