// External dependencies
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const core = require('@actions/core');
const { retry } = require('@octokit/plugin-retry');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');
const { v4: uuidv4 } = require('uuid');

// Internal dependencies
const { checkComposerExist, sleep } = require('./util');
const { cloneRepo, areFilesChanged, pushRepo, createBranch } = require('./git');
const { createPr, approvePr, mergePr, deleteRef, createIssue, getIssues } = require('./api-calls');
const GenerateComposerFile = require('./generate-composer');

async function run() {
	try {
		// Action inputs
		const token = core.getInput('github_token', { required: true });
		const approval_token = core.getInput('approval_github_token');
		const committerUsername = core.getInput('committer_username');
		const committerEmail = core.getInput('committer_email');

		// Github envs
		const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
		const [refs, head, branch] = process.env.GITHUB_REF.split('/');

		const octokit = GitHub.plugin(retry);
		const myOctokit = new octokit(getOctokitOptions(token));

		core.info('Create working dir');
		const dir = path.join(process.cwd(), 'clones', repo);
		fs.mkdirSync(dir, { recursive: true });

		core.info('Clone repo');
		const git = simpleGit({ baseDir: dir });
		await cloneRepo(dir, owner, repo, token, git);

		core.info('Checking if is WordPress repo');
		if (fs.existsSync(path.join(dir, 'wp-content'))) {
			core.setFailed(`Missing folder: wp-content`);
			return;
		}
		if (fs.existsSync(path.join(dir, 'wp-content', 'plugins'))) {
			core.setFailed(`Missing folder: wp-content/plugins`);
			return;
		}

		core.info('Generate composer file');
		const composer = new GenerateComposerFile(dir, process.env.GITHUB_REPOSITORY, token);
		let composerObj = null;
		if ((await checkComposerExist(dir)) === true) {
			composerObj = await composer.update();
		} else {
			composerObj = await composer.generate();
		}

		core.info('Creating issues for missing plugins');
		for (plugin of composerObj.failed) {
			const issueTitle = `Failed getting plugin for Composer: ${plugin}`;
			const issueBody = `Failed getting plugin for Composer: **${plugin}**.\n\nIf you wish to ignore this plugin, add it in the \`extra.ignore\` array, in the composer.json file.`;
			const issueLabels = ['plugins'];
			const issues = await getIssues(myOctokit, owner, repo);
			const issueExist = await issues.some((issue) => issue.title === issueTitle);
			if (!issueExist) {
				createIssue(myOctokit, owner, repo, issueTitle, issueBody, issueLabels);
			}
		}

		core.info('Writing new Composer file to repo');
		await composer.write(dir, composerObj.json);

		if (await areFilesChanged(git)) {
			core.info(`Creating branch`);
			const newBranch = `composer/${uuidv4()}`;
			await createBranch(newBranch, git);

			core.info(`Pushing to ${newBranch}.`);
			const commitMessage = `[skip-deploy] Chore: Updated Composer File`;
			await pushRepo(
				token,
				owner,
				repo,
				newBranch,
				commitMessage,
				committerUsername,
				committerEmail,
				git
			);

			core.info('Creating Pull request');
			const pr = await createPr(myOctokit, owner, repo, commitMessage, newBranch, branch);

			// If an approval token is supplied, we will go ahead and autoapprove the PR.
			if (approval_token.length && approval_token !== '') {
				const secondOctokit = new octokit(getOctokitOptions(approval_token));

				// Adding some delays because GitHub can be a bit janky.
				core.info('Approve Pull request');
				await sleep(5000);
				await approvePr(secondOctokit, owner, repo, pr);

				core.info('Merge Pull request');
				await sleep(1000);
				await mergePr(myOctokit, owner, repo, pr, commitMessage);

				core.info(`Delete branch: ${newBranch}.`);
				await sleep(1000);
				const ref = `heads/${newBranch}`;
				await deleteRef(myOctokit, owner, repo, ref);
			}

			core.info('Finished updating Composer file.');
		} else {
			core.info('No changes found. Finishing up.');
		}
		core.endGroup();
	} catch (error) {
		core.setFailed(`Action failed because of: ${error}`);
	}
}

run();
