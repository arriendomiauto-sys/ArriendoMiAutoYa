"""
Prueba de extremo a extremo de que el rate limiting (slowapi) realmente
corta el tráfico al superar el límite configurado, no solo que está
"conectado" en el código. `POST /autos` tiene un límite de 20/minute.
"""


def test_supera_limite_de_publicar_autos_da_429(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    c = auth_as(owner)

    respuestas = []
    for i in range(21):
        resp = c.post(
            "/api/v1/autos",
            json={
                "marca": "Toyota",
                "modelo": "Yaris",
                "anio": 2022,
                "patente": f"RATE-{i:02d}",
                "tarifa_dia": 20000,
                "ubicacion_base": "Los Angeles",
            },
        )
        respuestas.append(resp.status_code)

    # Las primeras 20 pasan el límite (pueden fallar por otra razón, pero
    # nunca por 429); la 21ª debe quedar cortada por el rate limit.
    assert 429 not in respuestas[:20], respuestas[:20]
    assert respuestas[20] == 429


def test_endpoint_sin_limite_especifico_no_se_ve_afectado_por_el_de_otro(usuario_factory, auth_as):
    """El límite de /autos (20/minute) no debe contaminar otros endpoints:
    GET /autos es público y no tiene decorador propio, solo el default
    global (200/minute) — 25 llamadas no deberían cortarse."""
    c = auth_as(usuario_factory(roles_activos=["cliente"]))
    for _ in range(25):
        resp = c.get("/api/v1/autos")
        assert resp.status_code == 200
