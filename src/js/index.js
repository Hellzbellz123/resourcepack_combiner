const resourcepackDiv = document.getElementById('resourcepacks');
const addButton = document.getElementById('add-file');
const combineButton = document.getElementById('combine');
const progressBar = document.getElementById('loader');
const {ipcRenderer} = require('electron');

let maxProgress = 0;
let currentProgress = 0;

addButton.addEventListener('click', event => {
	ipcRenderer.send('request:add_resourcepack', 'main');
});

combineButton.addEventListener('click', event => {
	ipcRenderer.send('request:compile_resourcepack', 'main')
});

ipcRenderer.on('response:update_resourcepack', (event, data) => {
	updateResourcepackList(data);
});

ipcRenderer.on('response:compile:init_length', (event, data) => {
	enableProgressBar(data);
});

ipcRenderer.on('response:compile:update_count', (event, data) => {
	currentProgress = data;
	console.log(data);
	updateProgressBar();
});

function enableProgressBar(i) {
	progressBar.style.display = 'flex';
	maxProgress = i;
	currentProgress = 0;
	updateProgressBar();
}

function disableProgressBar() {
	progressBar.style.display = 'none';
	maxProgress = 0;
	currentProgress = 0;
}

function updateProgressBar() {
	const info = progressBar.querySelector('#loader_information');
	const outer = progressBar.querySelector('.loading_container');
	const inner = progressBar.querySelector('.progress');

	info.innerText = `${currentProgress}/${maxProgress}`;
	
	let outerWidth = outer.offsetWidth;
	let innerWidth = currentProgress/maxProgress;

	inner.style.width = innerWidth * outerWidth;

	if (currentProgress === maxProgress) {
		disableProgressBar();
	}
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