const app = require('./app');
const path = require('path');
const fs = require('fs');
const del = require('del');
const mkdirp = require('mkdirp');
const {promisify} = require('util');
const unzipper = require('unzipper');
const archiver = require('archiver');
const md5 = require('md5');

const fsReadDir = promisify(fs.readdir);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

const workingDirectory = app.location.workingDirectory;

let resourcepacks = {};

let preCompileResourcepack = function(event, data) {
	app.dialog.showSaveDialog(app.windows[data], {
		title: 'Resourcepack Combiner',
		filters: [
			{name: 'Resourcepack Files', extensions: ['zip']}
		]
	}, filename => {
		if (filename) {
			compileResourcepack(filename, event);
		}
	});
}

let addResourcepacks = function(event, windowName) {
	app.dialog.showOpenDialog(app.windows[windowName], {
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

let removeResourcepack = function(event, id) {
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

let compileResourcepack = async function(file, event) {

	// Hand out event object to other functions
	// Also use to sync 'current' and 'max' value
	let progress = {current: 0, max: 0, event: event};

	// Display progress bar
	event.reply('response:compile:start', {message: 'Setting thing up...', current: 0, max: 0});

	const resourceDirectory = path.join(workingDirectory, 'resource');
	const resultDirectory = path.join(workingDirectory, 'result');
	await del([path.join(workingDirectory, '**')], {force: true});
	mkdirp.sync(resourceDirectory);
	mkdirp.sync(resultDirectory);

	let index = 0;
	let promises = [];

	progress.max = Object.keys(resourcepacks).length;

	// Unzipping file...
	event.reply('response:compile:update', {message: 'Unzipping file...', current: progress.current, max: progress.max});

	for (let id in resourcepacks) {
		let resourcepack = resourcepacks[id];
		let source = resourcepack.path;
		let target = path.join(resourceDirectory, `${index}`);
		promises.push(unzipFile(source, target, progress));
		index++;
	}

	// Wait for all unzipper to unzip files
	await Promise.all(promises);

	// loop through each "resource" directory and walk over them
	let data = [];
	let subdir = await fsReadDir(resourceDirectory);
	for (let dir of subdir) {
		let directory = path.join(resourceDirectory, dir);
		data.push(walkDirectory(directory, directory));
	}

	// Wait for everything to finish walking
	let messyList = [];
	for await (let element of data) {
		messyList.push(element);
	}

	// Ordering files
	event.reply('response:compile:update', {message: 'Ordering files...', current: 1, max: 1});

	let nonDupeList = {};
	let dupeList = {};

	progress.max = 0;

	// Go through each "resource index" and check if file is duplicated
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
				progress.max += 1;
			}
			else {
				nonDupeList[id] = item;
				progress.max += 1;
			}
		}
	}

	// Comparing files...
	event.reply('response:compile:update', {message: 'Comparing files...', current: 1, max: 1});

	// Loop through non-duplicate list and copy them to "result" first
	for (let id in nonDupeList) {
		let file = nonDupeList[id];
		let source = file.path;
		let target = source.replace(file.from, resultDirectory);
		pipeFile(source, target, progress);
	}

	// Loop through duplicate list, copy the first element and compare other elements with the first
	promises = [];
	for (let id in dupeList) {
		let element = dupeList[id];
		let localPromise;
		for (let i = 0; i < element.length; i++) {
			await localPromise;
			localPromise = null;
			let item = element[i];
			let source = item.path;
			let target = source.replace(item.from, resultDirectory);
			if (i > 0) {
				let p = compareFile(source, target, progress);
				promises.push(p);
				localPromise = p;
			}
			else {
				let p = pipeFile(source, target, progress);
				promises.push(p);
				localPromise = p;
			}
		}
	}

	// Wait for everything to finish
	await Promise.all(promises);

	// Clear message
	event.reply('response:compile:update', {message: '', current: 0, max: 0});

	// Zipping files
	zipFile(resultDirectory, file, progress);
}

let compareFile = async function(source, target, progress) {
	let extension = getExtension(target);
	let src_data = fsReadFile(source).catch(console.log);
	let target_data = fsReadFile(target).catch(console.log);
	let data = await Promise.all([src_data, target_data]);

	let source_result, target_result;
	if (extension === 'json' || extension === 'mcmeta') {

			console.log(`[${progress.current}/${progress.max}] Comparing ${source} to ${target}`);
			console.log(`source: ${data[0].toString()}`);
			console.log(`target: ${data[1].toString()}`);

			let source_file = !data[0] ? '': data[0].toString();
			let target_file = !data[1] ? '': data[1].toString();
			source_result = JSON.parse(!source_file ? '{}': source_file);
			target_result = JSON.parse(!target_file ? '{}': target_file);
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
	progress.current += 1;
	progress.event.reply('response:compile:update', {message: `File Comparison - ${progress.current}/${progress.max}`, current: progress.current, max: progress.max});
	return true;
}

let pipeFile = async function(source, target, progress) {
	let directory = getDirectory(target);
	mkdirp.sync(directory);
	let sourceStream = fs.createReadStream(source);
	let targetStream = fs.createWriteStream(target);
	return sourceStream.pipe(targetStream).on('close', () => {
		progress.current += 1;
		progress.event.reply('response:compile:update', {message: `File Comparison - ${progress.current}/${progress.max}`, current: progress.current, max: progress.max});
		return true;
	});
}

let getDirectory = function(file) {
	return file.match(/(.*)[\/\\]/g)[0];

}

let isDuplicate = function(id, data, ownIndex) {
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

let unzipFile = async function(source, target, progress) {
	mkdirp.sync(target);
	return fs.createReadStream(source)
		.pipe(unzipper.Extract({path: target}))
		.on('close', () => {
			progress.current += 1;
			progress.event.reply('response:compile:update', {message: `Unzipping File - ${progress.current}/${progress.max}`, current: progress.current, max: progress.max})
		})
		.promise();
}

let walkDirectory = async function(directory, rootDirectory) {
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

let zipFile = function(source, target, progress) {
	if (target === '' || target === null || target === undefined) {
		target = 'resourcepack_combiner.zip';
	}

	progress.event.reply('response:compile:update', {message: 'Start zipping files...', current: 0, max: 0});

	let zipper = archiver('zip', {
		zlib: {level: 9}
	});
	let stream = fs.createWriteStream(target);

	stream.on('close', () => {
		progress.event.reply('response:compile:update', {message: zipper.pointer(), current: 1, max: 1});
		console.log(`${zipper.pointer()} total bytes`);
		progress.event.reply('response:compile:end');
		del([`${path.join(workingDirectory, '**')}`], {force: true});
	});

	zipper.on('error', error => {
		throw error;
	});

	zipper.on('progress', p => {
		progress.event.reply('response:compile:update', {message: `Zipping File - ${p.entries.processed}/${p.entries.total}`, current: p.entries.processed, max: p.entries.total});
	});

	zipper.pipe(stream);
	zipper.directory(source, '');
	zipper.finalize();
}

let getExtension = function(path) {
	let split = path.split('.');
	return split[split.length - 1];
}

module.exports = {
	addResourcepacks: addResourcepacks,
	removeResourcepack: removeResourcepack,
	preCompileResourcepack: preCompileResourcepack,
	getDirectory: getDirectory,
	getExtension: getExtension,
	zipFile: zipFile,
	compileResourcepack: compileResourcepack,
	compareFile: compareFile,
	pipeFile: pipeFile,
	isDuplicate: isDuplicate,
	walkDirectory: walkDirectory,
	unzipFile: unzipFile
};