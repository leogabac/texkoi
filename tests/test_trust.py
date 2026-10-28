import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import local_registration as registration


class TrustTests(unittest.TestCase):
    def records(self, package):
        return {'wpp': {
            'old': {'name':'TeXKoi','path':'/old','enable':True},
            'legacy': {'name':'TeXKoi','path':'http://127.0.0.1:3899','enable':True},
            'current': {'name':'TeXKoi','path':str(package),'enable':False,'md5':'unchanged'},
            'dev': {'name':'TeXKoi Dev','path':'http://127.0.0.1:3899','enable':True},
            'other': {'name':'Other','path':'/other','enable':False},
            'namelist':'old;legacy;current;dev;other'},
            'wps': {'unrelated':{'name':'TeXKoi','path':'/another-component'}}}

    def test_repair_preserves_current_approval_and_other_addins(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);package=root/'TeXKoi_0.1.1'
            original=self.records(package);path=root/'authaddin.json'
            content=json.dumps(original).encode();path.write_bytes(content)
            self.assertEqual(registration.trust_status(root,package),2)
            with patch.object(registration,'document_hosts_running',return_value=False):
                self.assertEqual(registration.repair_trust(root,package),2)
                self.assertEqual(registration.repair_trust(root,package),0)
            result=json.loads(path.read_text())
            for key in ['current','dev','other']: self.assertEqual(result['wpp'][key],original['wpp'][key])
            self.assertEqual(result['wps'],original['wps'])
            self.assertEqual(result['wpp']['namelist'],'current;dev;other')
            backups=list(root.glob('authaddin.json.texkoi-*.bak'))
            self.assertEqual(len(backups),1);self.assertEqual(backups[0].read_bytes(),content)
            self.assertEqual(backups[0].stat().st_mode & 0o777,0o600)

    def test_refuses_changes_while_document_host_runs(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);path=root/'authaddin.json'
            content=json.dumps(self.records(root/'TeXKoi_0.1.1'));path.write_text(content)
            with patch.object(registration,'document_hosts_running',return_value=True):
                with self.assertRaisesRegex(ValueError,'fully quit WPS'): registration.repair_trust(root,root/'TeXKoi_0.1.1')
            self.assertEqual(path.read_text(),content)
            self.assertEqual(list(root.glob('*.bak')),[])

    def test_malformed_file_is_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);path=root/'authaddin.json';path.write_text('{broken')
            with patch.object(registration,'document_hosts_running',return_value=False):
                with self.assertRaises(ValueError): registration.repair_trust(root,root/'package')
            self.assertEqual(path.read_text(),'{broken')

    def test_process_check_allows_only_independent_cloud_browser(self):
        cloud='wpsoffice /usr/lib/office6/wpsoffice Run /usr/lib/office6/addons/kcef/libjsapibrowser.so --from=qing\n'
        with patch.object(registration.subprocess,'check_output',return_value=cloud):
            self.assertFalse(registration.document_hosts_running())
        for name in ['wps','wpp','et','wpsoffice']:
            with patch.object(registration.subprocess,'check_output',return_value=cloud+name+' /document-host\n'):
                self.assertTrue(registration.document_hosts_running())


if __name__ == '__main__': unittest.main()
