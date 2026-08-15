enum MailerTemplate {
    UNPRIVILEGED_ACTIVATION = "./unprivileged-activation",
    PRIVILEGED_ACTIVATION = "./privileged-activation",

    NOTIFY_NEW_DEVICE = "./notify-new-device",

    PASSWORD_RESET = "./password-reset",
    PASSWORD_CHANGE = "./password-change",
    PHONE_CHANGE = "./phone-change",

    EMAIL_CHANGE = "./email-change",
    EMAIL_CONFIRM_CHANGE = "./email-confirm-change",
    MFA_RESET = "./mfa-reset",

    NOTIFY_EVENT = "./notify-event",

    NOTIFY_FRAUD = "./notify-fraud",

    REACTIVATION = "./reactivation",
    NOTIFY_REACTIVATION = "./notify-reactivation"
}

enum MailerURL {
    PUBLIC_WEB_URL = "PUBLIC_WEB_URL"
}

enum MailerEndpoint {
    UNPRIVILEGED_ACTIVATION = "unprivileged-activation",
    PRIVILEGED_ACTIVATION = "privileged-activation",

    PASSWORD_RESET = "password-reset",
    PASSWORD_CHANGE = "password-change",
    PHONE_CHANGE = "phone-change",

    EMAIL_CHANGE = "email-change",
    EMAIL_CONFIRM_CHANGE = "email-confirmation-change",
    MFA_RESET = "mfa-reset",

    FRAUD_FLAG = "fraud-flag",
    
    REACTIVATION = "reactivation"
}

enum MailerSubject {
    UNPRIVILEGED_ACTIVATION = "Activación de cuenta",
    PRIVILEGED_ACTIVATION = "Activación de cuenta administrativa",
    NOTIFY_ACTIVATION = "Activación exitosa",

    NOTIFY_NEW_DEVICE = "Nuevo inicio de sesión",

    PASSWORD_RESET = "Reinicio de contraseña",
    PASSWORD_CHANGE = "Cambio de contraseña",
    PHONE_CHANGE = "Cambio de teléfono",

    NOTIFY_PASSWORD_RESET = "Reiniciaste tu contraseña",
    NOTIFY_PASSWORD_CHANGE = "Cambiaste tu contraseña",
    NOTIFY_PHONE_CHANGE = "Cambiaste tu teléfono",

    EMAIL_CHANGE = "Cambio de correo",
    EMAIL_CONFIRM_CHANGE = "Confirma tu cambio de correo",
    NOTIFY_EMAIL_CHANGE = "Cambiaste tu correo",

    NOTIFY_FRAUD = "Tu cuenta ha sido bloqueada",

    REACTIVATION = "Reactivación de cuenta",
    NOTIFY_REACTIVATION = "Reactivación exitosa"
}

enum EmailMessage {
    NOTIFY_ACTIVATION = "Activaste tu cuenta correctamente.",
    NOTIFY_PASSWORD_RESET = "Reiniciaste tu contraseña.",
    NOTIFY_PASSWORD_CHANGE = "Cambiaste tu contraseña.",
    NOTIFY_PHONE_CHANGE = "Cambiaste tu teléfono.",
    NOTIFY_EMAIL_CHANGE = "Cambiaste tu correo."
}

export type MailerBuilder = {
    template: MailerTemplate;
    email: string;
    context: {
        name: string;
        url?: string;
        message?: EmailMessage;
        userAgent?: string;
    }
}

export {
    MailerTemplate,
    MailerURL,
    MailerEndpoint,
    MailerSubject,
    EmailMessage,
}