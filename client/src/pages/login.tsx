import { useState } from "react";
import { useLocation } from "wouter";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";
import { apiRequest } from "@/lib/queryClient";
import { useApp, type AuthUser } from "@/lib/player";

export default function Login() {
  const { login } = useApp();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await apiRequest("POST", mode === "login" ? "/api/auth/login" : "/api/auth/register", { name, password });
      const body = (await res.json()) as { token: string; user: AuthUser };
      login(body.token, body.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Не удалось выполнить вход");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex items-center gap-2 font-semibold"><Logo /><span>ВСМ Тренажёр</span></div>
          <CardTitle>{mode === "login" ? "Вход в профиль" : "Создать профиль"}</CardTitle>
          <CardDescription>{mode === "login" ? "Войдите, чтобы продолжить обучение и сохранять результаты." : "Новый аккаунт создаётся с ролью проводника."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="auth-name">Имя сотрудника</Label><Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={80} required autoComplete="username" /></div>
            <div className="space-y-2"><Label htmlFor="auth-password">Пароль</Label><Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>{mode === "login" ? <LogIn className="mr-2 size-4" /> : <UserPlus className="mr-2 size-4" />}{pending ? "Пожалуйста, подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}</Button>
          </form>
          <Button variant="ghost" className="mt-3 w-full underline" onClick={() => { setMode((value) => value === "login" ? "register" : "login"); setError(null); }}>
            {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
