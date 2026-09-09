// ============================================================================
// Re-exportación limpia del módulo modular KYC
// ----------------------------------------------------------------------------
// Este archivo reemplaza al monolito anterior (~2.2k líneas). El flujo real
// vive en `../kyc/`:
//   - kyc/KycScreen.js      -> orquestador (< 130 líneas)
//   - kyc/useKycFlow.js     -> máquina de estados (Didit + captura manual)
//   - kyc/steps/*           -> las pantallas de cada paso
// Se mantiene esta ruta para no romper `mobile-shared/index.js` ni los
// imports de renter/owner.
// ============================================================================
export { KycScreen, KycScreen as default } from "../kyc/index";
