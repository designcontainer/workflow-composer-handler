# Composer handler

A Workflow for generating and updating composer.json files for WordPress plugins.
The Workflow handles repos hosted on WordPress SVN, and internal Design Container plugins.

## Example GitHub Action workflow

```yml
name: Generate/update Composer file on schedule

on:
    schedule:
        # Runs every every week, 00:00 UTC on Sundays.
        - cron: '0 0 * * 0'

jobs:
    replicate_changes:
        runs-on: ubuntu-latest

        steps:
            - name: Checkout repository
              uses: actions/checkout@v2
            - name: Generate/update Composer file on schedule
              uses: designcontainer/workflow-composer-handler@master
              with:
                  github_token: ${{ secrets.BOT_TOKEN }}
                  approval_github_token: ${{ secrets.GITHUB_TOKEN }}
                  committer_username: web-flow
                  committer_email: noreply@github.com
```

## Configuration

| Name                    | Descripion                                                                                                                                                         | Required | Default            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------ |
| `github_token`          | Token to use GitHub API. It must have "repo" and "workflow" scopes so it can push to repo and edit workflows.                                                      | true     | -                  |
| `approval_github_token` | Secondary token used for auto approving pull requests. Without this token, PR's will not get autoapproved and merged.                                              | false    | -                  |
| `committer_username`    | The username (not display name) of the committer that will be used in the commit of changes in the workflow file in specific repository. In the format `web-flow`. | false    | web-flow           |
| `committer_email`       | The email of the committer that will be used in the commit of changes in the workflow file in specific repository. In the format `noreply@github.com`.             | false    | noreply@github.com |
