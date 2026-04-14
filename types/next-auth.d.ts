import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    staffId?: number | null;
  }

  interface Session {
    user: {
      role: string;
      staffId: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    staffId?: number | null;
  }
}
