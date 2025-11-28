'use server';

import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/server/auth";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function signInAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = signInSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid credentials",
    };
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/admin",
  });

  redirect("/admin");
}




