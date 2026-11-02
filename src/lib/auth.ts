import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { allowRateLimit } from "@/lib/rate-limit";
import {
  emailLoginSchema,
  phoneLoginSchema,
} from "@/lib/validations/auth";

const DEMO_PHONE_CODE = "123456";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "演示登录",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      authorize: async (credentials) => {
        const phone =
          typeof credentials?.phone === "string" ? credentials.phone : "";
        if (phone) {
          const parsed = phoneLoginSchema.safeParse({
            phone,
            code: credentials?.code,
          });
          if (!parsed.success) return null;
          if (parsed.data.code !== DEMO_PHONE_CODE) return null;
          if (!allowRateLimit(`login:phone:${parsed.data.phone}`)) return null;

          const user = await prisma.user.upsert({
            where: { phone: parsed.data.phone },
            update: {},
            create: {
              phone: parsed.data.phone,
              name: `用户${parsed.data.phone.slice(-4)}`,
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        const parsed = emailLoginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) return null;
        if (!allowRateLimit(`login:email:${parsed.data.email}`)) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? "";
        session.user.role =
          (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
      }
      return session;
    },
  },
});
