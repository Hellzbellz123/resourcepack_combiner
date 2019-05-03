const resourcepackDiv = document.getElementById('resourcepacks');
const addButton = document.getElementById('add-file');
const combineButton = document.getElementById('combine');
const progressBar = document.getElementById('loader');
const {ipcRenderer} = require('electron');

addButton.addEventListener('click', event => {
	ipcRenderer.send('request:add_resourcepack', 'main');
});

combineButton.addEventListener('click', event => {
	ipcRenderer.send('request:compile_resourcepack', 'main')
});

ipcRenderer.on('response:update_resourcepack', (event, data) => {
	updateResourcepackList(data);
});

ipcRenderer.on('response:compile:start', () => {
	enableProgressBar();
});

ipcRenderer.on('response:compile:end', () => {
	disableProgressBar();
});

ipcRenderer.on('response:compile:update', (event, data) => {
	updateProgressBar(data);
});

function enableProgressBar() {
	const info = progressBar.querySelector('#loader_information');
	const progress = progressBar.querySelector('.progress');

	progressBar.style.display = 'flex';

	info.innerText = '';
	progress.style.width = '0%';
}

function disableProgressBar() {
	progressBar.style.display = 'none';
}

function updateProgressBar(data) {
	const info = progressBar.querySelector('#loader_information');
	const progress = progressBar.querySelector('.progress');

	info.innerText = data.message;
	progress.style.width = `${(data.current/data.max) * 100}%`;
}

function updateResourcepackList(resourcepacks) {
	resourcepackDiv.innerHTML = '';
	for (let id in resourcepacks) {
		const resourcepack = resourcepacks[id];
		const resourcepackTemplate = 
		`<div id='${resourcepack.id}'>
			<header>${resourcepack.name}</header>
			<section>${resourcepack.path}</section>
			<footer>
				<button id='remove' class='x-button' onclick='removeThis("${resourcepack.id}")'>❌</button>
			</footer>
		</div>`;
		resourcepackDiv.innerHTML += resourcepackTemplate;
	}
}

function removeThis(id) {
	ipcRenderer.send('request:remove_resourcepack', id);
}

ipcRenderer.on('request:autoupdater:checking', (event, data) => {
	console.log(data);
});

ipcRenderer.on('request:autoupdater:message', (event, data) => {
	console.log(data);
});

ipcRenderer.on('request:autoupdater:error', (event, data) => {
	console.log(data);
});

ipcRenderer.on('request:autoupdater:progress', (event, data) => {
	console.log(data);
});

ipcRenderer.on('request:autoupdater:downloaded', (event, data) => {
	console.log(data);
});
