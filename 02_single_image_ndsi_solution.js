// 1. Create AOI and center map to AOI with zoom level 10
Map.centerObject(aoi, 10);

// 2. Load landsat-8 (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2") imagery
var collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");

// 3. Filter date (2024), filter bounds (aoi)
collection = collection
  .filterBounds(aoi)
  .filterDate("2024-01-01", "2024-12-31");

// 4. Remove cloud
collection = collection
  .filter(ee.Filter.lt("CLOUD_COVER", 10)) // Remove high-cloud images
  .map(function (image) {
    var qa = image.select("QA_PIXEL"); // Quality assessment band
    var mask = qa.bitwiseAnd(1 << 3).eq(0); // Mask clouds
    return image.updateMask(mask);
  });

// 5. Select the first image and clip to aoi and visualize
var image = collection.first().clip(aoi);

var imgVis = { min: 5000, max: 20000, bands: ["SR_B4", "SR_B3", "SR_B2"] };
Map.addLayer(image, imgVis, "Landsat8 (True Color)");

// 6. Calculate NDSI = (Green - SWIR1) / (Green + SWIR1)
var ndsi = image.normalizedDifference(["SR_B3", "SR_B6"]).rename("NDSI");

// 7. Visualize NDSI
var ndsiVis = { min: -1, max: 1, palette: ["blue", "white"] };
Map.addLayer(ndsi, ndsiVis, "NDSI");

// 8. Threshold NDSI to classify snow cover (NDSI > 0.4)
var snow = ndsi.gt(0.4).selfMask();

// 9. Add snow cover to the map
Map.addLayer(snow, { palette: "cyan" }, "Snow Cover");

// 10. Calculate snow-covered area
var snowArea = snow.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 30, // Landsat resolution
  maxPixels: 1e13, // Maximum number of pixels
});

var snowAreaKm2 = ee.Number(snowArea.get("NDSI")).divide(1e6);

// Print snow-covered area in sqkm
print("Snow-covered area (sq. km.):", snowAreaKm2);
