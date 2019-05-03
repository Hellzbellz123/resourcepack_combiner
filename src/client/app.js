const {app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const path = require('path');
const {autoUpdater} = require('electron-updater');

const workingDirectory = path.join(app.getPath('temp'), 'temp');
const appData = app.getAppPath();
module.exports.location = {workingDirectory: workingDirectory, appData: appData};

const resource = require('./resourcepack');

const isDarwin = (process.platform === 'darwin');
const isLinux = (process.platform === 'linux');

process.env.ENVIRONMENT = 'production';

let windows = {};
module.exports.windows = windows;
module.exports.dialog = dialog;

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

let mainMenuTemplate = [
	{
		label: 'Resourcepack Combiner'
	}
];

if (isDarwin) {
	mainMenuTemplate.unshift({});
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
	resource.addResourcepacks(event, data);
});

ipcMain.on('request:remove_resourcepack', (event, data) => {
	resource.removeResourcepack(event, data);
});

ipcMain.on('request:compile_resourcepack', (event, data) => {
	resource.preCompileResourcepack(event, data);
});

function sendStatus(channel, request, message) {
	if (channel) {
		channel.webContents.send(request, message);
	}
}

//autoUpdater.checkForUpdatesAndNotify();

/*
autoUpdater.on('checking-for-update', () => {
	sendStatus(windows['main'], 'request:autoupdater:checking', 'Checking for update...');
});

autoUpdater.on('update-available', info => {
	sendStatus(windows['main'], 'request:autoupdater:message', 'Update available');
});

autoUpdater.on('update-not-available', info => {
	sendStatus(windows['main'], 'request:autoupdater:message', 'Update not available');
});

autoUpdater.on('error', error => {
	sendStatus(windows['main'], 'request:autoupdater:error', `${error}`);
});

autoUpdater.on('download-progress', progress => {
	sendStatus(windows['main'], 'request:autoupdater:progress', `Downloading: ${progress.transferred}/${progress.total} ${progress.percent}% ${progress.bytesPerSecond}`);
});

autoUpdater.on('update-downloaded', info => {
	sendStatus(windows['main'], 'request:autoupdater:downloaded', 'Ready to update');
});

ipcMain.on('response:autoupdater:update', (event, data) => {

});
*/