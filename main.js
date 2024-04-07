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

let params = new URL(document.location.toString()).searchParams;
let token = params.get("token");

// token = "1|MjTz0soHazrXzLkwwHlzUBSOuA3CgacDgLU0aNp856ec2ecb";

function pickHex(color1, color2, weight) {
  var w1 = weight;
  var w2 = 1 - w1;
  var rgb = [
    Math.round(color1[0] * w1 + color2[0] * w2),
    Math.round(color1[1] * w1 + color2[1] * w2),
    Math.round(color1[2] * w1 + color2[2] * w2),
  ];
  return rgb;
}

const osm = new TileLayer({
  source: new OSM(),
});

const regionVS = new VectorSource({
  url: "https://api.yakutianoracle.ru/api/v1/territory",
  format: new GeoJSON(),
  // loader: async function(extent, r, x, success, failure) {
  //   const url = "https://api.yakutianoracle.ru/api/v1/user/geo/regions";
  //   const xhr = new XMLHttpRequest();
  //   xhr.open("GET", url);
  //   xhr.setRequestHeader("Authorization", "Bearer " + token);
  //   const onError = function() {
  //     citiesVS.removeLoadedExtent(extent);
  //     failure();
  //   };
  //   xhr.onerror = onError;
  //   xhr.onload = function() {
  //     if (xhr.status == 200) {
  //       const k = JSON.parse(xhr.responseText);
  //       console.log(k);
  //       const features = new GeoJSON().readFeatures(k);
  //       citiesVS.addFeatures(features);
  //       success(features);
  //     } else {
  //       onError();
  //     }
  //   };
  //   xhr.send();
  // },
});

const regionLayer = new VectorLayer({
  source: regionVS,
});

const citiesVS = new VectorSource({
  loader: async function(extent, r, x, success, failure) {
    const url = "https://api.yakutianoracle.ru/api/v1/user/geo/cities";
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
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
  distance: 30,
  minDistance: 30,
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
            color: pickHex(
              [0, 255, 0],
              [255, 0, 0],
              feature.get("features")[0].getProperties()["transport"][
              "rating"
              ] / 10,
            ),
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
      let sum = 0;
      for (let i = 0; i < size; i++) {
        sum =
          sum +
          feature.get("features")[i].getProperties()["transport"]["rating"];
      }
      console.log(sum, size, sum / size);
      sum /= size;
      style = new Style({
        image: new CircleStyle({
          radius: 10,
          stroke: new Stroke({
            color: "#fff",
          }),
          fill: new Fill({
            color: pickHex([0, 255, 0], [255, 0, 0], sum / 10),
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
  layers: [osm, regionLayer, citiesLayer],
  overlays: [overlay],
  view: view,
});

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
  const wsg84 = transform(coordinate, "EPSG:3857", "EPSG:4326");

  const prop = feature.get("features")[0].getProperties();

  content.innerHTML = `<div style="display: flex; flex-direction: column"><p>Город: ${prop["name"]
    }</p><span>Координаты: 
    (${Math.round(wsg84[0] * 100000) / 100000}, 
    ${Math.round(wsg84[1] * 100000) / 100000}) 
    </span><span>Транспортная доступность: ${Math.round(
      prop["transport"]["rating"] * 10,
    )}%</span><span>Рядом ли аэропорт: ${prop["transport"]["airport_nearby"] ? "Да" : "Нет"
    }</span><span>Количество автобусных остановок: ${prop["transport"]["bus_stations"]
    }</span></div>`;
  overlay.setPosition(coordinate);
});

map.on("pointermove", function(event) {
  const type = map.hasFeatureAtPixel(event.pixel) ? "pointer" : "inherit";
  map.getViewport().style.cursor = type;
});
