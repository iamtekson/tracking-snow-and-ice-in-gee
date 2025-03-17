// 1. Write hello world
print("Hello, World!");

// 2. Use the GEE Data Catalog to add Landsat 8 or Sentinel-2
var landsat = ee.ImageCollection("LANDSAT/LC08/C02/T1_TOA");
var sentinel = ee.ImageCollection("COPERNICUS/S2_HARMONIZED");

print("Landsat 8 Collection Count:", landsat.size());
print("Sentinel-2 Collection:", sentinel.size());

// 3. Change visualization parameters (True Color, False Color)
var visTrue = { bands: ["B4", "B3", "B2"], min: 0, max: 0.3 };
var visFalse = { bands: ["B5", "B4", "B3"], min: 0, max: 0.3 };

Map.addLayer(landsat.median(), visTrue, "Landsat True Color", false);
Map.addLayer(landsat.median(), visFalse, "Landsat False Color", false);

// 4. Use the Inspector tool to check pixel values
// (Instruct participants to click on a point on the map and check values)

// 5. Add, Update, Delete geometry in map interface
// (Instruct participants to use the Geometry tools to draw polygons/points)

// 6. Filter imagery by date and location
var kathmandu = ee.Geometry.Point([85.324, 27.717]);
var filteredLandsat = landsat
  .filterDate("2024-01-01", "2024-12-31")
  .filterBounds(kathmandu);
print("Filtered Landsat Images:", filteredLandsat);

//=======================================================
// 7. Task 1: Select landsat-8 imagery from 2024 and
// zoom to Kathmandu region and visualize it
//=======================================================
var dataset = ee
  .ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterDate("2024-01-01", "2024-12-31")
  .filterBounds(kathmandu);

// True color composite
var visParams = { bands: ["SR_B4", "SR_B3", "SR_B2"], min: 7000, max: 15000 };

Map.centerObject(dataset, 8);
Map.addLayer(dataset.median(), visParams, "Landsat True Color");

//=======================================================
// 8. Task 2: Select Sentinel-2 Imagery
// and visualize in false color composite (B8, B4, B3)
//=======================================================
var sentinel2024 = ee
  .ImageCollection("COPERNICUS/S2_HARMONIZED")
  .filterDate("2024-01-01", "2024-12-31")
  .filterBounds(kathmandu);

var visFalseSentinel = { bands: ["B8", "B4", "B3"], min: 0, max: 3000 };

Map.addLayer(sentinel2024.median(), visFalseSentinel, "Sentinel-2 False Color");

//=======================================================
// 9. Calculate NDVI and visualize it
//=======================================================
var ndvi = sentinel2024.median().normalizedDifference(["B5", "B4"]);
var ndviVis = { min: -1, max: 1, palette: ["blue", "white", "green"] };

Map.addLayer(ndvi, ndviVis, "NDVI 2024");

//=======================================================
// 10. Export NDVI image to Google Drive
//=======================================================
Export.image.toDrive({
  image: ndvi,
  description: "NDVI_Kathmandu_2024",
  scale: 10,
  region: kathmandu.buffer(5000).bounds(),
  fileFormat: "GeoTIFF",
});

//=======================================================
// Challenge 1: Remove cloud from Sentinel-2 imagery
//=======================================================
function maskClouds(image) {
  var QA60 = image.select("QA60");
  return image.updateMask(QA60.lt(1));
}

var sentinelCloudFree = sentinel2024.map(maskClouds);

Map.addLayer(
  sentinelCloudFree.median(),
  visFalseSentinel,
  "Sentinel-2 Cloud-Free"
);

//=======================================================
// Challenge 2: Compare NDVI from 2024 with 2020
//=======================================================
var sentinel2020 = ee
  .ImageCollection("COPERNICUS/S2_HARMONIZED")
  .filterDate("2020-01-01", "2020-12-31")
  .filterBounds(kathmandu);

var ndvi2020 = sentinel2020.median().normalizedDifference(["B8", "B4"]);
var ndvi2024 = sentinel2024.median().normalizedDifference(["B8", "B4"]);
var ndviChange = ndvi2024.subtract(ndvi2020);

Map.addLayer(
  ndviChange,
  { min: -0.2, max: 0.2, palette: ["red", "white", "green"] },
  "NDVI Change"
);

//=======================================================
// Challenge 3: Calculate the dense vegetated area in 2024 using threshold approach (>0.5)
//=======================================================
var denseVegetation = ndvi2024.gt(0.5);

Map.addLayer(
  denseVegetation.selfMask(),
  { palette: "green" },
  "Dense Vegetation 2024"
);

// Calculate the area of dense vegetation (in square kilometers)
var pixelArea = ee.Image.pixelArea().divide(1e6); // Convert m² to km²
var denseArea = denseVegetation.multiply(pixelArea);

// Sum all dense vegetation area within the region
var stats = denseArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: kathmandu.buffer(5000), // Define area of interest (buffer around Kathmandu)
  scale: 10, // sentinel-2 resolution
  maxPixels: 1e13,
});

// Print total area of dense vegetation
print("Dense Vegetation Area in 2024 (sq km):", stats.get("nd"));
