import './style.css'
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from "pmtiles";
import { throttle } from 'underscore';

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const fgbMinZoom = 18;

document.addEventListener("DOMContentLoaded", async () => {
  // basic MapLibre map
  const map = new maplibregl.Map({
    container: 'map',
    hash: true,
    style: './style.json',
    center: [135.57, 34.777],
    zoom: 13,
    maxZoom: 19,
    minZoom: 4,
    localIdeographFontFamily: ['BIZ UDPGothic', 'sans-serif']
  });

  // convert the rect into the format flatgeobuf expects
  function fgBoundingBox() {
    const { _sw, _ne } = map.getBounds();
    return {
      minX: _sw.lng,
      minY: _sw.lat,
      maxX: _ne.lng,
      maxY: _ne.lat,
    };
  }

  async function updateResults() {
    if (map.getZoom() < fgbMinZoom) {
      return;
    };

    let i = 0;
    const fc = { type: "FeatureCollection", features: [] };
    let iter = flatgeobuf.deserialize("./data/r1chikeizu.fgb", fgBoundingBox());
    for await (let feature of iter) {
      fc.features.push({ ...feature, id: i });
      i += 1;
    }
    map.getSource("blocks").setData(fc);
  }

  map.on("load", () => {
    map.addSource("blocks", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      "id": "blocks-line",
      "type": "line",
      "source": "blocks",
      "minzoom": fgbMinZoom,
      "paint": {
        "line-color": [
          "match",
          [
            "get",
            "layer"
          ],
          "建物",
          "#232323",
          "道路",
          "#232323",
          "名称",
          "#a8a1ad",
          "#7b7b7d"
        ],
        "line-width": [
          "match",
          [
            "get",
            "layer"
          ],
          "鉄道",
          2.6,
          "行政界等",
          1.6,
          "河川",
          1.6,
          0.6
        ],
      }
    });

    // if the user is panning around alot, only update twice per second max
    updateResults = throttle(updateResults, 500);

    // show results based on the initial map
    updateResults();

    // ...and update the results whenever the map moves
    map.on("moveend", function (s) {
      updateResults();
    });
  });

  map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

  let check1 = document.getElementById('style');
  let check2 = document.getElementById('bdr');

  document.getElementById('style').addEventListener('click', () => {
    check1.checked ? map.setStyle('./style/std.json') : map.setStyle('./style/skeleton.json');
  });

  document.getElementById('bdr').addEventListener('click', () => {
    check2.checked ? map.showTileBoundaries = true : map.showTileBoundaries = false;
  });
});