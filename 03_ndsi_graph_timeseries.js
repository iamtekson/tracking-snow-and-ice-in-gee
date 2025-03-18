var landsat5 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2"),
  landsat8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
  landsat7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2"),
  landsat4 = ee.ImageCollection("LANDSAT/LT04/C02/T1_L2"),
  landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"),
  ndsiVis = {
    opacity: 1,
    bands: ["NDSI"],
    min: -0.35084209566010144,
    max: 0.6702708657763726,
    palette: ["6e6e6e", "beff9d", "ffffff", "ffffff"],
  },
  imgVis = {
    opacity: 1,
    bands: ["NDSI"],
    min: -0.35084209566010144,
    max: 0.6702708657763726,
    palette: ["6e6e6e", "beff9d", "ff9b06", "ff1308"],
  },
  aoi =
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.FeatureCollection([
      ee.Feature(
        ee.Geometry.Polygon(
          [
            [
              [82.40103770991564, 29.521626113927304],
              [82.40103770991564, 29.0232907011096],
              [83.11789562007189, 29.0232907011096],
              [83.11789562007189, 29.521626113927304],
            ],
          ],
          null,
          false
        ),
        {
          "system:index": "0",
        }
      ),
    ]);

//basic setup
Map.centerObject(aoi, 10);
Map.addLayer(aoi, {}, "AOI", false);

// Generate dynamic year list from 1990 to the current year
var yearList = ee.List.sequence(1990, 2024);

//test code for single year
var year = 2024;
var image = landsat89(aoi, [
  ee.Date.fromYMD(year, 8, 1),
  ee.Date.fromYMD(year, 12, 31),
]);
var ndsi_2023 = image
  .expression("(GREEN - SWIR1) / (GREEN + SWIR1)", {
    SWIR1: image.select("B6"),
    GREEN: image.select("B3"),
  })
  .rename("NDSI");

// ndsi visualize
Map.addLayer(ndsi_2023, imgVis, "ndsi_2023");

//ndsi binary mask
// Threshold NDSI (>0.4 for snow)
var binarysnow = ndsi_2023.gt(0.4).rename("snow");
Map.addLayer(binarysnow, {}, "binary_snow");

// Calculate area of snow covered regions
var pixelArea = binarysnow.multiply(ee.Image.pixelArea());
var area = pixelArea
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e10,
  })
  .get("snow");

print(area);

// Function to filter
function filterCol(col, aoi, date) {
  return col.filterDate(date[0], date[1]).filterBounds(aoi);
}

// Composite function
function landsat457(aoi, date) {
  var col = filterCol(landsat4, aoi, date)
    .merge(filterCol(landsat5, aoi, date))
    .merge(filterCol(landsat7, aoi, date));
  var image = col.map(cloudMaskTm).mode().clip(aoi);
  return image;
}

function landsat89(aoi, date) {
  var col = filterCol(landsat8, aoi, date).merge(
    filterCol(landsat9, aoi, date)
  );
  var image = col.map(cloudMaskOli).mode().clip(aoi);
  return image;
}

// Cloud mask
function cloudMaskTm(image) {
  var qa = image.select("QA_PIXEL");
  var dilated = 1 << 1;
  var cloud = 1 << 3;
  var shadow = 1 << 4;
  var mask = qa
    .bitwiseAnd(dilated)
    .eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(shadow).eq(0));

  return image
    .select(
      ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7"],
      ["B2", "B3", "B4", "B5", "B6", "B7"]
    )
    .updateMask(mask);
}

function cloudMaskOli(image) {
  var qa = image.select("QA_PIXEL");
  var dilated = 1 << 1;
  var cirrus = 1 << 2;
  var cloud = 1 << 3;
  var shadow = 1 << 4;
  var mask = qa
    .bitwiseAnd(dilated)
    .eq(0)
    .and(qa.bitwiseAnd(cirrus).eq(0))
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(shadow).eq(0));

  return image
    .select(
      ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"],
      ["B2", "B3", "B4", "B5", "B6", "B7"]
    )
    .updateMask(mask);
}

// Calculate snow area for each year
var snowAreaFeatureCollection = ee.FeatureCollection(
  yearList.map(function (year) {
    year = ee.Number(year);

    // Use ee.Algorithms.If to check the year condition
    var image = ee.Algorithms.If(
      year.lt(2014),
      landsat457(aoi, [
        ee.Date.fromYMD(year, 1, 1),
        ee.Date.fromYMD(year, 12, 31),
      ]),
      landsat89(aoi, [
        ee.Date.fromYMD(year, 1, 1),
        ee.Date.fromYMD(year, 12, 31),
      ])
    );

    // Ensure the image is a valid ee.Image
    image = ee.Image(image); // Ensure it's an image
    var hasBands = image.bandNames().size().gt(0);

    return ee.Algorithms.If(
      hasBands,
      // If the image has bands, calculate vegetated area
      (function () {
        var ndsi = image
          .expression("(GREEN - SWIR1) / (GREEN + SWIR1)", {
            SWIR1: image.select("B6"),
            GREEN: image.select("B3"),
          })
          .rename("NDSI");

        // Threshold NDSI (>0.4 for snow)
        var binarysnow = ndsi.gt(0.4).rename("snow");

        // Calculate area of snow covered regions
        var pixelArea = binarysnow.multiply(ee.Image.pixelArea());
        var area = pixelArea
          .reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: aoi,
            scale: 30,
            maxPixels: 1e10,
          })
          .get("snow");

        // Convert area to square kilometers
        var areaKm2 = ee.Number(area).divide(1e6);

        return ee.Feature(null, { year: year, area: areaKm2 });
      })(),
      // If no image found, return zero area
      ee.Feature(null, { year: year, area: 0 })
    );
  })
);

// Remove zero-area features
var filteredFeatureCollection = snowAreaFeatureCollection.filter(
  ee.Filter.gt("area", 0)
);

print(snowAreaFeatureCollection);

// Chart the results
var chart = ui.Chart.feature
  .byFeature(filteredFeatureCollection, "year", "area")
  .setOptions({
    title: "Snow Covered Area Over Years",
    hAxis: { title: "Year" },
    vAxis: { title: "Snow Covered Area (km²)" },
    lineWidth: 2,
    pointSize: 4,
  });

print(chart);

//===========================================================
// plot regression line
//===========================================================
// Perform linear regression
var regression = filteredFeatureCollection.reduceColumns({
  reducer: ee.Reducer.linearFit(),
  selectors: ["year", "area"],
});

// Extract regression coefficients
var slope = ee.Number(regression.get("scale"));
var intercept = ee.Number(regression.get("offset"));

// Print regression coefficients
print("Regression Slope:", slope);
print("Regression Intercept:", intercept);

// Add a regression line to the chart
var trendLine = ee.FeatureCollection(
  yearList.map(function (x) {
    x = ee.Number(x);
    return ee.Feature(null, {
      year: x,
      area: slope.multiply(x).add(intercept),
    });
  })
);

print(trendLine, "trendLine");

// Add a 'type' property to distinguish data points and regression line
var dataPoints = filteredFeatureCollection.map(function (feature) {
  return feature.set("type", "area");
});

print(dataPoints, "dataPoints");

var regressionLine = trendLine.map(function (feature) {
  return feature.set("type", "trend");
});

// Merge both collections
var combinedFeatures = dataPoints.merge(regressionLine);

print(combinedFeatures);

// Create a chart with grouped features
var chart = ui.Chart.feature
  .groups({
    features: combinedFeatures,
    xProperty: "year",
    yProperty: "area",
    seriesProperty: "type",
  })
  .setChartType("LineChart")
  .setOptions({
    title: "Snow Cover Area (sqkm)",
    hAxis: { title: "Year" },
    vAxis: { title: "Area (sqkm)" },
    series: {
      1: {
        color: "red", // Data points color
        lineWidth: 2, // Line thickness for data
        pointSize: 0, // Vertices size for data
      },
      0: {
        color: "blue", // Trend line color
        lineWidth: 2, // Line thickness for the trend line
        pointSize: 5, // No vertices for the trend line
      },
    },
  });

// Print the chart
print(chart);
