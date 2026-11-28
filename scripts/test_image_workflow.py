"""Exercise the checked-in workflow shell without Git/network mutations."""
from pathlib import Path
import os
import subprocess
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / '.github/workflows/catalog-image-variants.yml'


class ImageWorkflowTests(unittest.TestCase):
    def run_script(self, *, dirty=False, built=False):
        block = WORKFLOW.read_text().split('      - name: Guardar solamente derivados y pruebas de origen', 1)[1]
        script = block.split('        run: |\n', 1)[1]
        script = '\n'.join(line[10:] if line.startswith('          ') else line for line in script.splitlines())
        prefix = '''
set -e
git() {
  case "$1" in
    diff) return $DIRTY;;
    rev-parse) echo current-head;;
    *) echo "git:$*";;
  esac
}
gh() {
  if [[ "$*" == *"/pages/builds/latest"* ]]; then
    [[ "$BUILT" == 1 ]] && echo current-head || true
  else
    echo "request:$*"
  fi
}
'''
        env = {**os.environ, 'GITHUB_REPOSITORY': 'fixture/store', 'DIRTY': '1' if dirty else '0', 'BUILT': '1' if built else '0'}
        return subprocess.run(['bash', '-c', prefix + script], env=env, text=True, capture_output=True, check=True).stdout

    def test_clean_rerun_retries_missing_pages_build(self):
        result = self.run_script()
        self.assertIn('request:api --method POST repos/fixture/store/pages/builds', result)
        self.assertNotIn('git:commit', result)

    def test_already_built_clean_head_is_not_republished(self):
        self.assertNotIn('request:', self.run_script(built=True))

    def test_new_variants_commit_then_request_normal_build(self):
        result = self.run_script(dirty=True)
        self.assertIn('git:commit', result)
        self.assertIn('git:push', result)
        self.assertLess(result.index('git:push'), result.index('request:'))


if __name__ == '__main__':
    unittest.main()
