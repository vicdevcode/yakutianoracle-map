import "./style.css";
import { Map, View, Overlay } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { transform } from "ol/proj";
import { Cluster } from "ol/source";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style.js";

const osm = new TileLayer({
  source: new OSM(),
});

const citiesVS = new VectorSource({
  loader: async function(extent, r, x, success, failure) {
    const url = "https://api.yakutianoracle.ru/api/v1/user/geo/cities";
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader(
      "Authorization",
      "Bearer 1|ltN6mUXK1LE080xvAqytarfUiA76M5bpJuVAEbA375eb2988",
    );
    const onError = function() {
      citiesVS.removeLoadedExtent(extent);
      failure();
    };
    xhr.onerror = onError;
    xhr.onload = function() {
      if (xhr.status == 200) {
        const k = JSON.parse(xhr.responseText);
        k["features"].forEach((element) => {
          element["geometry"]["coordinates"] = transform(
            [
              element["geometry"]["coordinates"][1],
              element["geometry"]["coordinates"][0],
            ],
            "EPSG:4326",
            "EPSG:3857",
          );
        });
        const features = new GeoJSON().readFeatures(k);
        citiesVS.addFeatures(features);
        success(features);
      } else {
        onError();
      }
    };
    xhr.send();
  },
});

const citiesCluster = new Cluster({
  distance: 50,
  minDistance: 50,
  source: citiesVS,
});

const styleCache = {};
const citiesLayer = new VectorLayer({
  source: citiesCluster,
  style: function(feature) {
    const size = feature.get("features").length;
    if (size == 1) {
      return new Style({
        image: new CircleStyle({
          radius: 10,
          stroke: new Stroke({
            color: "#fff",
          }),
          fill: new Fill({
            color: "#3399CC",
          }),
        }),
        text: new Text({
          text: feature.get("features")[0].getProperties()["name"],
          font: "9px sans-serif",
          textBaseline: "top",
          offsetY: 10,
          fill: new Fill({
            color: "#222",
          }),
        }),
      });
    }
    let style = styleCache[size];
    if (!style) {
      style = new Style({
        image: new CircleStyle({
          radius: 10,
          stroke: new Stroke({
            color: "#fff",
          }),
          fill: new Fill({
            color: "#3399CC",
          }),
        }),
        text: new Text({
          text: size.toString(),
          fill: new Fill({
            color: "#fff",
          }),
        }),
      });
      styleCache[size] = style;
    }
    return style;
  },
});

let zoom = 5;

const container = document.getElementById("popup");
const content = document.getElementById("popup-content");
const closer = document.getElementById("popup-closer");

const overlay = new Overlay({
  element: container,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

closer.onclick = function() {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

const view = new View({
  center: [0, 0],
  zoom: zoom,
  extent: [11013447.6518, 7085566.549, 18614341.9101, 14052497.1404],
});

const map = new Map({
  target: "map",
  layers: [osm, citiesLayer],
  overlays: [overlay],
  view: view,
});

// const element = document.getElementById("popup");
//
// const popup = new Overlay({
//   element: element,
//   stopEvent: false,
// });
// map.addOverlay(popup);

// function formatCoordinate(coordinate) {
//   return `
//     <table>
//       <tbody>
//         <tr><th>lon</th><td>${coordinate[0].toFixed(2)}</td></tr>
//         <tr><th>lat</th><td>${coordinate[1].toFixed(2)}</td></tr>
//       </tbody>
//     </table>`;
// }

// map.on("moveend", function() {
//   const view = map.getView();
//   const center = view.getCenter();
//   info.innerHTML = formatCoordinate(center);
// });

map.on("click", function(event) {
  const feature = map.getFeaturesAtPixel(event.pixel)[0];
  if (!feature) {
    return;
  }
  if (feature.get("features").length > 1) {
    view.getZoom();
    view.animate({
      zoom: view.getZoom() + 20 / view.getZoom(),
      center: feature.getGeometry().getCoordinates(),
      duration: 500,
    });
    return;
  }

  const coordinate = feature.getGeometry().getCoordinates();

  content.innerHTML = `<p>Город: ${feature.get("features")[0].getProperties()["name"]
    }</p><code>
    ${transform(coordinate, "EPSG:3857", "EPSG:4326")} 
    </code>`;
  overlay.setPosition(coordinate);
});

map.on("pointermove", function(event) {
  const type = map.hasFeatureAtPixel(event.pixel) ? "pointer" : "inherit";
  map.getViewport().style.cursor = type;
});
