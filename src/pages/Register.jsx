import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, IdCard, Phone, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [dniError, setDniError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateDni = (value) => /^\d{7,8}$/.test(value);

  const handleDniBlur = async () => {
    setDniError("");
    if (!dni.trim()) return;
    if (!validateDni(dni.trim())) {
      setDniError("El DNI debe tener 7 u 8 dígitos");
      return;
    }
    try {
      const res = await base44.functions.invoke("validateRegistration", { dni: dni.trim() });
      if (!res.data.available) setDniError(res.data.message);
    } catch {
      // ignore - will validate server-side
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setDniError("");
    if (!validateDni(dni.trim())) {
      setDniError("El DNI debe tener 7 u 8 dígitos");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      try {
        const res = await base44.functions.invoke("validateRegistration", { dni: dni.trim() });
        if (res?.data && !res.data.available) {
          setDniError(res.data.message);
          setLoading(false);
          return;
        }
      } catch {
        // Si la validación requiere usuario autenticado, se continúa con el registro
      }
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        // Save DNI and Argentine phone to the user profile
        try {
          const rawPhone = phone.trim().replace(/^0/, "");
          const formattedPhone = rawPhone
            ? rawPhone.startsWith("+")
              ? rawPhone
              : `+54 9 ${rawPhone}`
            : "";
          await base44.auth.updateMe({ dni: dni.trim(), ...(formattedPhone ? { phone: formattedPhone } : {}) });
        } catch { /* non-critical */ }
      }
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Código de verificación inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Código enviado", description: "Revisá tu email para el nuevo código." });
    } catch (err) {
      setError(err.message || "No se pudo reenviar el código");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verificá tu email" subtitle={`Enviamos un código a ${email}`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : "Verificar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          ¿No recibiste el código?{" "}
          <button onClick={handleResend} className="text-accent font-medium hover:underline">Reenviar</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Creá tu cuenta BearDrive"
      subtitle="Registrate para empezar a viajar"
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")} className="text-accent font-medium hover:underline">
            Ingresar
          </Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />Continuar con Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dni">DNI <span className="text-destructive">*</span></Label>
          <div className="relative">
            <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="dni" type="tel" inputMode="numeric" autoComplete="off" placeholder="12345678" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} onBlur={handleDniBlur} className="pl-10 h-12" maxLength={8} required />
          </div>
          {dniError && <p className="text-xs text-destructive">{dniError}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="phone">Celular <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <span className="text-[11px] text-muted-foreground">Formosa (+54 9)</span>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 px-3 rounded-xl bg-secondary/80 border border-border text-xs font-semibold text-foreground select-none shrink-0 h-12">
              <span>🇦🇷</span>
              <span>+54 9</span>
            </div>
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="370 412 3456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ingresá tu código de área local (ej: <strong>370</strong>) sin el 15.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium bear-gold-gradient text-foreground border-0" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando cuenta...</> : "Crear cuenta"}
        </Button>
      </form>
    </AuthLayout>
  );
}