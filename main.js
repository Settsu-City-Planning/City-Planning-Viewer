import './style.css'
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from "pmtiles";

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: 'map',
  hash: true,
  style: './style.json',
  center: [135.57, 34.777],
  zoom: 13,
  maxZoom: 17.99,
  minZoom: 4,
  localIdeographFontFamily: ['BIZ UDPGothic', 'sans-serif']
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
