const {app, BrowserWindow, Menu, ipcMain} = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const del = require('del');
const mkdirp = require('mkdirp');
const {promisify} = require('util');
const unzipper = require('unzipper');
const workingDirectory = '.temp';

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

let mainMenuTemplate = [
	{
		label: 'Developer',
		submenu: [
			{
				role: 'reload'
			},
			{
				role: 'toggleDevTools'
			}
		]
	}
]

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

ipcMain.on('request:compile', (event, data) => {
	compile(data);
})

async function compile(file_list) {
	mkdirp(path.join(__dirname, workingDirectory, 'resource'), error => {if (error) console.trace(error);});
	mkdirp(path.join(__dirname, workingDirectory, 'result'), error => {if (error) console.trace(error);});
	// * Check again just to be sure...
	const allowed_extension = ['zip', '7z'];
	let resultPath = path.join(__dirname, workingDirectory, 'result');
	let promises = [];
	let iteration = 0;
	let memory = [];
	for (let name in file_list) {
		let file = file_list[name];
		if (allowed_extension.includes(file.extension)) {
			memory.push({});
			let resourcePath = path.join(__dirname, workingDirectory, 'resource', `${iteration}`);
			await del.sync([`${resourcePath}/**`, `!${resourcePath}`]);
			await mkdirp(resourcePath, error => {if (error) console.trace(error);});
			
			fs.createReadStream(file.file)
				.pipe(unzipper.Extract({path: resourcePath}).on('close', async () => {
					walkAsync(resourcePath, {from: resourcePath, to: resultPath, iteration: iteration}, memory);
				}));
			iteration++;
		}
	}
}

async function walkAsync(src, target, memory) {
	let readDir = promisify(fs.readdir);
	let getFileStat = promisify(fs.stat);
	let mkdir = promisify(mkdirp);
	await mkdir(src.replace(target.from, target.to)).catch(error => {throw error});
	let files = await readDir(src).catch(error => {});
	files.forEach(async file => {
		let file_path = path.join(src, file);
		let target_path = file_path.replace(target.from, target.to);
		let stat = await getFileStat(target_path).catch(error => null);
		if (stat) {
			if (stat.isDirectory()) {
				walkAsync(file_path, target, memory);
			}
			else if (stat.isFile()) {
				readFile(file_path, target_path, target.iteration, memory);
			}
		}
	});
}

async function readFile(src, target, iteration, memory) {
	let readFile = promisify(fs.readFile);
	let src_data = await readFile(src).catch(error => null);
	let target_data = await readFile(target).catch(error => null);
	if (target_data === null) {
		target_data = src_data;
	}
	memory[iteration].src_data = src_data.toString();
	memory[iteration].target_data = target_data.toString();
	console.log(memory);
}

function jsonComparison(src, target) {
	let result = src;
	return result;
}

async function rmdirAsync(path, callback) {
	await fs.readdir(path, function(err, files) {
		if(err) {
			// Pass the error on to callback
			callback(err, []);
			return;
		}
		let wait = files.length,
		count = 0,
		folderDone = function(err) {
			count++;
			// If we cleaned out all the files, continue
			if( count >= wait || err) {
				fs.rmdir(path, callback);
			}
		};
		// Empty directory to bail early
		if(!wait) {
			folderDone();
			return;
		}
		
		// Remove one or more trailing slash to keep from doubling up
		path = path.replace(/\/+$/, "");
		files.forEach(file => {
			let curPath = `${path}/${file}`;
			fs.lstat(curPath, (err, stats) => {
				if(err) {
					callback(err, []);
					return;
				}
				if(stats.isDirectory()) {
					rmdirAsync(curPath, folderDone);
				} else {
					fs.unlink(curPath, folderDone);
				}
			});
		});
	});
};

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