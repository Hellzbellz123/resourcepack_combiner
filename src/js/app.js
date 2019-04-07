const {dialog} = require('electron').remote;
const {ipcRenderer} = require('electron');
const currentWindow = require('electron').remote.getCurrentWindow();
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
window.$ = window.Jquery = require('jquery');

let combinable = true;
let resourcepackList = {
	'-_enc3_-home-_enc3_-boomber-_enc3_-programming-_enc3_-electron-_enc3_-resourcepack_combiner-_enc3_-test-_enc3_-a-_enc3_-hello.zip': {
		file: '/home/boomber/programming/electron/resourcepack_combiner/test/a/hello.zip',
		filename: 'hello.zip',
		extension: '/home/boomber/programming/electron/resourcepack_combiner/test/a/hello.zip'.match(/(?!\.)\w+$/g)[0]
	}
};

$('#add-file').click(() => {
	dialog.showOpenDialog(currentWindow, {
		filters: [
			{name: 'Resourcepack File', extensions: ['zip', '7z', 'gz']}
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

$('#resourcepack-name').on('input', () => {
	if ($('#resourcepack-name').val().replace(/[ '\n]/g, '').length) {
		combinable = true;
		$('#combine').removeClass('disable-click');
	}
	else {
		combinable = false
		$('#combine').addClass('disable-click');
	}
});

$('#combine').click(() => {
	combining();
});

function combining() {
	if (combinable) {
		ipcRenderer.send('request:compile', resourcepackList);
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

	for (let key in list) {
		let item = list[key];
		if (item.filename.endsWith('.zip') || item.filename.endsWith('.7zip') || item.filename.endsWith('.gz')) {
			let encodedString = encoder(item.file);
			target.append(template.replace('{name}', item.filename).replace('{file}', item.file).replace('{file_name}', encodedString).replace(/{id}/g, encodedString.replace(/\./g, '-')));
		}
	}
}

function encoder(string) {
	return string
		.replace(/'/g, '-_enc1_-')
		.replace(/"/g, '-_enc2_-')
		.replace(/\//g, '-_enc3_-')
		.replace(/\\/g, '-_enc4_-')
		.replace(/\[/g, '-_enc5_-')
		.replace(/]/g, '-_enc6_-')
		.replace(/\+/g, '-_enc7_-')
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
}

updateList();

