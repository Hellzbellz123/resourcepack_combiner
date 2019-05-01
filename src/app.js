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

const workingDirectory = path.join(app.getAppPath('temp'), 'temp');
const appData = app.getAppPath('appData');

const fsReadDir = promisify(fs.readdir);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

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
		if (files) {
			for (let file of files) {
				let resourcepack = resolveResourcepack(file);
				resourcepacks[resourcepack.id] = resourcepack;
			}
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

	console.log(`Start compiling resourcepack`);
	event.reply('response:compile:start');

	const resourceDirectory = path.join(workingDirectory, 'resource');
	const resultDirectory = path.join(workingDirectory, 'result');
	await del([path.join(workingDirectory, '**')]);
	mkdirp.sync(resourceDirectory);
	mkdirp.sync(resultDirectory);

	console.log(`Start unzipping resourcepacks`);
	let index = 0;
	let promises = [];
	for (let id in resourcepacks) {
		let resourcepack = resourcepacks[id];
		let source = resourcepack.path;
		let target = path.join(resourceDirectory, `${index}`);
		promises.push(unzipFile(source, target));
		index++;
	}

	await Promise.all(promises);
	promises = [];
	let data = [];
	let subdir = await fsReadDir(resourceDirectory);
	for (let dir of subdir) {
		let directory = path.join(resourceDirectory, dir);
		data.push(walkDirectory(directory, directory));
	}

	let messyList = [];
	for await (let element of data) {
		messyList.push(element);
	}

	console.log(`Start separating files`);
	let maxProgress = 0;
	let nonDupeList = {};
	let dupeList = {};
	for (let i = 0; i < messyList.length; i++) {
		let element = messyList[i];
		for (let id in element) {
			let item = element[id];
			let stat = isDuplicate(id, messyList, i);
			if (stat) {
				if (!dupeList[id]) {
					dupeList[id] = [];
				}
				dupeList[id].push(item);
				maxProgress += 1;
			}
			else {
				nonDupeList[id] = item;
				maxProgress += 1;
			}
		}
	}

	let currentProgress = {i: 0, event: event};
	event.reply('response:compile:init_length', maxProgress);

	console.log(`Start copying non-duplicate files`);
	for (let id in nonDupeList) {
		let file = nonDupeList[id];
		let source = file.path;
		let target = source.replace(file.from, resultDirectory);
		pipeFile(source, target, currentProgress);
	}

	console.log(`Start comparing duplicate files`);
	for (let id in dupeList) {
		let element = dupeList[id];
		for (let i = 0; i < element.length; i++) {
			let item = element[i];
			let source = item.path;
			let target = source.replace(item.from, resultDirectory);
			if (i > 0) {
				compareFile(source, target, currentProgress);
			}
			else {
				pipeFile(source, target, currentProgress);
			}
		}
	}
}

async function compareFile(source, target, progress) {
	let extension = getExtension(target);
	let src_data = fsReadFile(source).catch(error => null);
	let target_data = fsReadFile(target).catch(error => null);
	let data = await Promise.all([src_data, target_data]);
	let source_result, target_result;
	if (extension === 'json' || extension === 'mcmeta') {
		source_result = JSON.parse(data[0] == null ? '{}': data[0].toString());
		target_result = JSON.parse(data[1] == null ? '{}': data[1].toString());
		temp_data = {};
		temp_data = Object.assign(source_result, target_result);
		target_result = JSON.stringify(temp_data, null, 2);
	}
	else {
		if (data[1] === null) {
			data[1] = data[0];
		}
	}
	await fsWriteFile(target, data[1]).catch(console.trace);
	progress.i += 1;
	progress.event.reply('response:compile:update_count', progress.i);
	console.log(`[${progress.i}] Done comparing file from ${source} to ${target}`);
}

async function pipeFile(source, target, progress) {
	let directory = getDirectory(target);
	mkdirp.sync(directory);
	let sourceStream = fs.createReadStream(source);
	let targetStream = fs.createWriteStream(target);
	sourceStream.pipe(targetStream).on('close', () => {
		progress.i += 1;
		progress.event.reply('response:compile:update_count', progress.i);
		console.log(`[${progress.i}] Done piping file from ${source} to ${target}`);
	});
}

function getDirectory(file) {
	return file.match(/(.*)[\/\\]/g)[0];

}

function isDuplicate(id, data, ownIndex) {
	for (let i = 0; i < data.length; i++) {
		if (i !== ownIndex) {
			let element = data[i];
			if (id in element) {
				return true;
			}
		}
	}
	return false;
}

async function unzipFile(source, target) {
	console.log(`Unzipping file from ${source} to ${target}`);
	mkdirp.sync(target);
	return fs.createReadStream(source)
		.pipe(unzipper.Extract({path: target}))
		.promise();
}

async function walkDirectory(directory, rootDirectory) {
	let result = {};
	let fileStat = promisify(fs.stat);
	let files = await fsReadDir(directory);
	for (let file of files) {
		let filePath = path.join(directory, file);
		let stat = await fileStat(filePath);
		if (stat.isDirectory()) {
			let subdirectory = await walkDirectory(filePath, rootDirectory);
			for (let id in subdirectory) {
				let item = subdirectory[id];
				result[id] = item;
			}
		}
		else {
			let id = md5(filePath.replace(rootDirectory, ''));
			result[id] = {path: filePath, from: rootDirectory};
		}
	}
	return result;
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