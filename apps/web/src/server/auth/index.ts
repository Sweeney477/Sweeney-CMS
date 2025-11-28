import NextAuth from "next-auth";

import { authOptions } from "@/server/auth/options";

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);


