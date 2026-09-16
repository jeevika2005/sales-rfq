import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyCredentials } from "@/lib/verify-credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => verifyCredentials(credentials),
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (isLoginPage) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true; // TEMPORARY BYPASS: Allow access to all routes without login
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
