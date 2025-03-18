var nepal = ee.FeatureCollection("projects/ee-teksondada/assets/nepal"),
  landsat4 = ee.ImageCollection("LANDSAT/LT04/C02/T1_L2"),
  landsat5 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2"),
  landsat7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2"),
  landsat8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
  landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"),
  visParams = {
    opacity: 1,
    bands: ["NDSI"],
    min: -0.3090345549061275,
    max: 0.6023592331951486,
    palette: ["000000", "817e7a", "ff8c29", "ff200a"],
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

// Generate images for each year from 1992 to 2024
var years = ee.List.sequence(1990, 2024);

// // Remove particular year if that year is mostly cloudy
// var removeYear = [1990, 1995, 2003]
// years = years.removeAll(removeYear);

var images = years.map(function (year) {
  year = ee.Number(year);

  // Use ee.Algorithms.If to check the year condition
  var image = ee.Algorithms.If(
    year.lt(2014),
    landsat457(aoi, [
      ee.Date.fromYMD(year, 1, 1),
      ee.Date.fromYMD(year, 12, 31),
    ]),
    landsat89(aoi, [ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31)])
  );

  // Ensure the image is a valid ee.Image
  image = ee.Image(image); // Ensure it's an image
  var hasBands = image.bandNames().size().gt(0);

  // calculate ndsi
  var ndsi = image
    .expression("(GREEN - SWIR1) / (GREEN + SWIR1)", {
      SWIR1: image.select("B6"),
      GREEN: image.select("B3"),
    })
    .rename("NDSI");

  var img = ee.Algorithms.If(
    hasBands,
    ndsi.set("year", year),
    null // if no image found, set null
  );

  return img;
});

// Remove null values (years with missing data)
var validImages = images.removeAll([null]);

// Define bbox to visualize image
// var bbox = aoi.geometry().simplify(1000).buffer(30000)
// print(bbox)

// Create an ImageCollection from the list
var imageCollection = ee.ImageCollection(validImages);
// print(imageCollection)
// print(imageCollection.first().get("year"))

var gifImgCollection = imageCollection.map(function (img) {
  return img.visualize(visParams).clip(aoi);
});

// Add the first available year's image to the map (optional)
var image_list = imageCollection.toList(imageCollection.size());
var single_img = ee.Image(image_list.get(30));

Map.centerObject(aoi, 10);
Map.addLayer(single_img, visParams, "Night Lights");

// Create an animated GIF
var gifParams = {
  dimensions: 500,
  region: aoi.geometry(),
  framesPerSecond: 1,
  crs: "EPSG:4326",
  format: "gif",
};

//==============================================
//Add annotation on gif
//==============================================

var text = require("users/gena/packages:text"); // Import gena's package which allows text overlay on image
var annotations = [
  {
    position: "right",
    offset: "1%",
    margin: "1%",
    property: "label",
    scale: Map.getScale() * 4,
  },
];

// add text as a string
var position = ee.Geometry.Point([82.44, 29.1]);
function addText(image) {
  var timeStamp = image.get("year"); // get the time stamp of each frame. This can be any string. Date, Years, Hours, etc.
  var img = image
    .visualize({
      //convert each frame to RGB image explicitly since it is a 1 band image
      forceRgbOutput: true,
      min: -0.3,
      max: 0.6,
      palette: ["000000", "817e7a", "ff8c29", "ff200a"],
    })
    .set({ label: ee.String(timeStamp).slice(0, 4) }); // set a property called label for each image

  var annotated = text.annotateImage(img, {}, position, annotations); // create a new image with the label overlayed using gena's package

  return annotated;
}

// add annotation
var tempCol = imageCollection.map(addText);

// get the url to download video
print(tempCol.getVideoThumbURL(gifParams));

// Generate the GIF URL
print(ui.Thumbnail(tempCol, gifParams));

//=================================================
//overlay vector
//=================================================
// Define an empty image to paint features to.
var empty = ee.Image().byte();

// Paint country feature edges to the empty image.
var nepalOutline = empty
  .paint({ featureCollection: aoi, color: 1, width: 1 })
  // Convert to an RGB visualization image; set line color to black.
  .visualize({ palette: "white" });

// border outline image on all collection images.
var tempColOutline = tempCol.map(function (img) {
  return img.blend(nepalOutline);
});

// Display the animation.
print(ui.Thumbnail(tempColOutline, gifParams));

//=====================================================
// Overlay hillshade
//=====================================================
// Define a hillshade layer from SRTM digital elevation model.
var hillshade = ee.Terrain.hillshade(
  ee
    .Image("USGS/SRTMGL1_003")
    // Exaggerate the elevation to increase contrast in hillshade.
    .multiply(100)
)
  // Clip the DEM by Nepal boundary to clean boundary between
  // land and ocean.
  .clipToCollection(aoi);

// Map a blend operation over the temperature collection to overlay a partially
// opaque temperature layer on the hillshade layer.
var finalVisCol = tempColOutline.map(function (img) {
  return hillshade.blend(img.visualize({ opacity: 0.85 }));
});

// get the url to download video
print(finalVisCol.getVideoThumbURL(gifParams));

// Display the animation.
print(ui.Thumbnail(finalVisCol, gifParams));

// functions
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
