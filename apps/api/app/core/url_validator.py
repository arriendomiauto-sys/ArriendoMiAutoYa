"""
Validador de URLs Seguro (OWASP Anti-SSRF & Anti-Open Redirect).
Protege al backend contra Server-Side Request Forgery (SSRF) y redirecciones abiertas.
"""
import ipaddress
import socket
import urllib.parse
from typing import List, Optional, Set
import logging

logger = logging.getLogger(__name__)

# Dominios permitidos para descargas externas de almacenamiento / imágenes
DEFAULT_ALLOWED_STORAGE_DOMAINS: Set[str] = {
    "supabase.co",
    "rgxiyidijtoazcrmijly.supabase.co",
    "storage.googleapis.com",
    "images.unsplash.com",
    "arriendatuauto.com",
    "arriendamiauto.cl",
    "cloudinary.com",
}

# Dominios permitidos para URLs de retorno / redirección (Open Redirect prevention)
DEFAULT_ALLOWED_RETURN_DOMAINS: Set[str] = {
    "arriendatuauto.com",
    "www.arriendatuauto.com",
    "app.arriendatuauto.com",
    "admin.arriendatuauto.com",
    "arriendamiauto.cl",
    "rgxiyidijtoazcrmijly.supabase.co",
    "webpay3g.transbank.cl",
    "webpay3gint.transbank.cl",
}

# IPs y rangos prohibidos para peticiones salientes (SSRF)
FORBIDDEN_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),          # RFC 1918 privado
    ipaddress.ip_network("100.64.0.0/10"),       # Carrier-grade NAT
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),      # Link-local / Cloud Metadata (AWS/GCP/Azure)
    ipaddress.ip_network("172.16.0.0/12"),       # RFC 1918 privado
    ipaddress.ip_network("192.0.0.0/24"),        # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),        # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"),      # RFC 1918 privado
    ipaddress.ip_network("198.18.0.0/15"),       # Network benchmark
    ipaddress.ip_network("198.51.100.0/24"),     # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),      # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),         # Multicast
    ipaddress.ip_network("240.0.0.0/4"),         # Reservado
    ipaddress.ip_network("255.255.255.255/32"),  # Broadcast
    # IPv6
    ipaddress.ip_network("::1/128"),             # IPv6 Loopback
    ipaddress.ip_network("::/128"),              # Unspecified
    ipaddress.ip_network("fc00::/7"),            # Unique Local
    ipaddress.ip_network("fe80::/10"),           # Link-local
]

FORBIDDEN_HOSTNAMES: Set[str] = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",
}


def is_ip_forbidden(ip_str: str) -> bool:
    """Verifica si una IP pertenece a rangos privados, loopback o metadatos de nube."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        return any(ip_obj in net for net in FORBIDDEN_IP_NETWORKS)
    except ValueError:
        return True


def is_domain_matching(domain: str, allowed_patterns: Set[str]) -> bool:
    """Verifica si un dominio coincide o es subdominio de alguno en la lista permitida."""
    domain = domain.lower()
    for pattern in allowed_patterns:
        pattern = pattern.lower()
        if domain == pattern or domain.endswith("." + pattern):
            return True
    return False


def validate_safe_url(
    url: str,
    allow_relative: bool = True,
    allowed_domains: Optional[Set[str]] = None,
    allow_localhost_dev: bool = False
) -> bool:
    """
    Valida que una URL sea segura para ser descargada por el backend (Anti-SSRF).
    Bloquea loopback, rangos privados e IPs de metadatos de nube.
    """
    if not url or not isinstance(url, str):
        return False

    url = url.strip()

    # Rutas relativas locales permitidas (ej. /uploads/...)
    if allow_relative and url.startswith("/"):
        # Prevenir traversal en rutas relativas
        if ".." in url or "\x00" in url:
            return False
        return True

    # data URIs seguros para imágenes
    if url.startswith("data:image/"):
        return True

    parsed = urllib.parse.urlparse(url)
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname

    # Solo schemes seguros
    if scheme not in ("http", "https"):
        logger.warning(f"[Anti-SSRF] Esquema no permitido bloqueado: {scheme}")
        return False

    if not hostname:
        return False

    hostname_lower = hostname.lower()

    # Bloqueo directo de hostnames prohibidos
    if hostname_lower in FORBIDDEN_HOSTNAMES:
        if allow_localhost_dev:
            return True
        logger.warning(f"[Anti-SSRF] Hostname prohibido bloqueado: {hostname}")
        return False

    # Verificación de dominios permitidos si se especifica whitelist
    domains_to_check = allowed_domains or DEFAULT_ALLOWED_STORAGE_DOMAINS
    if not is_domain_matching(hostname_lower, domains_to_check):
        logger.warning(f"[Anti-SSRF] Dominio fuera de whitelist bloqueado: {hostname}")
        return False

    # Resolución DNS para verificar que el hostname no resuelva a una IP privada / loopback (DNS Rebinding)
    try:
        resolved_ips = socket.getaddrinfo(hostname, None)
        for entry in resolved_ips:
            ip_str = entry[4][0]
            if is_ip_forbidden(ip_str):
                if allow_localhost_dev and ip_str in ("127.0.0.1", "::1"):
                    continue
                logger.warning(f"[Anti-SSRF] DNS resolvió a IP prohibida {ip_str} para host {hostname}")
                return False
    except Exception as e:
        logger.warning(f"[Anti-SSRF] Error en resolución DNS para {hostname}: {e}")
        return False

    return True


def validate_safe_return_url(
    return_url: Optional[str],
    allowed_domains: Optional[Set[str]] = None,
    allow_localhost_dev: bool = False
) -> bool:
    """
    Valida que una URL de retorno sea segura (Anti-Open Redirect / OWASP CWE-601).
    Solo permite rutas relativas o dominios autorizados de la plataforma.
    """
    if not return_url:
        return True

    return_url = return_url.strip()

    # Rutas relativas son inherentemente seguras (no redirigen a otro dominio)
    if return_url.startswith("/") and not return_url.startswith("//"):
        return ".." not in return_url and "\x00" not in return_url

    parsed = urllib.parse.urlparse(return_url)
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname

    if scheme not in ("http", "https"):
        return False

    if not hostname:
        return False

    hostname_lower = hostname.lower()

    if hostname_lower in ("localhost", "127.0.0.1"):
        return allow_localhost_dev

    domains = allowed_domains or DEFAULT_ALLOWED_RETURN_DOMAINS
    return is_domain_matching(hostname_lower, domains)
