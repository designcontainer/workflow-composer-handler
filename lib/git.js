const core = require('@actions/core');

module.exports = {
	cloneRepo,
	pushRepo,
	areFilesChanged,
	createBranch,
};

/**
 * Git clone
 */
async function cloneRepo(dir, owner, repo, token, git) {
	const url = getGitUrl(token, owner, repo);
	await git.clone(url, dir, { '--depth': 1 });
}

/**
 * Git push
 */
async function pushRepo(
	token,
	owner,
	repo,
	branchName,
	message,
	committerUsername,
	committerEmail,
	git
) {
	const url = getGitUrl(token, owner, repo);

	await git.addConfig('user.name', committerUsername);
	await git.addConfig('user.email', committerEmail);
	await git.commit(message);
	await git.addRemote('auth', url);
	await git.push(['-u', 'auth', branchName]);
}

function getGitUrl(token, owner, repo) {
	return `https://${token}@github.com/${owner}/${repo}.git`;
}

/**
 * Check if files are changed
 * Git add & git status
 */
async function areFilesChanged(git) {
	await git.add('./*');
	const status = await git.status();
	core.debug('DEBUG: List of differences spotted in the repository');
	core.debug(JSON.stringify(status, null, 2));

	return status.files.length > 0;
}

/**
 * Git checkout -b branchName
 */
async function createBranch(branchName, git) {
	return await git.checkout(`-b${branchName}`);
}
