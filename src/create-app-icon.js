/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-require */
/* eslint-disable no-undef */
/* eslint-disable no-shadow */

const sketch = require('sketch');
const {
  getSelectedDocument,
  Style,
  Group,
  Rectangle,
  ShapePath,
} = require('sketch/dom');

module.exports = function createAppIcon() {
  const selectedDocument = getSelectedDocument();
  if (!selectedDocument) return;

  const selectedArtboard = selectedDocument.selectedLayers.layers.find(layer => layer.type === 'Artboard');

  if (!selectedArtboard) {
    sketch.UI.message('Please select an Artboard');
    return;
  }

  sketch.UI.getInputFromUser('What\'s the App ID?', {
    initialValue: 'nl.philips.hue',
  }, (err, query) => {
    if (err) return;

    Promise.resolve()
      .then(() => {
        // If App ID
        if (query.includes('.')) {
          return query;
        }

        // Else search
        return fetch(`https://apps-api.athom.com/api/v1/app/search?query=${encodeURIComponent(query)}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(res.statusText);
            }

            return res.json();
          })
          .then(apps => {
            if (!apps.length) {
              throw new Error('No Search Results');
            }

            return apps[0].id;
          });
      })
      .then(appId => {
        return fetch(`https://apps-api.athom.com/api/v1/app/${appId}`);
      })
      .then(res => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }

        return res.json();
      })
      .then(appJSON => {
        const build = appJSON.liveBuild || appJSON.testBuild;
        if (!build) {
          throw new Error('Missing Build');
        }

        // Download Icon
        return fetch(build.icon)
          .then(res => {
            if (!res.ok) {
              throw new Error(res.statusText);
            }

            return res.text();
          })
          .then(icon => {
            return {
              appId: appJSON.id,
              icon,
              build,
            };
          });
      })
      .then(({ appId, build, icon }) => {
      // Create Icon Group
        const iconGroup = new Group({
          name: appId,
          parent: selectedArtboard,
          layers: [],
          frame: new Rectangle(0, 0, 128, 128),
        });

        // Create Circle
        const circleLayer = new ShapePath({
          name: 'Circle',
          shapeType: ShapePath.ShapeType.Oval,
          frame: new Rectangle(0, 0, 128, 128),
          style: {
            borders: [],
            fills: [{
              color: build.brandColor,
              fillType: Style.FillType.Color,
            }],
          },
        });
        iconGroup.layers.push(circleLayer);

        // Import SVG to Sketch
        // Source: https://github.com/tankxu/SVG-Insert/blob/master/src/svg-insert.js
        const svgString = NSString.stringWithString(icon);
        const svgData = svgString.dataUsingEncoding(NSUTF8StringEncoding);
        const svgImporter = MSSVGImporter.svgImporter();
        svgImporter.prepareToImportFromData(svgData);
        const svgNativeLayer = svgImporter.importAsLayer();
        svgNativeLayer.setName('SVG');
        iconGroup.layers.push(svgNativeLayer);

        // Scale SVG
        const svgLayer = iconGroup.layers.find(layer => layer.name === 'SVG');
        if (svgLayer.frame.width > svgLayer.frame.height) {
          svgLayer.frame.scale(80 / svgLayer.frame.width);
        } else {
          svgLayer.frame.scale(80 / svgLayer.frame.height);
        }

        svgLayer.frame.x = (128 - svgLayer.frame.width) / 2;
        svgLayer.frame.y = (128 - svgLayer.frame.height) / 2;

        // Set SVG Tint
        svgLayer.style.fills = [{
          fillType: sketch.Style.FillType.Color,
          color: '#ffffff',
        }];

        // Select Icon
        selectedArtboard.selected = false;
        iconGroup.selected = true;
      })
      .catch(err => {
        sketch.UI.message(err.message || err.toString());
      });
  });
};
