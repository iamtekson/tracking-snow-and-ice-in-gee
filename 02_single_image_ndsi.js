// 1. Create AOI and center map to AOI with zoom level 10

// 2. Load landsat-8 (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2") imagery

// 3. Filter date (2024), filter bounds (aoi)

// 4. Remove cloud

// 5. Select the first image and clip to aoi and visualize

// 6. Calculate NDSI = (Green - SWIR1) / (Green + SWIR1)

// 7. Visualize NDSI

// 8. Threshold NDSI to classify snow cover (NDSI > 0.4)

// 9. Add snow cover to the map

// 10. Calculate snow-covered area
