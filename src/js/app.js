const {dialog} = require('electron').remote;
const {ipcRenderer} = require('electron');
const currentWindow = require('electron').remote.getCurrentWindow();
window.$ = window.Jquery = require('jquery');

let combinable = true;
/*
	'-_enc3_-home-_enc3_-boomber-_enc3_-programming-_enc3_-electron-_enc3_-resourcepack_combiner-_enc3_-test-_enc3_-a.zip': {
		file: '/home/boomber/programming/electron/resourcepack_combiner/test/a.zip',
		filename: 'a.zip',
		extension: '/home/boomber/programming/electron/resourcepack_combiner/test/a.zip'.match(/(?!\.)\w+$/g)[0]
	},
	'-_enc3_-home-_enc3_-boomber-_enc3_-programming-_enc3_-electron-_enc3_-resourcepack_combiner-_enc3_-test-_enc3_-b.zip': {
		file: "/home/boomber/programming/electron/resourcepack_combiner/test/b.zip",
		filename: "b.zip",
		extension: "zip"
	}
*/
let resourcepackList = {};
let resourcepackCount = 0;

$('#add-file').click(() => {
	dialog.showOpenDialog(currentWindow, {
		filters: [
			{name: 'Resourcepack File', extensions: ['zip', '7z']}
		], 
		properties: ['openFile', 'multiSelections']
	}, files => {
		if (files) {
			for (let file of files) {
				let filename = file.replace(/^.*[\\\/]/, '');
				resourcepackList[encoder(file)] = {filename: filename, file: file, extension: filename.match(/(?!\.)\w+$/g)[0]};
			}
		}
		updateList();
	});
});

$('#combine').click(() => {
	dialog.showSaveDialog(currentWindow, {filters: [{name: 'Zip File', extensions: ['zip']}]}, file => {
		if (file) {
			combining(file);
		}
	});
});

function combining(file) {
	if (combinable) {
		ipcRenderer.send('request:compile', {resourcepackList: resourcepackList, size: resourcepackCount, file: file});
		return true;
	}
	else {
		return false;
	}
}

function removeThis(id, name) {
	let resourcepacks = document.getElementById('resourcepacks');
	let element = resourcepacks.querySelector(`#${id}`);
	element.parentElement.removeChild(element);
	delete resourcepackList[name];
	updateList();
}

function updateList() {
	updateDom(resourcepackList);
}

function updateDom(list) {
	const template = `
		<div id='{id}'>
			<header><span id='filename'>{name}</span><span id='file'>{file}</span></header>
			<button onclick='removeThis("{id}", "{file_name}")'>❌</button>
		</div>
	`;
	let target = $('#resourcepacks');
	target.text('');

	resourcepackCount = 0;
	for (let key in list) {
		let item = list[key];
		if (item.filename.endsWith('.zip') || item.filename.endsWith('.7z')) {
			let encodedString = encoder(item.file);
			target.append(template.replace('{name}', item.filename).replace('{file}', item.file).replace('{file_name}', encodedString).replace(/{id}/g, encodedString.replace(/\./g, '-')));
		}

		resourcepackCount++;
	}
}

function encoder(string) {
	return string
		.replace(/\'/g, '-_enc1_-')
		.replace(/\"/g, '-_enc2_-')
		.replace(/\//g, '-_enc3_-')
		.replace(/\\/g, '-_enc4_-')
		.replace(/\[/g, '-_enc5_-')
		.replace(/\]/g, '-_enc6_-')
		.replace(/\+/g, '-_enc7_-')
		.replace(/\s/g, '-_enc8_-')
		.replace(/\:/g, '-_enc9_-')
}

function decoder(string) {
	return string
		.replace(/-_enc1_-/g, '\'')
		.replace(/-_enc2_-/g, '"')
		.replace(/-_enc3_-/g, '/')
		.replace(/-_enc4_-/g, '\\')
		.replace(/-_enc5_-/g, '[')
		.replace(/-_enc6_-/g, ']')
		.replace(/-_enc7_-/g, '+')
		.replace(/-_enc8_-/g, ' ')
		.replace(/-_enc9_-/g, ':')
}

updateList();

