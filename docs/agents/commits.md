# Issue branches and commit history

## Dedicated issue branches

- Create a branch dedicated to the issue before its first commit, unless the
  current branch was created for that issue.
- Start from the agreed base revision and keep unrelated work out of the branch.
- Prefer small, reasoned commits whose messages explain the intent.
- Keep a test and the implementation that makes it pass together when splitting
  them would leave a misleading or broken commit.

## History review and the external-review boundary

Before first publication, review and, where useful, rewrite the local commit
sequence so each commit is coherent and validated.

The commit-preservation boundary begins when an external review system can attach
comments or findings to published commits or lines. Examples include pull-request
reviews, SonarCloud findings, and other external review services. After that
boundary, preserve reviewed commits and address findings with follow-up commits so
external references do not become stale.

Direct feedback from the maintainer to an agent is not external review. In that
case, local history may still be amended, reordered, squashed, or force-pushed
when the maintainer permits it.

Group related review fixes into coherent commits rather than creating one commit
per minor comment. Re-run the appropriate validation after the final fix.

Use an issue-closing keyword only when merging the pull request will complete the
accepted issue with no remaining external condition. Otherwise use `Related:` or
an ordinary reference.
