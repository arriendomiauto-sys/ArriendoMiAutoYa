export { colors } from "./theme/colors";
export { theme, spacing, radius, typography, shadow, control } from "./theme/tokens";
export {
  Button,
  Card,
  BackButton,
  ScreenHeader,
  Chip,
  Badge,
  Rating,
  SectionLabel,
  StatRow,
  MenuList,
  MenuRow,
  EmptyState,
  Field,
  Checkbox,
  BottomBar,
} from "./components/ui";
export { Icon } from "./components/Icon";
export { LlegadaPorUbicacion } from "./components/LlegadaPorUbicacion";
export { Skeleton } from "./components/Skeleton";
export { ArranqueGate } from "./components/ArranqueGate";
export { AlertaInline } from "./components/AlertaInline";
export { PhotoViewer } from "./components/PhotoViewer";
export { AvatarFoto } from "./components/AvatarFoto";
export { TabBar } from "./components/TabBar";
export { BrandLogo } from "./components/BrandLogo";
export { VerifyIdentityBanner } from "./components/VerifyIdentityBanner";
export { NetworkBanner } from "./components/NetworkBanner";
export {
  DateTimeField,
  DateTimePickerModal,
  formatearFecha,
  formatearHora,
  formatearFechaHora,
  aISOLocal,
} from "./components/DateTimeField";
export { DocumentCameraModal } from "./components/DocumentCameraModal";
export { QRScannerModal } from "./components/QRScannerModal";
export { ReferralCodeCard } from "./components/ReferralCodeCard";
export { PromoterPanelScreen } from "./screens/PromoterPanelScreen";
export { ReadinessBand, ModeSwitchRow, estadoCuenta } from "./components/ProfileStatus";
export { FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "./vehiculo/fotosAuto";
export {
  TIPOS_VEHICULO,
  TARIFAS_CATEGORIA_DEFAULT,
  PASO_PRECIO_CLP,
  TARIFA_MINIMA_CLP,
  TARIFA_MAXIMA_CLP,
  escalonesTarifa,
  clampTarifa,
  aplicarTarifasConfig,
  redondearATramo5000,
  obtenerConfiguracionTipo,
  calcularDesgloseIva,
  gananciaDelDueno,
  PORCENTAJE_DUENO,
} from "./vehiculo/catalogoPrecios";
export { useCatalogoPrecios } from "./vehiculo/useCatalogoPrecios";
export {
  optimizarImagen,
  subirImagenOptimizada,
  subirImagenesOptimizadas,
  elegirImagen,
  elegirYSubirImagen,
  AJUSTES_DOCUMENTO,
  ANCHO_MAXIMO_FOTO,
} from "./utils/imagenes";
export { ApiClient } from "./api/client";
export { conectarChat, urlDelSocket } from "./api/chatSocket";
export { useConversaciones } from "./hooks/useConversaciones";
export { useFavoritos } from "./hooks/useFavoritos";
export { useTarjetas, limpiarCacheTarjetas } from "./hooks/useTarjetas";
export { useCuentaRegresiva } from "./hooks/useCuentaRegresiva";
export { useEnvioLogin } from "./hooks/useEnvioLogin";
export { useEnvioRecuperacion } from "./hooks/useEnvioRecuperacion";
export { useTelemetriaArriendo } from "./hooks/useTelemetriaArriendo";
export { useNetworkStatus } from "./hooks/useNetworkStatus";
export { useBackAndroid } from "./hooks/useBackAndroid";
export { useVersionCheck } from "./hooks/useVersionCheck";
export { compararVersiones, versionEsMenor } from "./utils/semver";
export {
  confirmarBiometria,
  hayHardwareBiometrico,
  tipoBiometriaDisponible,
  autenticarParaFirmar,
} from "./hooks/biometria";
export { supabase } from "./api/supabase";
export { AppProvider, useApp } from "./context/AppContext";
export { AuthFlow } from "./auth/AuthFlow";
export {
  useRegistroCuenta,
  PASO_CUENTA,
  PASO_TERMINOS,
  PASO_CODIGO,
  PASO_EXITO,
} from "./auth/register/useRegistroCuenta";
export {
  SegmentosPaso,
  MensajeCampo,
  RequisitosContrasena,
  CodigoVerificacion,
  ReenvioCodigo,
  EncabezadoCentrado,
  ResumenCuenta,
} from "./auth/register/RegistroPiezas";
export { PasoTerminos } from "./auth/register/PasoTerminos";
export { formatearCelular } from "./auth/register/validaciones";
export { CampoConSugerencias } from "./components/CampoConSugerencias";
export {
  BANCOS_CHILE,
  buscarBancos,
  esBancoConocido,
  TIPOS_CUENTA_CHILE,
} from "./data/catalogosFinancieros";
export {
  FormularioTarjeta,
  validarFormularioTarjeta,
  detectarMarca,
  numeroTarjetaValido,
  vencimientoValido,
} from "./components/FormularioTarjeta";
export { AgregarTarjetaModal } from "./components/AgregarTarjetaModal";
export { configMercadoPago, crearCardToken, consultarMetodoPago } from "./api/mercadopago";
export { ContractModal } from "./screens/ContractModal";
export { ContractSignatureModal } from "./screens/ContractSignatureModal";
export { RatingModal } from "./components/RatingModal";
export { GpsTrackingModal } from "./components/GpsTrackingModal";
export { SignaturePad } from "./components/SignaturePad";
export { SuccessCheck, SuccessFlash } from "./components/SuccessCheck";
export { MisTarjetasScreen } from "./screens/MisTarjetasScreen";
// Compat: el nombre viejo apunta a la pantalla nueva de multi-tarjeta.
export { MisTarjetasScreen as TarjetaScreen } from "./screens/MisTarjetasScreen";
export { EditProfileScreen } from "./screens/EditProfileScreen";
export { LegalModal, CuerpoDocumentoLegal } from "./screens/LegalModal";
export { ForceUpdateScreen } from "./screens/ForceUpdateScreen";
export { DOCUMENTOS_LEGALES, EDAD_MINIMA_ARRENDATARIO } from "./legal/documentos";
export { parsearFechaCarnet, calcularEdad, edadDesdeOcr } from "./utils/edad";
export { NotificationsScreen } from "./screens/NotificationsScreen";
export { ChatListScreen } from "./screens/ChatListScreen";
export { RentalChatScreen } from "./screens/RentalChatScreen";
export { SupportScreen } from "./screens/SupportScreen";
export { AntecedentesScreen } from "./screens/AntecedentesScreen";
export { CertificadoAutoScreen } from "./screens/CertificadoAutoScreen";
export { SwitchingScreen } from "./screens/SwitchingScreen";
export { DeliveryScreen } from "./screens/DeliveryScreen";
export { PreCheckinModal } from "./screens/PreCheckinModal";
export { ReportFineModal } from "./screens/ReportFineModal";
export { CobroPosteriorModal } from "./screens/CobroPosteriorModal";
export { AdjuntarFoto } from "./components/AdjuntarFoto";
export { KycScreen } from "./auth/screens/KycScreen";
export { CompletarLicenciaScreen } from "./auth/screens/CompletarLicenciaScreen";
export { BotonesOAuth } from "./components/BotonesOAuth";
export { PROVEEDORES_OAUTH, redirectUriOAuth, iniciarSesionConProveedor } from "./utils/oauth";
export { SegundoConductorModal } from "./screens/SegundoConductorModal";
export { MandatoDuenoModal, verificarMandatoAceptado } from "./components/MandatoDuenoModal";
export { showAlert } from "./utils/alert";
export { traducirErrorAuth, esErrorCredenciales } from "./utils/authErrors";
export { msjError } from "./utils/msjError";
export { registrarPushToken, registrarListenerNotificaciones } from "./utils/push";
export { inicializarSentry } from "./utils/sentry";
export {
  registrarTareaTelemetria,
  iniciarTelemetriaBackground,
  detenerTelemetriaBackground,
} from "./utils/telemetriaBackgroundTask";
export { urlWeb, baseWebUrl, WEB_URL_PRODUCCION } from "./utils/webUrl";
export { SplashScreen } from "./auth/screens/SplashScreen";
export { OnboardingScreen } from "./auth/screens/OnboardingScreen";
export { formatearTelefonoInput, normalizarTelefonoCompleto } from "./utils/formato";
