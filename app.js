const {app, BrowserWindow, Menu, ipcMain} = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const del = require('del');
const mkdirp = require('mkdirp');
const {promisify} = require('util');
const unzipper = require('unzipper');
const archiver = require('archiver');
const workingDirectory = path.join(__dirname.replace('app.asar', ''), '.temp');

let windows = {};

app.on('ready', () => {
	let mainWin = createWindow('main', mainMenuTemplate, '/src/html/app.html', {
		minHeight: 300,
		minWidth: 300,
		webPreferences: {nodeIntegration: true}
	});
	mainWin.on('closed', () => {
		app.quit();
	});
});

let mainMenuTemplate = [];

function createWindow(name, menu, file, properties, hidden = false) {
	if(!windows[name]) {
		windows[name] = new BrowserWindow(properties);
		windows[name].loadURL(url.format({
			pathname: path.join(__dirname, file),
			protocol: 'file',
			slashes: true
		}));
		if (!hidden) {
			windows[name].on('ready-to-show', () => {
				windows[name].show();
			});
		}
		windows[name].on('closed', () => {
			windows[name] = null;
		});
		windows[name].setMenu(menu === null ? menu: Menu.buildFromTemplate(process.platform === 'darwin' ? menu.unshift({}): menu));
		return windows[name];
	}
	return null;
}

ipcMain.on('request:compile', async (event, data) => {
	compile(data['resourcepackList'], data['size'], data['file']);
})

async function compile(file_list, size, file_name) {
	await del.sync([`${path.join(workingDirectory)}/**`]);
	
	mkdirp(path.join(workingDirectory, 'resource'), error => {if (error) console.trace(error);});
	mkdirp(path.join(workingDirectory, 'result'), error => {if (error) console.trace(error);});
	// * Check again just to be sure...
	const allowed_extension = ['zip', '7z'];
	let resultPath = path.join(workingDirectory, 'result');
	let promises = [];
	let iteration = 0;
	let memory = [];
	for (let name in file_list) {
		let file = file_list[name];
		if (allowed_extension.includes(file.extension)) {
			memory.push({});
			let resourcePath = path.join(workingDirectory, 'resource', `${iteration}`);
			await mkdirp(resourcePath, error => {if (error) console.trace(error);});
			
			fs.createReadStream(file.file)
			.pipe(unzipper.Extract({path: resourcePath}).on('close', async () => {
				promises = [];
				promises.push(walkAsync(resourcePath, {from: resourcePath, to: resultPath, iteration: iteration}, memory));
				await Promise.all(promises);
				iteration++;
				if (iteration >= size) {
					zipped(file_name, resultPath);
				}
			}));
		}
	}
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
	let readDir = promisify(fs.readdir);
	let getFileStat = promisify(fs.stat);
	let mkdir = promisify(mkdirp);
	await mkdir(src.replace(target.from, target.to)).catch(error => {throw error});
	let files = await readDir(src).catch(error => {});

	let promise = [];

	for (let file of files) {
		let file_path = path.join(src, file);
		let target_path = file_path.replace(target.from, target.to);
		let stat = await getFileStat(file_path).catch(error => error);
		if (stat) {
			if (stat.isDirectory()) {
				promise.push(walkAsync(file_path, target, memory));
			}
			else if (stat.isFile()) {
				promise.push(compare(file_path, target_path, target, memory));
			}
		}
	}

	return Promise.all(promise);
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
	await writeFile(target_path, target_data, {encoding: 'utf8', flag: 'w'}).catch(console.trace);
	return true;
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