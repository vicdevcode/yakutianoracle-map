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
import Geolocation from "ol/Geolocation";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import XYZ from "ol/source/XYZ.js";
import { Control, defaults as defaultControls } from "ol/control.js";

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
  // source: new XYZ({
  //   url: "https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=mnrOol1RFL0nHjcUVNjM",
  //   maxZoom: 20,
  // }),
});

const noosm = new TileLayer({
  source: new XYZ({
    url: "https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=mnrOol1RFL0nHjcUVNjM",
    maxZoom: 20,
  }),
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

const geoVS = new VectorSource({
  loader: async function(extent, r, x, success, failure) {
    const url = "https://api.yakutianoracle.ru/api/v1/user/geo";
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    const onError = function() {
      geoVS.removeLoadedExtent(extent);
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
        console.log(k);
        const features = new GeoJSON().readFeatures(k);
        geoVS.addFeatures(features);
        success(features);
      } else {
        onError();
      }
    };
    xhr.send();
  },
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
        console.log(k);
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

const geoCluster = new Cluster({
  distance: 15,
  minDistance: 15,
  source: geoVS,
});

const citiesCluster = new Cluster({
  distance: 30,
  minDistance: 30,
  source: citiesVS,
});

const geosLayer = new VectorLayer({
  source: geoCluster,
  style: function(feature) {
    return new Style({
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
          color: "#fff",
        }),
        fill: new Fill({
          color: pickHex([0, 255, 255], [255, 0, 0], 0.5),
        }),
      }),
      text: new Text({
        text: feature.get("features")[0].getProperties()["category"],
        font: "7px sans-serif",
        textBaseline: "top",
        offsetY: 10,
        fill: new Fill({
          color: "#222",
        }),
      }),
    });
  },
});

const styles = function(feature) {
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
            feature.get("features")[0].getProperties()["transport"]["rating"] /
            10,
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
        sum + feature.get("features")[i].getProperties()["transport"]["rating"];
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
};

const styleCache = {};
const citiesLayer = new VectorLayer({
  source: citiesCluster,
  style: styles,
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

const geolocation = new Geolocation({
  trackingOptions: {
    enableHighAccuracy: true,
  },
  projection: view.getProjection(),
});
geolocation.setTracking(true);

const positionFeature = new Feature();
positionFeature.setStyle(
  new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({
        color: "#3399CC",
      }),
      stroke: new Stroke({
        color: "#fff",
        width: 2,
      }),
    }),
  }),
);
geolocation.on("change:position", function() {
  const coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ? new Point(coordinates) : null);
});

const geoLayer = new VectorLayer({
  source: new VectorSource({
    features: [positionFeature],
  }),
});

let osm_ = true;

class RotateNorthControl extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = "N";

    const element = document.createElement("div");
    element.className = "rotate-north ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.handleRotateNorth.bind(this), false);
  }

  handleRotateNorth() {
    console.log(osm_);
    if (osm_) {
      this.getMap().setLayers([noosm, regionLayer, geoLayer, citiesLayer]);
      osm_ = false;
    } else {
      this.getMap().setLayers([osm, regionLayer, geoLayer, citiesLayer]);
      osm_ = true;
    }
  }
}

let osm2_ = true;

class RotateNorthControl1 extends Control {
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = "P";

    const element = document.createElement("div");
    element.className = "rotate-north1 ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.handleRotateNorth.bind(this), false);
  }

  handleRotateNorth() {
    console.log(osm2_);
    if (osm2_) {
      if (osm_) {
        this.getMap().setLayers([
          osm,
          regionLayer,
          geoLayer,
          citiesLayer,
          geosLayer,
        ]);
      } else {
        this.getMap().setLayers([
          noosm,
          regionLayer,
          geoLayer,
          citiesLayer,
          geosLayer,
        ]);
      }
      osm2_ = false;
    } else {
      if (osm_) {
        this.getMap().setLayers([osm, regionLayer, geoLayer, citiesLayer]);
      } else {
        this.getMap().setLayers([noosm, regionLayer, geoLayer, citiesLayer]);
      }
      osm2_ = true;
    }
  }
}
var timeout = null;
class RotateNorthControl2 extends Control {
  constructor(opt_options) {
    const options = opt_options || {};

    const input = document.createElement("input");

    const element = document.createElement("div");
    element.className = "rotate-north2 ol-unselectable ol-control";
    element.appendChild(input);

    super({
      element: element,
      target: options.target,
    });

    input.addEventListener("input", this.updateValue, false);
  }

  updateValue(e) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(async function() {
      if (e.target.value != "") {
        const s = await fetch(
          "https://api.yakutianoracle.ru/api/v1/user/geo?search=" +
          e.target.value,
          {
            method: "GET",
            headers: {
              Authorization: "Bearer " + token,
            },
          },
        )
          .then((d) => d.json())
          .then((r) => r);
        view.animate({
          zoom: view.getZoom() + 20 / view.getZoom(),
          center: transform(
            [
              s["features"][0]["geometry"]["coordinates"][1],
              s["features"][0]["geometry"]["coordinates"][0],
            ],
            "EPSG:4326",
            "EPSG:3857",
          ),
          duration: 500,
        });
        console.log(s);
      }
    }, 1000);
  }
}

const map = new Map({
  target: "map",
  layers: [osm, regionLayer, geoLayer, citiesLayer],
  overlays: [overlay],
  view: view,
  controls: defaultControls().extend([
    new RotateNorthControl(),
    new RotateNorthControl1(),
    new RotateNorthControl2(),
  ]),
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

  const places = {
    city: "Город",
    town: "Поселок городского типа",
    village: "Деревня",
    hamlet: "Село",
  };

  content.innerHTML = `<div style="display: flex; flex-direction: column"><p>${places[prop["place"]]
    }: ${prop["name"]}</p>
    <span>Население: ${prop["population"]}</span>
<span>Потенциал: ${prop["rating"]}</span>
<span>Коэффициент Круглогодичности: ${prop["year_round_rating"]}</span>
<span>Транспортная доступность: ${Math.round(
      prop["transport"]["rating"] * 10,
    )}%</span><span>Рядом ли аэропорт: ${prop["transport"]["airport_nearby"] ? "Да" : "Нет"
    }</span><span>Количество автобусных остановок: ${prop["transport"]["bus_stations"]
    }</span>

    <span>Координаты: 
    (${Math.round(wsg84[0] * 100000) / 100000}, 
    ${Math.round(wsg84[1] * 100000) / 100000}) 
    </span>

</div>`;
  overlay.setPosition(coordinate);
});

map.on("pointermove", function(event) {
  const type = map.hasFeatureAtPixel(event.pixel) ? "pointer" : "inherit";
  map.getViewport().style.cursor = type;
});
