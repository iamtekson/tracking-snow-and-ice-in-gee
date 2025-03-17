// 1. Write hello world

// 2. Use the GEE Data Catalog to add Landsat 8 or Sentinel-2

// 3. Change visualization parameters (True Color, False Color)

// 4. Use the Inspector tool to check pixel values

// 5. Add, Update, Delete geometry in map interface

// 6. Filter imagery by date and location

//=======================================================
// 7. Task 1: Select landsat imagery from 2024 and
// zoom to kathmandu region and visualize it
//=======================================================
var dataset = ee
  .ImageCollection("LANDSAT/LC08/C02/T1_TOA")
  .filterDate("2021-01-01", "2021-12-31")
  .filterBounds(ee.Geometry.Point([85.324, 27.717])); // Kathmandu

// True color composite
var visParams = { bands: ["B4", "B3", "B2"], min: 0, max: 0.3 };

Map.centerObject(dataset, 8);
Map.addLayer(dataset.median(), visParams, "Landsat True Color");

//=======================================================
// 8. Task 2: Select Sentinel-2 Imagery
// ee.ImageCollection("COPERNICUS/S2_HARMONIZED") and
// zoom to kathmandu and Visualize in false color composite (B8, B3, B3)
//=======================================================

//=======================================================
// 9. Calculate NDVI and visualize it
//=======================================================

//=======================================================
// 10. Export image to google drive
//=======================================================

//=======================================================
// Challenge 1: Remove cloud from Sentinel-2 imagery
//=======================================================

//=======================================================
// Challenge 2: Compare NDVI from 2024 with 2020
//=======================================================

//=======================================================
// Challenge 3: Calculate the dense vegetated area
// in 2024 using threshold approach (>0.6)
//=======================================================
