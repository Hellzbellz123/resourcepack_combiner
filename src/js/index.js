const resourcepackDiv = document.getElementById('resourcepacks');
const addButton = document.getElementById('add-file');
const combineButton = document.getElementById('combine');
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