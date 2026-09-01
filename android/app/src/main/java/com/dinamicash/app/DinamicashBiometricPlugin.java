package com.dinamicash.app;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "DinamicashBiometric")
public class DinamicashBiometricPlugin extends Plugin {
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
            JSObject response = new JSObject();
            response.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
            response.put("code", result);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudo revisar la biometria", error);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        try {
            int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
            if (result != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("La biometria no esta disponible en este celular", String.valueOf(result));
                return;
            }

            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    JSObject response = new JSObject();
                    response.put("verified", true);
                    call.resolve(response);
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    call.reject(errString.toString(), String.valueOf(errorCode));
                }

                @Override
                public void onAuthenticationFailed() {
                    notifyListeners("biometricFailed", new JSObject());
                }
            });

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Ingresar a Dinamicash")
                    .setSubtitle("Confirma tu identidad para entrar")
                    .setNegativeButtonText("Cancelar")
                    .setAllowedAuthenticators(AUTHENTICATORS)
                    .build();

            prompt.authenticate(promptInfo);
        } catch (Exception error) {
            call.reject("No se pudo abrir la validacion biometrica", error);
        }
    }
}
