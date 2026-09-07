from pathlib import Path
import runpy

root = Path(__file__).resolve().parent
simple_flow = root.parent / 'public' / 'js' / 'pages' / 'pedido-simple-flow.js'

if simple_flow.exists():
    # Exercise the new seller-facing order path with its own visual assertions.
    runpy.run_path(str(root / 'order_simple_visual_qa.py'), run_name='__main__')

    # Keep the established quotation/home coverage, but replace its legacy order
    # scenario because that scenario intentionally targets controls no longer shown.
    source_path = root / 'quote_visual_qa.py'
    source = source_path.read_text(encoding='utf-8')
    legacy_call = '    check_order()\n    check_editor_and_home()'
    if legacy_call not in source:
        raise RuntimeError('No se encontró el punto de entrada del QA visual anterior.')
    source = source.replace(legacy_call, '    check_editor_and_home()', 1)
    scope = {'__name__': '__main__', '__file__': str(source_path)}
    exec(compile(source, str(source_path), 'exec'), scope)
else:
    runpy.run_path(str(root / 'quote_visual_qa.py'), run_name='__main__')
