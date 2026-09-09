"""
GPS Tracking package.
"""
from .manager import GPSManager
from .base_provider import BaseGPSProvider

__all__ = ["GPSManager", "BaseGPSProvider"]
