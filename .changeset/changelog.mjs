// Changelog entries without commit hashes: this repository's history is not
// the history of the published package, so a hash link would not resolve.

function indentFollowingLines(lines) {
  return lines.map((line) => (line.length > 0 ? `  ${line}` : '')).join('\n');
}

async function getReleaseLine(changeset) {
  const [firstLine, ...otherLines] = changeset.summary
    .split('\n')
    .map((line) => line.trimEnd());
  if (otherLines.length === 0) return `- ${firstLine}`;
  return `- ${firstLine}\n${indentFollowingLines(otherLines)}`;
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return '';
  const updated = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
  );
  return ['- Updated dependencies', ...updated].join('\n');
}

export default { getReleaseLine, getDependencyReleaseLine };
