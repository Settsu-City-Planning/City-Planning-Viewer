let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const fgbMinZoom = 18;

const map = new maplibregl.Map({
    container: 'map',
    hash: true,
    style: './style.json',
    center: [135.57, 34.777],
    zoom: 13,
    minZoom: 4,
    maxZoom: 19,
    localIdeographFontFamily: ['NotoSansJP-Regular', 'MS Gothic', 'Hiragino Kaku Gothic Pro', 'sans-serif']
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
            properties: xml.getElementsByTagName("latitude")[0].textContent,
            text: xml.getElementsByTagName("iLvl")[0].textContent,
            place_type: ['place'],
            center
        };
        features.push(point);

        return {
            features
        };
    }
};
map.addControl(
    new MaplibreGeocoder(geocoderApi, {
        maplibregl
    })
);

// コントロール関係表示
map.addControl(new maplibregl.NavigationControl());

// スケール表示
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: 'metric'
}));

map.addControl(new MaplibreExportControl.MaplibreExportControl({
    PageSize: MaplibreExportControl.Size.A4,
    PageOrientation: MaplibreExportControl.PageOrientation.Landscape,
    Format: MaplibreExportControl.Format.PNG,
    DPI: MaplibreExportControl.DPI[300],
    Crosshair: true,
    PrintableArea: true,
    Local: 'ja'
}));

function fgbBoundingBox() {
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
    let iter = flatgeobuf.deserialize(
        "/data/r1chikeizu.fgb",
        fgbBoundingBox()
    );
    for await (let feature of iter) {
        fc.features.push({ ...feature, id: i });
        i += 1;
    }
    map.getSource("polygons").setData(fc);
}

map.on("load", () => {
    map.on('click', (e) => {
        const layers = ["senbiki-layer", "youto-layer", "koudoti-layer", "bouka-layer"];
        const features = layers.map(layer => map.queryRenderedFeatures(e.point, {
            layers: [layer],
        })[0]);

        console.log(features)

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

    map.addSource("polygons", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
        id: "polygons-line",
        type: "line",
        source: "polygons",
        minzoom: fgbMinZoom,
        paint: {
            "line-color": "#0000FF",
            "line-opacity": 0.9,
            "line-width": 1,
        },
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

    updateResults = _.throttle(updateResults, 11000);

    updateResults();

    map.on("moveend", function (s) {
        updateResults();
    });

});
