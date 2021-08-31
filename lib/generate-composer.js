const fs = require('fs');
const path = require('path');
const axios = require('axios');

class GenerateComposerFile {
	/**
	 * Generate a composer file.
	 *
	 * @param {string} dir The repo/WordPress root directory.
	 * @param {string} name The repository name, ie: designcontainer/project.
	 * @param {string} token A GitHub API Bearer token.
	 */
	constructor(dir, name, token) {
		this.dir = dir;
		this.name = name;
		this.token = token;
		this.composer = null;
		this.failed = [];
	}

	/**
	 * Generate a Composer json.
	 *
	 * @returns {object}
	 */
	async generate() {
		const plugins = await this.getAllPlugins();
		this.composer = this.composerSkeleton();

		for (const plugin of plugins) {
			if (await this.isInternalPlugin(plugin)) {
				this.addInternalPlugin(plugin);
			} else if (await this.isWordPressPlugin(plugin)) {
				this.addWordPressPlugin(plugin);
			} else {
				this.failed.push(plugin);
			}
		}
		return { json: this.composer, failed: this.failed };
	}

	/**
	 * Update a Composer json.
	 *
	 * @returns {object}
	 */
	async update() {
		const plugins = await this.getAllPlugins();

		// Get original composer file
		this.composer = await this.get();

		for (const plugin of plugins) {
			if (this.isPluginIgnored(plugin)) {
				console.log(`Plugin is ignored: ${plugin}`);
			} else if (this.isPluginInComposer(plugin)) {
				console.log(`Plugin already exists in Composer: ${plugin}`);
			} else if (await this.isInternalPlugin(plugin)) {
				this.addInternalPlugin(plugin);
			} else if (await this.isWordPressPlugin(plugin)) {
				this.addWordPressPlugin(plugin);
			} else {
				this.failed.push(plugin);
			}
		}
		return { json: this.composer, failed: this.failed };
	}

	/**
	 * Get the composer.json file contents in JSON format
	 *
	 * @param {string} dir The composer file directory
	 * @returns {object}
	 */
	async get(dir = this.dir) {
		const originalComposer = path.join(dir, 'composer.json');
		const originalComposerContents = fs.readFileSync(originalComposer);
		return JSON.parse(originalComposerContents);
	}

	/**
	 * Write JSON to a compiser.json file
	 *
	 * @param {string} dir Output directory
	 * @param {object} json The composer file contents
	 * @returns {void}
	 */
	async write(dir, json = this.composer) {
		const file = path.join(dir, 'composer.json');
		const jsonString = JSON.stringify(json, null, 2);
		// Delete the prev one if it already exists.
		if (fs.existsSync(file) === true) {
			fs.unlinkSync(file);
		}
		// Write
		fs.writeFileSync(file, jsonString);
	}

	/**
	 * Composer file skeleton
	 *
	 * @returns {object}
	 */
	composerSkeleton() {
		return {
			name: this.name,
			description: 'A Design Container Website',
			repositories: [
				{
					type: 'composer',
					url: 'https://wpackagist.org',
				},
			],
			require: {
				'composer/installers': 'v1.11.0',
			},
			extra: {
				ignore: [],
				'installer-paths': {
					'wp-content/mu-plugins/{$name}/': ['type:wordpress-muplugin'],
					'wp-content/plugins/{$name}/': ['type:wordpress-plugin'],
				},
			},
		};
	}

	/**
	 * Add WordPress plugin to the composer class object
	 *
	 * @param {string} plugin The plugin name
	 * @returns {void}
	 */
	addWordPressPlugin(plugin) {
		this.addObjectIfMissing('repositories');
		this.addObjectIfMissing('require');
		// Add wpackagist to repository list if it is missing,
		if (!this.composer.repositories.some((o) => o.url === 'https://wpackagist.org')) {
			this.composer.repositories.push({
				type: 'composer',
				url: `https://wpackagist.org`,
			});
		}

		Object.assign(this.composer.require, {
			[`wpackagist-plugin/${plugin}`]: '*',
		});
	}

	/**
	 * Add Internal plugin to the composer class object
	 *
	 * @param {string} plugin The plugin name
	 * @returns {void}
	 */
	addInternalPlugin(plugin) {
		this.addObjectIfMissing('repositories');
		this.addObjectIfMissing('require');
		this.composer.repositories.push({
			type: 'vcs',
			url: `https://github.com/designcontainer/${plugin}`,
		});
		Object.assign(this.composer.require, {
			[`designcontainer/${plugin}`]: '*',
		});
	}

	/**
	 * Add an object to the composer class object if it is missing.
	 * @param {string} object
	 * @returns {void}
	 */
	addObjectIfMissing(object) {
		if (this.composer[object] === undefined) {
			Object.assign(this.composer, {
				[object]: [],
			});
		}
	}

	/**
	 * Check if plugin exists in the composer class object
	 *
	 * @param {string} plugin The plugin name
	 * @returns {boolean}
	 */
	isPluginInComposer(plugin) {
		const obj = this.composer.require;
		const cPlugins = Object.keys(obj);
		return cPlugins.some((cPlugin) => {
			return cPlugin.split('/')[1] === plugin;
		});
	}

	/**
	 * Check if plugin is ignored in the composer class object
	 *
	 * @param {string} plugin The plugin name
	 * @returns {boolean}
	 */
	isPluginIgnored(plugin) {
		if (this.composer.extra === undefined) return false;
		if (this.composer.extra.ignore === undefined) return false;
		return this.composer.extra.ignore.some((cPlugin) => {
			return cPlugin === plugin;
		});
	}

	/**
	 * Get all plugins in the dir/wp-content/plugins directory.
	 * Names are set by folder name.
	 *
	 * @param {string} dir WordPress root directory.
	 * @returns {array}
	 */
	async getAllPlugins(dir = this.dir) {
		const pluginsPath = path.join(dir, 'wp-content', 'plugins');
		return fs
			.readdirSync(pluginsPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);
	}

	/**
	 * Check if plugin is in the SVN repository.
	 *
	 * @param {string} plugin The plugin name.
	 * @returns {boolean}
	 */
	async isWordPressPlugin(plugin) {
		const urlAxios = `https://wordpress.org/plugins/${plugin}/`;
		const res = await axios.get(urlAxios);
		if (res.request._redirectable._redirectCount === 0) {
			return true;
		}
		return false;
	}

	/**
	 * Check if plugin exists in a designcontainer repository.
	 *
	 * @param {string} plugin The plugin name.
	 * @returns {boolean}
	 */
	async isInternalPlugin(plugin) {
		const urlAxios = `https://api.github.com/repos/designcontainer/${plugin}`;
		const headersAxios = {
			headers: {
				Authorization: `Bearer ${this.token}`,
			},
		};
		return await axios
			.get(urlAxios, headersAxios)
			.then(() => true)
			.catch(() => false);
	}
}

module.exports = GenerateComposerFile;
