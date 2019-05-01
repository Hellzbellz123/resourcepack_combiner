const {app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const del = require('del');
const mkdirp = require('mkdirp');
const {promisify} = require('util');
const unzipper = require('unzipper');
const archiver = require('archiver');
const md5 = require('md5');
const isDarwin = (process.platform === 'darwin');
const isLinux = (process.platform === 'linux');

const workingDirectory = app.getAppPath('temp');
const appData = app.getAppPath('appData');

console.log(workingDirectory);

process.env.ENVIRONMENT = 'development';

let windows = {};

app.on('ready', () => {
	let mainWin = createWindow('main', mainMenuTemplate, '/src/html/index.html', {
		minHeight: 300,
		minWidth: 300,
		webPreferences: {nodeIntegration: true}
	});
	mainWin.on('closed', () => {
		app.quit();
	});
});

app.on('window-all-closed', () => {
	if (!isDarwin) {
		app.quit();
	}
});

let mainMenuTemplate = [];

if (isDarwin) {
	mainMenuTemplate = [{}, {label: 'Resourcepack Combiner'}];
}

if (isLinux) {
	app.disableHardwareAcceleration();
}

if (process.env.ENVIRONMENT !== 'production') {
	mainMenuTemplate.push({
		'label': 'Developer',
		'submenu': [
			{
				role: 'reload'
			},
			{
				role: 'toggleDevTools'
			}
		]
	})
}

function createWindow(name, menu, file, properties, hidden = false) {
	if(!windows[name]) {
		windows[name] = new BrowserWindow(properties);
		windows[name].loadFile(path.join(appData, file));
		if (!hidden) {
			windows[name].on('ready-to-show', () => {
				windows[name].show();
			});
		}
		windows[name].on('closed', () => {
			windows[name] = null;
		});
		if (menu !== null) {
			windows[name].setMenu(menu === [] ? null: Menu.buildFromTemplate(menu));
		}

		return windows[name];
	}
	return null;
}

ipcMain.on('message:message', (event, message) => {
	console.log(message);
})

ipcMain.on('message:error', (event, error) => {
	if (error) throw error;
})

ipcMain.on('request:add_resourcepack', (event, data) => {
	addResourcepacks(event, data);
});

ipcMain.on('request:remove_resourcepack', (event, data) => {
	removeResourcepack(event, data);
});

ipcMain.on('request:compile_resourcepack', (event, data) => {
	compileResourcepack(event);
});

let resourcepacks = {};

function addResourcepacks(event, windowName) {
	dialog.showOpenDialog(windows[windowName], {
		title: 'Resourcepack Combiner',
		filters: [
			{name: 'Resourcepack Files', extensions: ['zip']}
		],
		properties: ['openFile', 'multiSelections']
	}, files => {
		for (let file of files) {
			let resourcepack = resolveResourcepack(file);
			resourcepacks[resourcepack.id] = resourcepack;
		}
		event.reply('response:update_resourcepack', resourcepacks);
	});
}

function removeResourcepack(event, id) {
	delete resourcepacks[id];
	event.reply('response:update_resourcepack', resourcepacks);
}

function resolveResourcepack(file) {
	// want id, name, path, extension
	return {
		id: md5(file),
		name: file.replace(/^.*[\\\/]/, ''),
		path: file,
		extension: file.match(/(?!\.)\w+$/g)[0]
	};
}

async function compileResourcepack(event) {
	//await del([path.join(workingDirectory, '**'), `!${workingDirectory}`]);
	mkdirp(workingDirectory);
}

function zipped(file_name, file_path) {
	if (file_name === '' || file_name === null || file_name === undefined) {
		file_name = './resourcepack_combiner.zip';
	}
	let zip = archiver('zip');
	let output = fs.createWriteStream(file_name);

	output.on('close', () => {
		console.log(`${zip.pointer()} total bytes`);
		del.sync([`${path.join(workingDirectory)}/**`]);
	});

	zip.on('error', error => {
		throw error;
	});

	zip.pipe(output);
	zip.directory(file_path, '');
	zip.finalize();
}

async function walkAsync(src, target, memory) {

}

async function compare(src_path, target_path, target, memory) {
	let readFile = promisify(fs.readFile);
	let writeFile = promisify(fs.writeFile);
	let extension = getExtension(target_path);
	let src_data = await readFile(src_path).catch(error => null);
	let target_data = await readFile(target_path).catch(error => null);
	if (extension === 'json' || extension === 'mcmeta') {
		src_data = JSON.parse(src_data == null ? '{}': src_data.toString());
		target_data = JSON.parse(target_data == null ? '{}': target_data.toString());
		temp_data = {};
		temp_data = Object.assign(target_data, src_data);
		target_data = JSON.stringify(temp_data, null, 2);
	}
	else {
		if (target_data === null) {
			target_data = src_data;
		}
	}
	//console.log(target_path);
	let promise = writeFile(target_path, target_data, {encoding: 'utf8', flag: 'w'}).catch(console.trace);
	return promise;
}

function getExtension(path) {
	let split = path.split('.');
	return split[split.length - 1];
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