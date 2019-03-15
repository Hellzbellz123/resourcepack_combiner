import sys
import os
import zipfile
import shutil
import re
import json
from random import randint

# TODO: A LOT OF COMMENTS NEEDED

path_data = (
	[x.replace('\\', '/') for x in sys.argv[1:-1] if os.path.isfile(x) and x.endswith(('.zip', '.gz'))],
	[re.sub(r'(\.\/)|(\/|\w+\/\b)|(\.zip$)|(\.gz$)', '', x) for x in sys.argv[1:-1] if os.path.isfile(x) and x.endswith(('.zip', '.gz'))]
)

path_directory = (
	[x + y for x in sys.argv[1:-1] if os.path.isdir(x) for y in os.listdir(x) if os.path.isdir(x + y) and 'pack.mcmeta' in os.listdir(x + y)] + 
	[x + y for x in sys.argv[1:-1] if os.path.isdir(x) for y in os.listdir(x) if os.path.isfile(x + y) and y.endswith(('.zip', '.gz'))],
	[y for x in sys.argv[1:-1] if os.path.isdir(x) for y in os.listdir(x) if os.path.isdir(x + y) and 'pack.mcmeta' in os.listdir(x + y)] + 
	[re.sub(r'(\.\/)|(\/|\w+\/\b)|(\.zip$)|(\.gz$)', '', y) for x in sys.argv[1:-1] if os.path.isdir(x) for y in os.listdir(x) if os.path.isfile(x + y) and y.endswith(('.zip', '.gz'))]
)

paths = (path_data[0] + path_directory[0], path_data[1] + path_directory[1])

output_name = sys.argv[len(sys.argv)-1]

def copyDirectory(src, dest):
	try:
		shutil.copytree(src, dest)
		# Directories are the same
	except shutil.Error as e:
		print('Directory not copied. Error: %s' % e)
	# Any error saying that the directory doesn't exist
	except OSError as e:
		print('Directory not copied. Error: %s' % e)

def check_path(path):
	dir = '/'.join([x for x in path.replace('\\', '/').split('/') if '.' not in x])
	try:
		if not os.path.exists(dir):
			os.makedirs(dir)
	except:
		pass
	return path

def create_file(path):
	return open(check_path(path), 'w')

def create_folder(path):
	if not os.path.exists(path):
		os.makedirs(path)
	return path

def nested_json(data, merger):
	if type(merger) is dict:
		result = {}
		for key in merger:
			if key in data:
				result[key] = nested_json(data[key], merger[key])
			else:
				result[key] = merger[key]
		return result
	elif type(merger) is list:
		return data + merger
	else:
		return merger

def merge_json(data, merger):
	result = nested_json(data, merger)
	return result

def builder(file, filename, conflicts, extension):
	for (path, dir, files) in os.walk('./temp/'):
		path = path.replace('./temp/', '')
		for file in files:
			if file.endswith(extension['text']):
				if not os.path.exists('./output/' + output_name + '/' + path + '/' + file):
					with create_file('./output/' + output_name + '/' + path + '/' + file) as f:
						f.write(open('./temp/' + path + '/' + file).read())
				else:
					conflicts.append('Conflict found in: [./output/' + output_name + '/' + path + '/' + file + '] will try to merge conflict')
					conflicted_file = open('./output/' + output_name + '/' + path + '/' + file).read()
					if file.endswith('.json'):
						with create_file('./output/' + output_name + '/' + path + '/' + file) as f:
							a = merge_json(json.loads(conflicted_file), json.load(open('./temp/' + path + '/' + file)))

							f.write(json.dumps(a, indent=4))

			elif file.endswith(extension['image']):
				if not os.path.exists('./output/' + output_name + '/' + path + '/' + file):
					create_folder('./output/' + output_name + '/' + path + '/')
					shutil.copyfile('./temp/' + path + '/' + file, './output/' + output_name + '/' + path + '/' + file)
				else:
					conflicts.append('Conflict found in: [./output/' + output_name + '/' + path + '/' + file + '] cannot merge this file')
			elif file.endswith(extension['sound']):
				if not os.path.exists('./output/' + output_name + '/' + path + '/' + file):
					create_folder('./output/' + output_name + '/' + path + '/')
					shutil.copyfile('./temp/' + path + '/' + file, './output/' + output_name + '/' + path + '/' + file)
				else:
					conflicts.append('Conflict found in: [./output/' + output_name + '/' + path + '/' + file + '] cannot merge this file')
	return conflicts

def run():
	create_folder('./output/' + output_name + '/')
	extension = {'text': ('.json', '.mcmeta'), 'image': ('.png', '.jpeg'), 'sound': ('.ogg')}
	conflicts = []
	
	if os.path.exists('./output/' + output_name):
		shutil.rmtree('./output/' + output_name)

	for (file, filename) in zip(paths[0], paths[1]):
		if os.path.exists('./temp/'):
			shutil.rmtree('./temp/')
		if os.path.isfile(file):
			create_folder('./temp/')
			f_zip = zipfile.ZipFile(file, 'r')
			f_zip.extractall('./temp/')
			f_zip.close()
			conflicts = builder(file, filename, conflicts, extension)
		elif os.path.isdir(file):
			#create_folder('./temp/')
			copyDirectory(file, './temp/')
			conflicts = builder(file, filename, conflicts, extension)
			
	if len(conflicts) > 0:
		with create_file('./conflict.log') as f:
			f.write('\n'.join(conflicts))
	
	if os.path.exists('./temp/'):
		shutil.rmtree('./temp/')

if output_name is not '':
	run()