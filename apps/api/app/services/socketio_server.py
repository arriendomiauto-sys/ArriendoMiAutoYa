"""
Compatibility shim for legacy service.
"""
import importlib
_mod = importlib.import_module('app.features.communications.messages.socketio_server')
for _k in dir(_mod):
    if not _k.startswith('__'):
        globals()[_k] = getattr(_mod, _k)
