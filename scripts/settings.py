"""User preferences, reloaded for new equations; separate from private runtime state."""
import json
import math
import os
import subprocess
from pathlib import Path
from render import DEFAULT_PREAMBLE, validate_preamble


def settings_directory():
    return Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home() / '.config'))) / 'texkoi'


def read_preferences(directory=None):
    directory = Path(directory) if directory is not None else settings_directory()
    path = directory / 'settings.json'
    data = {}
    if path.exists():
        try:
            if path.stat().st_size > 65536: raise ValueError('file exceeds 64 KiB')
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError, UnicodeError) as error:
            raise ValueError('Cannot read TeXKoi settings at ' + str(path) + ': ' + str(error)) from error
    if not isinstance(data, dict): raise ValueError('TeXKoi settings must be a JSON object: ' + str(path))
    unknown = set(data) - {'default_size_pt', 'default_format', 'preamble_file', 'editor_command', 'vim_mode'}
    if unknown: raise ValueError('Unknown TeXKoi setting: ' + ', '.join(sorted(unknown)))
    vim_mode = data.get('vim_mode', False)
    if type(vim_mode) is not bool: raise ValueError('vim_mode must be true or false.')
    size = data.get('default_size_pt', 28)
    if type(size) not in (int, float) or not 6 <= size <= 144 or not math.isfinite(size):
        raise ValueError('default_size_pt must be a number between 6 and 144.')
    fmt = data.get('default_format', 'svg')
    if fmt not in ('svg', 'png'): raise ValueError('default_format must be svg or png.')
    filename = data.get('preamble_file')
    if filename is not None and (not isinstance(filename, str) or not filename.strip()):
        raise ValueError('preamble_file must be a nonempty file path or null.')
    editor = data.get('editor_command')
    if editor is not None and (not isinstance(editor, list) or not editor or
            any(not isinstance(arg, str) or not arg or '\0' in arg for arg in editor)):
        raise ValueError('editor_command must be a nonempty array of command arguments or null.')
    preamble_path = None
    if filename is not None:
        preamble_path = Path(filename).expanduser()
        if not preamble_path.is_absolute(): preamble_path = directory / preamble_path
        preamble_path = preamble_path.resolve()
    return {'default_size_pt': size, 'default_format': fmt, 'preamble_path': preamble_path,
            'settings_path': path, 'editor_command': editor, 'vim_mode': vim_mode}


def load_settings(directory=None):
    preferences = read_preferences(directory)
    preamble = DEFAULT_PREAMBLE
    preamble_path = preferences['preamble_path']
    if preamble_path is not None:
        try:
            if preamble_path.stat().st_size > 80000: raise ValueError('file exceeds 80 KiB')
            additional = preamble_path.read_text(encoding='utf-8')
        except (OSError, ValueError, UnicodeError) as error:
            raise ValueError('Cannot read TeXKoi preamble at ' + str(preamble_path) + ': ' + str(error)) from error
        preamble += additional
    validate_preamble(preamble)
    return {'default_size_pt': preferences['default_size_pt'], 'default_format': preferences['default_format'],
            'preamble': preamble, 'vim_mode': preferences['vim_mode'], 'settings_path': str(preferences['settings_path']),
            'preamble_path': str(preamble_path) if preamble_path else None}


def open_preamble(directory=None):
    directory = Path(directory) if directory is not None else settings_directory()
    if not (directory / 'settings.json').exists(): ensure_settings(directory)
    preferences = read_preferences(directory)
    path = preferences['preamble_path']
    if path is None:
        raise ValueError('No preamble file is configured. Set preamble_file in settings.json first.')
    if path.is_dir(): raise ValueError('The configured preamble path is a directory: ' + str(path))
    if not path.parent.is_dir(): raise ValueError('The preamble directory does not exist: ' + str(path.parent))
    # No shell and no client-supplied path: editor command and target both come
    # from the local user configuration. xdg-open honours the desktop association.
    command = list(preferences['editor_command'] or ['xdg-open']) + [str(path)]
    try:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, start_new_session=True)
        try:
            code = process.wait(timeout=0.25)
        except subprocess.TimeoutExpired:
            code = None
        if code not in (None, 0):
            raise ValueError('The editor could not open the preamble (exit ' + str(code) + '). Check editor_command or your desktop file association.')
    except OSError as error:
        raise ValueError('Could not start the editor: ' + str(error)) from error
    return {'ok': True}


def ensure_settings(directory=None):
    directory = Path(directory) if directory is not None else settings_directory()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / 'settings.json'
    if not path.exists():
        preamble = directory / 'preamble.tex'
        if not preamble.exists():
            with preamble.open('x', encoding='utf-8') as stream:
                stream.write('% Extra packages and macros for new TeXKoi equations.\n'
                             '% amsmath and amssymb are already included.\n'
                             '% \\newcommand{\\vect}[1]{\\mathbf{#1}}\n')
        with path.open('x', encoding='utf-8') as stream:
            json.dump({'default_size_pt':28, 'default_format':'svg', 'preamble_file':'preamble.tex'}, stream, indent=2)
            stream.write('\n')
    return load_settings(directory)
