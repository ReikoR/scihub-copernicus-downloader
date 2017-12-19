## Setup
1. Install [https://nodejs.org/en/](node.js)
2. Run `npm install` in project folder to install dependencies.
3. Create config_.js in project folder.
4. Add username, password and filter string to config_.js.
Filter string can be copied from https://scihub.copernicus.eu after pressing the search button.
```javascript
let config = require('./config-base');

config.scihubUsername = 'REPLACE_WITH_YOUR_USERNAME';
config.scihubPassword = 'REPLACE_WITH_YOUR_PASSWORD';
config.filterParams = `( footprint:"Intersects(POLYGON((26.07494862130891 58.05606793353607,26.280193062282713 58.44113096364097,25.798314809561607 58.424780694706584,26.07494862130891 58.05606793353607,26.07494862130891 58.05606793353607)))") AND ( beginPosition:[2017-07-01T00:00:00.000Z TO 2017-07-31T23:59:59.999Z] AND endPosition:[2017-07-01T00:00:00.000Z TO 2017-07-31T23:59:59.999Z] ) AND (platformname:Sentinel-2 AND producttype:S2MSI1C)`;

module.exports = config;
```

## Usage

1. Run `node downloader.js` to start downloader.
2. Open `localhost:3010` to see progress.