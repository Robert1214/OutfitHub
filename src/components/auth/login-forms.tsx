"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "email" | "phone";
type EmailMode = "login" | "register";

export function LoginForms({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  function switchEmailMode(next: EmailMode) {
    setEmailMode(next);
    setError(null);
  }

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("账号或密码不正确");
      setBusy(false);
      return;
    }

    toast.success("登录成功");
    router.push(nextPath);
    router.refresh();
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: name || undefined,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "注册失败，请稍后重试");
      setBusy(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      toast.success("注册成功，请登录");
      setEmailMode("login");
      setBusy(false);
      return;
    }

    toast.success("注册成功");
    router.push(nextPath);
    router.refresh();
  }

  async function handlePhoneLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", {
      phone,
      code,
      redirect: false,
    });

    if (result?.error) {
      setError("验证码不正确（演示码 123456）");
      setBusy(false);
      return;
    }

    toast.success("登录成功");
    router.push(nextPath);
    router.refresh();
  }

  function sendCode() {
    if (!/^1\d{10}$/.test(phone)) {
      setError("请输入 11 位手机号");
      return;
    }
    setError(null);
    setCodeSent(true);
    toast.info("演示环境，验证码固定为 123456");
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => switchMode("email")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            mode === "email"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={mode === "email"}
        >
          邮箱登录
        </button>
        <button
          type="button"
          onClick={() => switchMode("phone")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            mode === "phone"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={mode === "phone"}
        >
          手机号登录
        </button>
      </div>

      {mode === "email" ? (
        <form
          onSubmit={emailMode === "login" ? handleEmailLogin : handleRegister}
          className="mt-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {emailMode === "register" ? (
            <div className="space-y-2">
              <Label htmlFor="name">昵称（选填）</Label>
              <Input
                id="name"
                autoComplete="nickname"
                maxLength={30}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="怎么称呼你"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                emailMode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={emailMode === "register" ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={emailMode === "register" ? "至少 8 位" : "请输入密码"}
            />
          </div>

          {emailMode === "register" ? (
            <p className="text-xs text-muted-foreground">
              演示环境：邮箱注册不做真实验证；密码至少 8 位。
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "处理中…"
              : emailMode === "login"
                ? "登录"
                : "注册并登录"}
          </Button>

          <button
            type="button"
            onClick={() =>
              switchEmailMode(emailMode === "login" ? "register" : "login")
            }
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {emailMode === "login" ? "没有账号？注册" : "已有账号？登录"}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePhoneLogin} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))
              }
              placeholder="11 位手机号"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                inputMode="numeric"
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6 位验证码"
              />
              <Button
                type="button"
                variant="outline"
                onClick={sendCode}
                disabled={busy}
                className="shrink-0"
              >
                {codeSent ? "已发送" : "发送验证码"}
              </Button>
            </div>
          </div>

          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            演示环境，验证码固定为 123456；未注册手机号会自动创建账号。
          </p>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "登录中…" : "登录"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        登录即表示同意{" "}
        <Link href="/terms" className="underline">
          用户协议
        </Link>{" "}
        和{" "}
        <Link href="/privacy" className="underline">
          隐私政策
        </Link>
        。
      </p>
    </div>
  );
}
