import React from "react";
import { useApp, DocumentCameraModal } from "@rentacar/mobile-shared";
import { WizardShell } from "./WizardShell";
import { useCarWizard } from "./useCarWizard";
import { TarjetaRequerida } from "./TarjetaRequerida";
import { PasoVehiculo } from "./PasoVehiculo";
import { PasoTarifa } from "./PasoTarifa";
import { PasoFotos } from "./PasoFotos";
import { PasoDocumentos } from "./PasoDocumentos";

const LABEL_SIGUIENTE = {
  1: "Siguiente: tarifa",
  2: "Siguiente: fotos",
  3: "Siguiente: documentos",
  4: "Publicar auto",
};

/**
 * Asistente para publicar un auto, en 4 pantallas: Vehículo · Tarifa · Fotos
 * · Documentos. El estado y las reglas viven en `useCarWizard`; acá solo se
 * arma el cromo y se elige el paso.
 */
export function AddEditCarScreen({ onBack, onComplete }) {
  const { currentUser } = useApp();
  const wizard = useCarWizard({ onComplete });
  const { step } = wizard;

  // Sin tarjeta validada el backend rechaza la publicación: mejor avisarlo
  // antes de entrar al asistente.
  if (currentUser && currentUser.tarjeta_estado !== "validada") {
    return <TarjetaRequerida estado={currentUser.tarjeta_estado} onBack={onBack} />;
  }

  const Paso = { 1: PasoVehiculo, 2: PasoTarifa, 3: PasoFotos, 4: PasoDocumentos }[step];

  return (
    <>
      <WizardShell
        paso={step}
        onBack={() => wizard.irAtras({ onSalir: onBack })}
        onNext={wizard.avanzar}
        siguienteLabel={LABEL_SIGUIENTE[step]}
        siguienteHabilitado={!wizard.subiendo}
        cargando={wizard.loading}
      >
        <Paso wizard={wizard} />
      </WizardShell>

      <DocumentCameraModal
        visible={!!wizard.camaraSlot}
        variant="vehiculo"
        config={wizard.camaraSlot?.camara}
        onClose={() => wizard.setCamaraSlot(null)}
        onCaptured={wizard.fotoCapturada}
      />
    </>
  );
}
