"""
Límite de intentos para el login del panel /admin/ de Django.

Sin esto, /admin/login/ era una segunda puerta para fuerza bruta contra el
superusuario, sin el límite que ya tiene /api/auth/login/. Se reutiliza el
throttle de DRF para compartir la tasa ('login') y la forma de identificar al
cliente detrás del proxy (NUM_PROXIES).
"""
from functools import wraps

from django.http import HttpResponse
from rest_framework.throttling import SimpleRateThrottle


class AdminLoginThrottle(SimpleRateThrottle):
    scope = 'login'

    def get_cache_key(self, request, view):
        # Contador propio: no comparte cuota con el login de la API.
        return self.cache_format % {'scope': 'admin_login', 'ident': self.get_ident(request)}


def con_limite_de_intentos(login_view):
    @wraps(login_view)
    def envoltura(request, *args, **kwargs):
        if request.method == 'POST':
            throttle = AdminLoginThrottle()
            if not throttle.allow_request(request, None):
                return HttpResponse(
                    'Demasiados intentos de inicio de sesión. Probá de nuevo en un minuto.',
                    status=429,
                    content_type='text/plain; charset=utf-8',
                )
        return login_view(request, *args, **kwargs)
    return envoltura
