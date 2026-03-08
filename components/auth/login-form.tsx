"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setAuth, setToken, setUser } from "@/lib/userSlice";
import { loginRequest } from "@/lib/erp-api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, MilkIcon, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.jpg";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const phoneSchema = z.object({
  email: z.string().optional(),
  phone: z.string().min(7, "Enter a valid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(loginMode === "email" ? emailSchema : phoneSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof emailSchema>) => {
    setIsLoading(true);
    try {
      const session = await loginRequest({
        email: loginMode === "email" ? values.email : undefined,
        phone: loginMode === "phone" ? values.phone : undefined,
        password: values.password,
      });
      dispatch(setAuth(true));
      dispatch(setToken(session.token));
      dispatch(setUser(session.user));
      toast({
        title: "Signed in",
        description: `Welcome back, ${session.user.full_name}.`,
      });
      router.push("/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description:
          error instanceof Error ? error.message : "Could not sign in.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md overflow-hidden border-slate-200 bg-white/95 shadow-xl backdrop-blur">
      <CardHeader className="space-y-5 border-b bg-white">
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Amsal ERP"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
          />
          <div className="text-left">
            <CardTitle className="text-2xl">Amsal ERP</CardTitle>
            <CardDescription>
              Sign in to manage supply, production, distribution, and sales.
            </CardDescription>
          </div>
        </div>

        <Tabs
          value={loginMode}
          onValueChange={(value) => {
            const nextMode = value as "email" | "phone";
            setLoginMode(nextMode);
            form.clearErrors();
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-stone-100">
            <TabsTrigger value="email" className="gap-2 rounded-lg">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="gap-2 rounded-lg">
              <Phone className="h-4 w-4" />
              Phone
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="bg-white pt-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {loginMode === "email" ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="080..."
                autoComplete="tel"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                {...form.register("password")}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-0 top-0 h-full px-3"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-red-500">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in
              </>
            ) : (
              <>
                <MilkIcon className="mr-2 h-4 w-4" />
                Open ERP Dashboard
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
