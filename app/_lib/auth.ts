import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        // Password reset flow: empty password means admin reset it.
        // Accept whatever the user types and save it as the new password.
        if (user.password === "") {
          const newPassword = credentials.password as string;
          // Validate: 8-16 chars, alphanumeric only (same rules as registration)
          if (newPassword.length < 8 || newPassword.length > 16 || !/^[a-zA-Z0-9]+$/.test(newPassword)) {
            return null;
          }
          const newHash = await bcrypt.hash(newPassword, 10);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: newHash },
          });
          return { id: user.id.toString(), email: user.email, role: user.role, staffId: user.staffId };
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;
        return { id: user.id.toString(), email: user.email, role: user.role, staffId: user.staffId };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id as string;
        token.role = (user as { role: string }).role;
        token.staffId = (user as { staffId?: number | null }).staffId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role as string;
      session.user.staffId = (token.staffId as number | null) ?? null;
      return session;
    },
  },
});
