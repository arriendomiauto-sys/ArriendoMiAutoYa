"""
Compatibility shim for legacy router.
"""
import importlib
_mod = importlib.import_module('app.features.communications.notifications.router')
for _k in dir(_mod):
    if not _k.startswith('__'):
        globals()[_k] = getattr(_mod, _k)
router = getattr(_mod, 'router', None)
