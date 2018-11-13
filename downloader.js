const fs = require('fs');
const path = require('path');
const https = require('https');
const request = require('request');
const fse = require('fs.extra');
const express = require('express');
const app = express();

const logger = require('tracer').console({
    format : '{{timestamp}} <{{title}}> {{file}}:{{line}} {{message}}',
    dateformat : 'yyyy-mm-dd HH:MM:ss.l'
});

const config = require('./config');

const tempFolder = 'temp';
const doneFolder = 'done';

const authHeader = 'Basic ' + new Buffer(config.scihubUsername + ':' + config.scihubPassword).toString('base64');

const filterParams = config.filterParams;

try {
    fse.mkdirpSync(doneFolder);
    fse.mkdirpSync(tempFolder);
} catch(e) {
    throw e;
}

/**
 *
 * @enum {String}
 */
const Status = {
    ACTIVE: 'ACTIVE',
    DONE: 'DONE'
};

/**
 *
 * @name ProductProgress
 * @type {object}
 * @property {number} size
 * @property {number} bytesWritten
 */

/**
 *
 * @name ProductStatus
 * @type {object}
 * @property {Status} status
 * @property {ProductProgress} progress
 */

let currentList = [];

/**
 *
 * @type {ProductStatus[]}
 */
let statuses = [];

app.get('/status', (req, res) => {
    let info = [];

    for (let i = 0; i < statuses.length; i++) {
        info.push({
            product: currentList[i].identifier,
            status: statuses[i]
        });
    }

    res.send(info);
});

app.use(express.static('public'));

app.listen(3010, () => logger.log('Listening on port 3010'));

const limit = 10;
const concurrentLimit = 2;
let currentOffset = 0;
let doneCount = 0;
let activeCount = 0;
let totalCount = 0;

getList();

function increaseDone() {
    doneCount++;
    activeCount--;

    logger.log('doneCount', doneCount);

    if (doneCount >= totalCount) {
        logger.log('ALL DONE');
        return;
    }

    if (doneCount + activeCount >= currentOffset + limit) {
        getNextList();
    } else if (activeCount < concurrentLimit) {
        processNextItem();
    }
}

function increaseActive() {
    activeCount++;

    logger.log('activeCount', activeCount);

    if (activeCount < concurrentLimit) {
        processNextItem();
    }
}

function getList() {
    logger.log('getList', currentOffset, limit);

    getProductsList(filterParams, currentOffset, limit, function (error, result) {
        logger.log('totalresults', result.totalresults);

		totalCount = result.totalresults;

        currentList = currentList.concat(result.products);

        processNextItem();
    });
}

function getNextList() {
    currentOffset += limit;

    getList();
}

function processNextItem() {
    let indexInList = -1;

    for (let i = 0; i < currentList.length; i++) {
        if (!statuses[i]) {
            indexInList = i;
            break;
        }
    }

    const item = currentList[indexInList];

    logger.log('processNextItem', indexInList);

    if (!item) {
        logger.error('No item at', indexInList);
        return;
    }

    statuses[indexInList] = {
        status: Status.ACTIVE,
        progress: {
            size: 0,
            bytesWritten: 0
        }
    };

    const fileName = item.identifier + '.zip';

    increaseActive();

    function onProgress(fileProgress) {
        statuses[indexInList].progress.size = fileProgress.size;
        statuses[indexInList].progress.bytesWritten = fileProgress.bytesWritten;
    }

    function onDone() {
        statuses[indexInList].status = Status.DONE;

        fse.move(path.join(tempFolder, fileName), path.join(doneFolder, fileName), function (error) {
            if (error) {
                logger.log(error);
            }

            increaseDone();
        });
    }

    download(item.uuid, fileName, onProgress, onDone);
}

function getProductsList(filterParams, offset, limit, callback) {
    const options = {
        url: `https://scihub.copernicus.eu/dhus/api/stub/products?filter=${encodeURIComponent(filterParams)}
        &offset=${offset}&limit=${limit}&sortedby=ingestiondate&order=desc&format=json`,
        headers: {
            'Authorization': authHeader
        }
    };

    request(options, (error, response, body) => {
        if (error) {
            logger.error(error);
            callback(error);
        } else {
            if (response.statusCode === 200) {
                //logger.log(body);
                callback(null, JSON.parse(body));
            } else {
                logger.log('statusCode:', response.statusCode);
                logger.log('headers:', response.headers);
                callback('Could not get product list');
            }
        }
    });
}

function download(productUUID, fileName, progressCallback, doneCallback) {
    logger.log('Download: ' + productUUID);

    fs.stat(path.join(doneFolder, fileName), (error, stats) => {
        if (error) {
            logger.error(error);

            if (error.code = 'ENOENT') {
                startDownload();
            } else {
                doneCallback(error);
            }
        } else {
            logger.log(stats.size);

            progressCallback({
                size: stats.size,
                bytesWritten: stats.size
            });

            doneCallback();
        }
    });

    function startDownload() {
        const file = fs.createWriteStream(path.join(tempFolder, fileName));
        let size = 0;

        function updateProgress() {
            progressCallback({
                size: size,
                bytesWritten: file.bytesWritten
            });
        }

        const options = {
            host: 'scihub.copernicus.eu',
            path: `/dhus/odata/v1/Products('${productUUID}')/$value`,
            headers: {
                'Authorization': authHeader
            }
        };

        https.get(options, (response) => {
            logger.log('statusCode:', response.statusCode);
            logger.log('headers:', response.headers);
            logger.log('response.headers[\'content-length\']', response.headers['content-length']);

            size = parseInt(response.headers['content-length']);

            response.pipe(file);

            let progressUpdateInterval = setInterval(function () {
                logger.log((file.bytesWritten / (1024 * 1024)).toFixed(2), (file.bytesWritten / size * 100).toFixed(1) + '%');
                updateProgress();
            }, 1000);

            file.on('close', function () {
                clearInterval(progressUpdateInterval);
                updateProgress();
                doneCallback();
            });

        }).on('error', (e) => {
            logger.error(e);
            doneCallback(e);
        });
    }
}