setInterval(() => {
    getStatuses().then((statuses) => {
        showStatuses(statuses);
    })
}, 1000);

function getStatuses() {
    return fetch('/status').then(function(response) {
        return response.json();
    }).then(function (statuses) {
        return statuses;
    });
}

function showStatuses(statuses) {
    console.log('showStatuses', statuses);

    const container = document.getElementById('statuses');
    container.innerHTML = '';

    for (let i = 0; i < statuses.length; i++) {
        const status = document.createElement('div');
        status.classList.add('status');

        const bytesWritten = statuses[i].status.progress.bytesWritten;
        const size = statuses[i].status.progress.size;

        status.innerHTML = `<span class="name">${statuses[i].product}</span>
        <span class="percent">${(size === 0 ? 0 : (bytesWritten / size * 100)).toFixed(1)}%</span>
        <span class="size">${humanFileSize(bytesWritten)} / ${humanFileSize(size)}</span>`;

        container.appendChild(status);
    }
}

function humanFileSize(bytes, si) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

    let u = -1;

    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);

    return bytes.toFixed(2) + ' ' + units[u];
}