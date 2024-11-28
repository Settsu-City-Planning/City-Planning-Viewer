import './style.css'
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import {
  MaplibreExportControl,
  Format,
} from '@watergis/maplibre-gl-export';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';
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
    // When a click event occurs on a feature in the states layer, open a popup at the
    // location of the click, with description HTML from its properties.
    map.on('click', (e) => {
      const layers = ["senbiki-fill", "youto-fill", "koudoti-fill", "bouka-fill"];
      const features = layers.map(layer => map.queryRenderedFeatures(e.point, {
        layers: [layer],
      })[0]);

      if (features[0] === undefined) return;
      let part = []
      part[0] = features[0].properties.区域区分
      if (part[0] == "市街化区域") {
        part[1] = `<br>${features[1].properties.用途地域}
      <li>容積率：${features[1].properties.容積率}</li>
      <li>建ぺい率：${features[1].properties.建ぺい率}</li>`
        part[2] = features[2]?.properties?.Type ?? "高度地区指定なし"
      }
      part[3] = "<br>"
      part[4] = features[3]?.properties?.防火準防火 ?? "法22条地域"
      const HTML = part.join("");

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(HTML)
        .addTo(map);
    });

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

  const geocoderApi = {
    forwardGeocode: async (config) => {
      const features = [];
      const request =
        `https://geocode.csis.u-tokyo.ac.jp/cgi-bin/simple_geocode.cgi?addr=${config.query
        }&charset=UTF8&constraint=大阪府摂津市`;
      const response = await fetch(request);
      const string = await response.text();
      const parser = new DOMParser();
      const xml = await parser.parseFromString(string, "text/xml");
      const center = [
        xml.getElementsByTagName("longitude")[0].firstChild.nodeValue,
        xml.getElementsByTagName("latitude")[0].firstChild.nodeValue
      ];
      const point = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: center
        },
        place_name: xml.getElementsByTagName("address")[0].textContent,
        place_type: ['place'],
        center
      };
      features.push(point);

      return {
        features
      };
    }
  };
  map.addControl(new MaplibreGeocoder(geocoderApi, { maplibregl })
  );

  map.addControl(new maplibregl.NavigationControl());

  map.addControl(new MaplibreExportControl({
    Format: Format.PNG,
    Crosshair: true,
    PrintableArea: true,
    Local: 'ja',
  }));

  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }));

  let check1 = document.getElementById('style');
  let check2 = document.getElementById('bdr');

  document.getElementById('style').addEventListener('click', () => {
    check1.checked ? map.setStyle('./style/std.json') : map.setStyle('./style/skeleton.json');
  });

  document.getElementById('bdr').addEventListener('click', () => {
    check2.checked ? map.showTileBoundaries = true : map.showTileBoundaries = false;
  });
});