import React from "react";
import { act } from "react-test-renderer";
import { ForgotPasswordScreen } from "@rentacar/mobile-shared/auth/screens/ForgotPasswordScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const mockResetPassword = jest.fn();
const mockShowAlert = jest.fn();

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ resetPassword: (...a) => mockResetPassword(...a) }),
}));
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const porTestId = (tr, id) => tr.root.find((n) => n.props?.testID === id && typeof n.type === "function");

const escribirCorreo = (tr, valor) => act(() => porTestId(tr, "input-email").props.onChangeText(valor));
const pulsarEnviar = (tr) => act(async () => porTestId(tr, "btn-enviar-enlace").props.onPress());

describe("ForgotPasswordScreen · recuperar contraseña", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockResetPassword.mockReset().mockResolvedValue(undefined);
    mockShowAlert.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("invita a escribir el correo y ofrece volver a entrar", () => {
    const t = textOf(renderTree(<ForgotPasswordScreen onNavigate={() => {}} />));
    expect(t).toContain("Recupera tu acceso");
    expect(t).toContain("Correo");
    expect(t).toContain("Enviar enlace");
    expect(t).toContain("¿Ya la recordaste?");
  });

  it("sin correo lo avisa en la pantalla, sin ventana emergente ni llamar al servidor", async () => {
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    await pulsarEnviar(tr);
    expect(textOf(tr)).toContain("Ingresa el correo con el que te registraste.");
    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("al enviar confirma con el correo escrito y sin afirmar que la cuenta existe", async () => {
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    escribirCorreo(tr, " camila@correo.cl ");
    await pulsarEnviar(tr);

    expect(mockResetPassword).toHaveBeenCalledWith("camila@correo.cl");
    const t = textOf(tr);
    expect(t).toContain("Revisa tu correo");
    expect(t).toContain("Si camila@correo.cl tiene una cuenta");
    expect(t).toContain("Volver a entrar");
  });

  it("el reenvío queda en espera y no llama de nuevo hasta que pasa el minuto", async () => {
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    escribirCorreo(tr, "camila@correo.cl");
    await pulsarEnviar(tr);
    expect(textOf(tr)).toContain("Reenviar enlace en 1:00");

    await act(async () => pressText(tr, "Reenviar enlace en"));
    expect(mockResetPassword).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(textOf(tr)).not.toContain("Reenviar enlace en");
    await act(async () => pressText(tr, "Reenviar enlace"));
    expect(mockResetPassword).toHaveBeenCalledTimes(2);
  });

  it("si el envío falla se queda en el formulario con el motivo traducido", async () => {
    mockResetPassword.mockRejectedValue(new Error("Network request failed"));
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    escribirCorreo(tr, "camila@correo.cl");
    await pulsarEnviar(tr);

    const t = textOf(tr);
    expect(t).toContain("No se pudo conectar");
    expect(t).not.toContain("Revisa tu correo");
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("al volver a escribir desaparece el aviso", async () => {
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    await pulsarEnviar(tr);
    expect(textOf(tr)).toContain("Ingresa el correo con el que te registraste.");

    escribirCorreo(tr, "c");
    expect(textOf(tr)).not.toContain("Ingresa el correo con el que te registraste.");
  });

  it("mientras se envía el campo queda bloqueado", async () => {
    let terminar;
    mockResetPassword.mockImplementation(() => new Promise((resolve) => (terminar = resolve)));
    const tr = renderTree(<ForgotPasswordScreen onNavigate={() => {}} />);
    escribirCorreo(tr, "camila@correo.cl");
    await act(async () => {
      porTestId(tr, "btn-enviar-enlace").props.onPress();
    });

    expect(porTestId(tr, "input-email").props.editable).toBe(false);
    expect(porTestId(tr, "btn-enviar-enlace").props.loading).toBe(true);

    await act(async () => terminar());
  });

  it("'Volver a entrar' lleva al login, tanto en el formulario como en la confirmación", async () => {
    const onNavigate = jest.fn();
    const tr = renderTree(<ForgotPasswordScreen onNavigate={onNavigate} />);
    pressText(tr, "Volver a entrar");
    expect(onNavigate).toHaveBeenLastCalledWith("login");

    onNavigate.mockClear();
    escribirCorreo(tr, "camila@correo.cl");
    await pulsarEnviar(tr);
    pressText(tr, "Volver a entrar");
    expect(onNavigate).toHaveBeenLastCalledWith("login");
  });
});
