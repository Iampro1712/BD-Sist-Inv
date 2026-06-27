"""
Vistas de autenticación (JWT): login, refresh, logout y usuario actual.
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError


class LoginView(TokenObtainPairView):
    """Obtiene access + refresh. Con throttling anti fuerza bruta (scope 'login')."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


@api_view(['POST'])
def logout_view(request):
    """Invalida el refresh token (blacklist) — cierre de sesión del lado servidor."""
    token = request.data.get('refresh')
    if not token:
        return Response({'error': 'Se requiere el refresh token'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        RefreshToken(token).blacklist()
    except TokenError:
        # token inválido o ya expirado: la sesión queda igualmente cerrada
        pass
    return Response(status=status.HTTP_205_RESET_CONTENT)


@api_view(['GET'])
def me_view(request):
    """Datos del usuario autenticado actual."""
    u = request.user
    return Response({
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'is_active': u.is_active,
        'is_staff': u.is_staff,
        'is_superuser': u.is_superuser,
        'rol': 'Administrador' if u.is_staff else 'Usuario',
    })
