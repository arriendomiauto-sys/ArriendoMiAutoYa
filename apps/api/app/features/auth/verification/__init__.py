"""
Persistencia de assets de verificación de identidad (fotos temporales del
proveedor externo -> Storage propio). El resto de este paquete
(VerificationOrchestrator, un abstracción para el pipeline /enrolment en
inglés que nunca se adoptó en mobile) se retiró — el flujo real
(/enrolamiento, español) usa OCRService/BackgroundCheckService
directamente, sin pasar por acá.
"""
